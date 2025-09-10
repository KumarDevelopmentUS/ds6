// hooks/useSocialFeatures.ts

import { supabase } from '@/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Comment, Post } from '../types/social';

export const useUserProfile = () => {
  const { session } = useAuth();
  const user = session?.user;

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get profile from unified user_profiles table
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error);
        
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating default profile...');
          
          const defaultProfile = {
            id: user.id,
            username: user.email?.split('@')[0] || 'user' + Date.now(),
            nickname: user.user_metadata?.nickname || user.email?.split('@')[0] || 'Player',
            display_name: user.user_metadata?.nickname || user.email?.split('@')[0] || 'Player',
            school: user.user_metadata?.school || null,
            avatar_icon: 'person',
            avatar_icon_color: '#FFFFFF',
            avatar_background_color: '#007AFF',
          };

          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert(defaultProfile)
            .select()
            .single();

          if (createError) {
            console.error('Failed to create default profile:', createError);
            return defaultProfile; // Return default even if insert fails
          }

          return newProfile;
        }
        
        throw new Error(error.message);
      }

      return profile;
    },
    enabled: !!user,
  });
};

export const useUserCommunities = (enabled: boolean = true) => {
  const { session } = useAuth();
  const user = session?.user;
  const queryClient = useQueryClient();

  // useQuery for the initial data fetch remains the same
  const queryInfo = useQuery({
    queryKey: ['userCommunities', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_communities')
        .select('*, communities(*)')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || []; 
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 3,
    retryDelay: 1000,
  });

  // --- Smart subscription with conditional enabling ---
  useEffect(() => {
    // Only proceed if we have a stable user ID and subscriptions are enabled
    if (!user?.id || !enabled) {
      console.log('User communities: Subscription disabled or no user');
      return;
    }

    console.log('User communities: Setting up subscription');
    const channel = supabase.channel(`user-communities-${user.id}`);

    // Define the subscription logic
    const subscription = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_communities',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        // When a change is detected, refetch the data.
        queryClient.invalidateQueries({ queryKey: ['userCommunities', user.id] });
      }
    );

    // Only subscribe if the channel is not already in the process of connecting or connected.
    // This is the key fix for the race condition.
    if (channel.state !== 'joined' && channel.state !== 'joining') {
      subscription.subscribe((status, err) => {
        if (err) {
          console.error(`Subscription error in channel: ${channel.topic}`, err);
        }
      });
    }

    // The cleanup function is critical.
    return () => {
      console.log('User communities: Cleaning up subscription');
      // It's good practice to unsubscribe before removing the channel.
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, enabled]); // Depend on enabled flag

  return queryInfo;
};

export const usePosts = (communityId?: number) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ['posts', communityId, user?.id],
    queryFn: async () => {
      // If no specific community is selected (All Communities), 
      // we need to get user's communities to filter posts appropriately
      let userCommunityIds: number[] = [];
      if (!communityId && user) {
        const { data: userCommunities, error: communitiesError } = await supabase
          .from('user_communities')
          .select('community_id')
          .eq('user_id', user.id);
          
        if (communitiesError) throw communitiesError;
        
        if (!userCommunities || userCommunities.length === 0) {
          return []; // User is not in any communities, return empty array
        }
        
        userCommunityIds = userCommunities.map(uc => uc.community_id);
      }
      
      // Direct query instead of using the broken RPC function
      let query = supabase
        .from('posts')
        .select(`
          id,
          uid,
          title,
          content,
          created_at,
          image_url,
          user_id,
          community_id,
          author_name,
          author_avatar_icon,
          author_avatar_icon_color,
          author_avatar_background_color,
          linked_match_id,
          communities(name)
        `)
        .order('created_at', { ascending: false });

      if (communityId) {
        query = query.eq('community_id', communityId);
      }

      const { data: posts, error: postsError } = await query;
      
      if (postsError) throw postsError;

      // Get profile pictures and fallback avatar data for all post authors
      const userIds = [...new Set(posts.map(p => p.user_id))];
      
      // Fetch user_profiles for author information and avatar data
      const { data: userProfiles, error: userProfileError } = await supabase
        .from('user_profiles')
        .select('id, avatar_url, username, nickname, display_name, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', userIds);





      // Create profile map for quick lookup from unified data
      const profileMap = (userProfiles || []).reduce((acc: any, profile: any) => {
        acc[profile.id] = {
          ...profile,
          avatar_icon: profile.avatar_icon || 'person',
          avatar_icon_color: profile.avatar_icon_color || '#FFFFFF',
          avatar_background_color: profile.avatar_background_color || '#007AFF',
        };
        return acc;
      }, {});



      // Get vote counts for all posts
      const postUids = posts.map(p => p.uid || String(p.id));
      const { data: voteCounts } = await supabase
        .from('votes')
        .select('post_uid')
        .eq('vote_type', 1)
        .in('post_uid', postUids);

      // Get comment counts for all posts  
      const { data: commentCounts } = await supabase
        .from('comments')
        .select('post_uid')
        .in('post_uid', postUids);

      // Create count maps
      const voteCountMap = (voteCounts || []).reduce((acc: any, vote: any) => {
        acc[vote.post_uid] = (acc[vote.post_uid] || 0) + 1;
        return acc;
      }, {});

      const commentCountMap = (commentCounts || []).reduce((acc: any, comment: any) => {
        acc[comment.post_uid] = (acc[comment.post_uid] || 0) + 1;
        return acc;
      }, {});

      // Get match data for posts with linked matches
      const linkedMatchIds = posts
        .filter((p: any) => p.linked_match_id)
        .map((p: any) => p.linked_match_id);
      
      let matchDataMap: { [key: string]: any } = {};
      if (linkedMatchIds.length > 0) {
        const { data: matchData, error: matchError } = await supabase
          .from('saved_matches')
          .select(`
            id,
            "matchSetup",
            "playerStats",
            "teamPenalties",
            "userSlotMap",
            "winnerTeam",
            "matchDuration",
            "matchStartTime"
          `)
          .in('id', linkedMatchIds);
        
        if (matchData) {
          matchDataMap = matchData.reduce((acc: any, match: any) => {
            acc[match.id] = match;
            return acc;
          }, {});
        }
      }

      // Combine the data
      let combinedPosts = posts.map((post: any) => {
        const profileData = profileMap[post.user_id];
        // Determine the best author name from profile data
        const authorName = profileData?.nickname || profileData?.display_name || post.author_name || 'Anonymous';
        
        const postData = {
          id: post.id, // Keep numeric ID
          uid: post.uid, // Add the required uid property
          title: post.title,
          content: post.content,
          created_at: post.created_at,
          image_url: post.image_url,
          user_id: post.user_id,
          community_id: post.community_id,
          author_name: authorName,
          // Use fallback avatar data from profileMap if posts table doesn't have it
          author_avatar_icon: post.author_avatar_icon || profileData?.avatar_icon || 'person',
          author_avatar_icon_color: post.author_avatar_icon_color || profileData?.avatar_icon_color || '#FFFFFF',
          author_avatar_background_color: post.author_avatar_background_color || profileData?.avatar_background_color || '#007AFF',
          author_profile_picture_url: profileData?.avatar_url || null,
          community_name: post.communities?.name || null,
          like_count: voteCountMap[post.uid || String(post.id)] || 0,
          comment_count: commentCountMap[post.uid || String(post.id)] || 0,
          author_username: profileData?.username || null,
          linked_match_id: post.linked_match_id,
          linked_match_data: post.linked_match_id ? matchDataMap[post.linked_match_id] : null,
        };
        

        
        return postData;
      });
      
      // Filter posts when "All Communities" is selected to only show posts from user's communities
      if (!communityId && userCommunityIds.length > 0) {
        combinedPosts = combinedPosts.filter((post: any) => 
          userCommunityIds.includes(post.community_id)
        );
      }
      
      return combinedPosts as Post[];
    },
  });

   const { data: userVotes } = useQuery({
    // Proactively added type annotation to prevent 'any' type error
     queryKey: ['userVotes', user?.id, posts?.map((p: Post) => p.uid || String(p.id))],
    queryFn: async () => {
      if (!user || !posts || posts.length === 0) return {};
      
       const { data, error } = await supabase
        .from('votes')
        .select('post_uid, vote_type')
        .eq('user_id', user.id)
        .in('post_uid', posts.map((p: Post) => p.uid || String(p.id)));
        
      if (error) throw error;
      
       return data.reduce((acc, vote) => {
        acc[vote.post_uid] = vote.vote_type;
        return acc;
       }, {} as Record<string, -1 | 1>);
    },
    enabled: !!user && !!posts && posts.length > 0,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: -1 | 1 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('post_uid', postId)
        .eq('user_id', user.id)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from('votes').delete().eq('id', existingVote.id);
        } else {
          await supabase.from('votes').update({ vote_type: voteType }).eq('id', existingVote.id);
        }
      } else {
        await supabase.from('votes').insert({ post_uid: postId, user_id: user.id, vote_type: voteType });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userVotes'] });
    },
  });

  const handleVote = (postId: string, voteType: -1 | 1) => {
    voteMutation.mutate({ postId, voteType });
  };

  return { posts, isLoading, refetch, handleVote, userVotes };
};

export const usePost = (postId: string) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      // Fetch by uuid and also fetch numeric id for counts lookup
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, uid, title, content, created_at, image_url, community_id, 
          communities(name), author_name, author_avatar_icon, 
          author_avatar_icon_color, author_avatar_background_color, user_id, linked_match_id
        `)
        .eq('uid', postId)
        .single();
      if (error) throw error;

      const numericId = data.id;
      
      // Get counts directly instead of using the broken RPC function
      const { data: voteCounts } = await supabase
        .from('votes')
        .select('id')
        .eq('post_uid', postId)
        .eq('vote_type', 1);

      const { data: commentCounts } = await supabase
        .from('comments')
        .select('id')
        .eq('post_uid', postId);

      // Get author profile from unified user_profiles table
      const { data: authorProfile } = await supabase
        .from('user_profiles')
        .select('avatar_url, username, nickname, display_name, avatar_icon, avatar_icon_color, avatar_background_color')
        .eq('id', data.user_id)
        .single();

      // Fetch linked match data if present (same logic as usePosts)
      let linkedMatchData = null;
      if (data.linked_match_id) {
        const { data: matchData } = await supabase
          .from('saved_matches')
          .select(`
            id,
            "matchSetup",
            "playerStats",
            "teamPenalties",
            "userSlotMap",
            "winnerTeam",
            "matchDuration",
            "matchStartTime"
          `)
          .eq('id', data.linked_match_id)
          .single();
        
        if (matchData) {
          linkedMatchData = matchData;
        }
      }

      // Determine the best author name from profile data
      const authorName = authorProfile?.nickname || authorProfile?.display_name || data.author_name || 'Anonymous';
      
      return {
        id: data.uid,
        title: data.title,
        content: data.content,
        created_at: data.created_at,
        image_url: data.image_url,
        community_id: data.community_id,
        author_name: authorName,
        // Use author profile data if posts table doesn't have it
        author_avatar_icon: data.author_avatar_icon || authorProfile?.avatar_icon || 'person',
        author_avatar_icon_color: data.author_avatar_icon_color || authorProfile?.avatar_icon_color || '#FFFFFF',
        author_avatar_background_color: data.author_avatar_background_color || authorProfile?.avatar_background_color || '#007AFF',
        author_profile_picture_url: authorProfile?.avatar_url || null,
        user_id: data.user_id,
        like_count: voteCounts?.length || 0,
        comment_count: commentCounts?.length || 0,
        community_name: (data as any).communities?.name || null,
        author_username: authorProfile?.username || null,
        linked_match_id: data.linked_match_id,
        linked_match_data: linkedMatchData,
      } as unknown as Post;
    },
    enabled: typeof postId === 'string' && postId.length > 0,
  });

  const { data: userVote } = useQuery({
    queryKey: ['userVote', postId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('votes').select('vote_type').eq('post_uid', postId).eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      // --- THIS IS THE FIX ---
      // If data?.vote_type is undefined (because data is null), return null instead.
      return data?.vote_type ?? null;
    },
    enabled: !!user && typeof postId === 'string' && postId.length > 0,
  });

  const voteMutation = useMutation({
    mutationFn: async (voteType: -1 | 1) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existingVote } = await supabase.from('votes').select('*').eq('post_uid', postId).eq('user_id', user.id).single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from('votes').delete().eq('id', existingVote.id);
        } else {
          await supabase.from('votes').update({ vote_type: voteType }).eq('id', existingVote.id);
        }
      } else {
        await supabase.from('votes').insert({ post_uid: postId, user_id: user.id, vote_type: voteType });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userVote', postId] });
    },
  });

  const handleVote = (voteType: -1 | 1) => {
    voteMutation.mutate(voteType);
  };

  return { post, isLoading, error, handleVote, userVote };
};

export const useCreatePost = () => {
  const { session } = useAuth();
  const user = session?.user;
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const mutation = useMutation({
    mutationFn: async ({ 
      title, 
      content, 
      imageUri, 
      communityId,
      communityType,
      linkedMatchId
    }: {
      title: string;
      content: string;
      imageUri: string | null;
      communityId: number;
      communityType: 'general' | 'school';
      linkedMatchId?: string | null;
    }) => {
       if (typeof communityId !== 'number' || isNaN(communityId)) {
        throw new Error('A valid community ID is required to create a post.');
      }

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Fetch fresh profile data to ensure we have the latest avatar information
      const { data: freshProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !freshProfile) {
        throw new Error('Profile not found or error loading profile');
      }

      let image_url = null;

      if (imageUri) {
  
        try {
          // Security Check: Validate user authentication (additional check)
          if (!user || !user.id) {
            throw new Error('User authentication required for image upload');
          }

          const fileName = `${user.id}-${Date.now()}.jpg`;
          
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            // For React Native (iOS/Android), use expo-file-system
  
            
            // Read the file as base64
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            
            // Decode base64 to binary
            const decode = (base64: string) => {
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              return bytes;
            };
            
            const imageData = decode(base64);

            
            // Upload to Supabase
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('post-images')
              .upload(fileName, imageData.buffer, { 
                contentType: 'image/jpeg',
                upsert: false 
              });

            if (uploadError) {
              console.error('[DEBUG] Supabase storage upload error:', uploadError);
              throw uploadError;
            }
            
          } else {
            // For web platform, use standard fetch
            const response = await fetch(imageUri);
            const blob = await response.blob();
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('post-images')
              .upload(fileName, blob, { 
                contentType: 'image/jpeg',
                upsert: false 
              });

            if (uploadError) {
              console.error('[DEBUG] Supabase storage upload error:', uploadError);
              throw uploadError;
            }
            
          }

          // Get the public URL (temporary - will work with private buckets)
          const { data: { publicUrl } } = supabase.storage
            .from('post-images')
            .getPublicUrl(fileName);
          
          // Validate the URL
          if (!publicUrl || typeof publicUrl !== 'string') {
            throw new Error('Invalid URL generated for post image');
          }
          

          
          image_url = publicUrl;

        } catch (e) {
          console.error('[DEBUG] An error occurred during the image handling process:', e);
          throw new Error('Failed to upload image: ' + (e instanceof Error ? e.message : 'Unknown error'));
        }
      }


      const { data, error } = await supabase
        .from('posts')
        .insert({
          title,
          content,
          image_url,
          user_id: user.id,
          community_id: communityId,
          author_name: freshProfile.nickname || freshProfile.display_name || 'Anonymous',
          author_avatar_icon: freshProfile.avatar_icon,
          author_avatar_icon_color: freshProfile.avatar_icon_color,
          author_avatar_background_color: freshProfile.avatar_background_color,
          linked_match_id: linkedMatchId,
        })
        .select()
        .single();

      if (error) {
        console.error('[DEBUG] Error inserting post into database:', error);
        throw error;
      }


      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      Alert.alert('Success', 'Post created successfully!');
      
      // Navigate to the feed tab (index 1) after creating a post
      router.push('./(tabs)/?initialTab=feed');
    },
    onError: (error: Error) => {
      console.error('Create post error:', error);
      Alert.alert('Error Creating Post', error.message);
    },
  });

  return {
    createPost: mutation.mutate,
    isCreating: mutation.isPending,
  };
};


export const useComments = (postId: string) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  const { data: profile } = useUserProfile();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_uid', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const commentMap = new Map<number, Comment>();
      const rootComments: Comment[] = [];

      data.forEach(comment => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      data.forEach(comment => {
        const commentWithReplies = commentMap.get(comment.id)!;
        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
             if (!parent.replies) parent.replies = [];
            parent.replies.push(commentWithReplies);
          }
        } else {
          rootComments.push(commentWithReplies);
        }
      });
      return rootComments;
    },
    enabled: typeof postId === 'string' && postId.length > 0,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: number }) => {
      if (!user) throw new Error('Not authenticated');

      // Fetch fresh profile data to ensure we have the latest avatar information
      const { data: freshProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !freshProfile) {
        throw new Error('Profile not found or error loading profile');
      }

      const { error } = await supabase.from('comments').insert({
          content,
          post_uid: postId,
          user_id: user.id,
          parent_comment_id: parentId,
          author_name: freshProfile.nickname || freshProfile.display_name || 'Anonymous',
          author_avatar_icon: freshProfile.avatar_icon,
          author_avatar_icon_color: freshProfile.avatar_icon_color,
          author_avatar_background_color: freshProfile.avatar_background_color,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const addComment = (content: string, parentId?: number) => {
    addCommentMutation.mutate({ content, parentId });
  };

  return { comments, isLoading, addComment, isAddingComment: addCommentMutation.isPending };
};

export const useRealtimeUpdates = (communityId?: number, enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only subscribe if explicitly enabled
    if (!enabled) {
      return;
    }

    // Use more specific channel names to prevent conflicts
    const channelId = `public-posts-and-votes-for-community-${communityId || 'all'}`;
    const channel = supabase.channel(channelId);

    // Check state before subscribing
    if (channel.state !== 'joined') {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'posts', filter: communityId ? `community_id=eq.${communityId}` : undefined },
          () => {
            console.log('Realtime: Posts updated for community', communityId || 'all');
            queryClient.invalidateQueries({ queryKey: ['posts', communityId] });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'votes' },
          () => {
            console.log('Realtime: Votes updated');
            queryClient.invalidateQueries({ queryKey: ['posts'] }); // Invalidate all posts on any vote
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    }

    return () => {
      console.log('Cleaning up realtime subscription for community', communityId || 'all');
      supabase.removeChannel(channel);
    };
  }, [communityId, queryClient, enabled]);
};

export const useUserStats = (userId: string) => {
  return useQuery({
    queryKey: ['userStats', userId],
    queryFn: async () => {
      if (!userId) return null;

      try {
        // Import the hybrid function
        const { getUserStatsHybrid } = await import('../utils/profileSync');
        return await getUserStatsHybrid(userId);
      } catch (error) {
        console.error('Error fetching user stats:', error);
        return {
          totalMatches: 0,
          totalWins: 0,
          averageRanking: 0,
        };
      }
    },
    enabled: !!userId,
  });
};
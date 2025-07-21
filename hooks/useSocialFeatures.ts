// hooks/useSocialFeatures.ts

import { supabase } from '@/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '../app/_layout';
import { Comment, Post } from '../types/social';

export const useUserProfile = () => {
  const { session } = useAuth();
  const user = session?.user;

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!user,
  });
};

export const useUserCommunities = () => {
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
  });

  // --- THIS useEffect IS NOW MORE ROBUST ---
  useEffect(() => {
    // Only proceed if we have a stable user ID.
    if (!user?.id) return;

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
      // It's good practice to unsubscribe before removing the channel.
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]); // Depend on the stable user.id string.

  return queryInfo;
};

export const usePosts = (communityId?: number) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ['posts', communityId],
    queryFn: async () => {
      // First, get posts with counts from the RPC function
      const { data: postsWithCounts, error: rpcError } = await supabase.rpc('get_posts_with_counts', {
        community_id_param: communityId || null
      });
      
      if (rpcError) throw rpcError;
      
      // Then, get the image_url field and community info separately
      const postIds = postsWithCounts.map((p: any) => p.id);
      const { data: postDetails, error: detailsError } = await supabase
        .from('posts')
        .select('id, image_url, community_id, communities(name)')
        .in('id', postIds);
        
      if (detailsError) throw detailsError;
      
      // Create maps for quick lookup
      const detailsMap = postDetails.reduce((acc: any, post: any) => {
        acc[post.id] = {
          image_url: post.image_url,
          community_name: post.communities?.name
        };
        return acc;
      }, {});
      
      // Combine the data
      const combinedPosts = postsWithCounts.map((post: any) => ({
        ...post,
        image_url: detailsMap[post.id]?.image_url || null,
        community_name: detailsMap[post.id]?.community_name || null
      }));
      
      return combinedPosts as Post[];
    },
  });

  const { data: userVotes } = useQuery({
    // Proactively added type annotation to prevent 'any' type error
    queryKey: ['userVotes', user?.id, posts?.map((p: Post) => p.id)],
    queryFn: async () => {
      if (!user || !posts || posts.length === 0) return {};
      
      const { data, error } = await supabase
        .from('votes')
        .select('post_id, vote_type')
        .eq('user_id', user.id)
        .in('post_id', posts.map((p: Post) => p.id));
        
      if (error) throw error;
      
      return data.reduce((acc, vote) => {
        acc[vote.post_id] = vote.vote_type;
        return acc;
      }, {} as Record<number, -1 | 1>);
    },
    enabled: !!user && !!posts && posts.length > 0,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: number; voteType: -1 | 1 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from('votes').delete().eq('id', existingVote.id);
        } else {
          await supabase.from('votes').update({ vote_type: voteType }).eq('id', existingVote.id);
        }
      } else {
        await supabase.from('votes').insert({ post_id: postId, user_id: user.id, vote_type: voteType });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userVotes'] });
    },
  });

  const handleVote = (postId: number, voteType: -1 | 1) => {
    voteMutation.mutate({ postId, voteType });
  };

  return { posts, isLoading, refetch, handleVote, userVotes };
};

export const usePost = (postId: number) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*, communities(name)')
        .eq('id', postId)
        .single();
      if (error) throw error;
      
      const { data: counts } = await supabase.rpc('get_posts_with_counts', {
        community_id_param: null
      });
      
      const postCounts = counts.find((p: Post) => p.id === postId);

      return {
        ...data,
        like_count: postCounts?.like_count || 0,
        comment_count: postCounts?.comment_count || 0,
        community_name: data.communities?.name || null,
      } as Post;
    },
    enabled: !isNaN(postId),
  });

  const { data: userVote } = useQuery({
    queryKey: ['userVote', postId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('votes').select('vote_type').eq('post_id', postId).eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      // --- THIS IS THE FIX ---
      // If data?.vote_type is undefined (because data is null), return null instead.
      return data?.vote_type ?? null;
    },
    enabled: !!user && !isNaN(postId),
  });

  const voteMutation = useMutation({
    mutationFn: async (voteType: -1 | 1) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existingVote } = await supabase.from('votes').select('*').eq('post_id', postId).eq('user_id', user.id).single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from('votes').delete().eq('id', existingVote.id);
        } else {
          await supabase.from('votes').update({ vote_type: voteType }).eq('id', existingVote.id);
        }
      } else {
        await supabase.from('votes').insert({ post_id: postId, user_id: user.id, vote_type: voteType });
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
      communityType
    }: {
      title: string;
      content: string;
      imageUri: string | null;
      communityId: number;
      communityType: 'general' | 'school';
    }) => {
       if (typeof communityId !== 'number' || isNaN(communityId)) {
        throw new Error('A valid community ID is required to create a post.');
      }

      if (!user || !profile) {
        throw new Error('Not authenticated or profile not loaded');
      }

      let image_url = null;

      if (imageUri) {
        console.log('[DEBUG] Starting image upload for URI:', imageUri);
        try {
          const fileName = `${user.id}-${Date.now()}.jpg`;
          
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            // For React Native (iOS/Android), use expo-file-system
            console.log('[DEBUG] Using expo-file-system for mobile upload...');
            
            // Read the file as base64
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            console.log('[DEBUG] Image converted to base64, length:', base64.length);
            
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
            console.log('[DEBUG] Decoded image data, size:', imageData.length);
            
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
            
            console.log('[DEBUG] Upload successful:', uploadData);
          } else {
            // For web platform, use standard fetch
            console.log('[DEBUG] Using standard fetch for web upload...');
            const response = await fetch(imageUri);
            const blob = await response.blob();
            console.log('[DEBUG] Image fetched as blob, size:', blob.size);
            
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
            
            console.log('[DEBUG] Upload successful:', uploadData);
          }

          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from('post-images')
            .getPublicUrl(fileName);
          
          console.log('[DEBUG] Got public URL:', publicUrl);
          
          // Verify the URL is accessible
          try {
            const testResponse = await fetch(publicUrl, { method: 'HEAD' });
            console.log('[DEBUG] URL verification status:', testResponse.status);
            if (!testResponse.ok) {
              console.warn('[DEBUG] Warning: Public URL might not be accessible');
            }
          } catch (e) {
            console.warn('[DEBUG] Could not verify URL accessibility:', e);
          }
          
          image_url = publicUrl;

        } catch (e) {
          console.error('[DEBUG] An error occurred during the image handling process:', e);
          throw new Error('Failed to upload image: ' + (e instanceof Error ? e.message : 'Unknown error'));
        }
      }

      console.log('[DEBUG] Inserting post into database with image_url:', image_url);
      const { data, error } = await supabase
        .from('posts')
        .insert({
          title,
          content,
          image_url,
          user_id: user.id,
          community_id: communityId,
          author_name: profile.nickname || profile.first_name || 'Anonymous',
          author_avatar_icon: profile.avatar_icon,
          author_avatar_icon_color: profile.avatar_icon_color,
          author_avatar_background_color: profile.avatar_background_color,
        })
        .select()
        .single();

      if (error) {
        console.error('[DEBUG] Error inserting post into database:', error);
        throw error;
      }

      console.log('[DEBUG] Post successfully inserted into database.');
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      Alert.alert('Success', 'Post created successfully!');
      
      router.push('./(tabs)/feed/');
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


export const useComments = (postId: number) => {
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
        .eq('post_id', postId)
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
    enabled: !isNaN(postId),
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: number }) => {
      if (!user || !profile) throw new Error('Not authenticated or profile not loaded');

      const { error } = await supabase.from('comments').insert({
          content,
          post_id: postId,
          user_id: user.id,
          parent_comment_id: parentId,
          author_name: profile.nickname || profile.first_name || 'Anonymous',
          author_avatar_icon: profile.avatar_icon,
          author_avatar_icon_color: profile.avatar_icon_color,
          author_avatar_background_color: profile.avatar_background_color,
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

export const useRealtimeUpdates = (communityId?: number) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Use more specific channel names to prevent conflicts
    const channelId = `public-posts-and-votes-for-community-${communityId || 'all'}`;
    const channel = supabase.channel(channelId);

    // Check state before subscribing
    if (channel.state !== 'joined') {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'posts', filter: communityId ? `community_id=eq.${communityId}` : undefined },
          () => queryClient.invalidateQueries({ queryKey: ['posts', communityId] })
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'votes' },
          () => queryClient.invalidateQueries({ queryKey: ['posts'] }) // Invalidate all posts on any vote
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId, queryClient]);
};
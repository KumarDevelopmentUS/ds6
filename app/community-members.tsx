// app/community-members.tsx
import { CommunitySettingsPanel } from '@/components/CommunitySettingsPanel';
import { HapticBackButton } from '@/components/HapticBackButton';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type UserProfile = {
  id: string;
  username: string;
  nickname: string;
  school: string;
  avatar_icon: keyof typeof Ionicons.glyphMap;
  avatar_icon_color: string;
  avatar_background_color: string;
};

type Community = {
  id: number;
  name: string;
  type: string;
};

export default function CommunityMembersScreen() {
  const router = useRouter();
  const { communityId, communityName } = useLocalSearchParams();
  const { session } = useAuth();
  const { theme } = useTheme();
  
  // Process community name to use proper school display name if needed
  const displayCommunityName = (() => {
    if (typeof communityName !== 'string') return 'Community';
    
    // If it looks like a school identifier (contains underscores), try to get the proper school name
    if (communityName.includes('_') && communityName !== 'All Communities') {
      const school = getSchoolByValue(communityName);
      return school ? school.name : communityName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return communityName;
  })();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [userJoinDate, setUserJoinDate] = useState<string>('');
  const currentUserId = session?.user?.id;
  const styles = createStyles(theme);

  useEffect(() => {
    if (currentUserId) {
      fetchUserCommunities();
      fetchFriendships();
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId && userCommunities.length > 0) {
      fetchMembers();
    }
  }, [communityId, currentUserId, userCommunities]);

  const fetchUserCommunities = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('user_communities')
        .select('communities(*), joined_at')
        .eq('user_id', currentUserId);

      if (error) throw error;

      const communities = data
        .map(uc => uc.communities)
        .flat()
        .filter(Boolean) as Community[];
      setUserCommunities(communities);

      // Get the join date for the current community if viewing a specific community
      if (communityId !== 'all') {
        const currentCommunity = data.find(uc => (uc.communities as any)?.id === parseInt(communityId as string));
        if (currentCommunity?.joined_at) {
          setUserJoinDate(currentCommunity.joined_at);
        }
      }
    } catch (error) {
      console.error('Error fetching user communities:', error);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      let memberIds: string[] = [];

      if (communityId === 'all') {
        // Get all members from all user's communities
        const communityIds = userCommunities.map(c => c.id);
        if (communityIds.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_communities')
          .select('user_id')
          .in('community_id', communityIds);

        if (error) throw error;
        memberIds = [...new Set(data.map(m => m.user_id))]; // Remove duplicates
      } else {
        // Get members from specific community
        const { data, error } = await supabase
          .from('user_communities')
          .select('user_id')
          .eq('community_id', parseInt(communityId as string));

        if (error) throw error;
        memberIds = data.map(m => m.user_id);
      }

      // Keep all members including current user
      // memberIds = memberIds.filter(id => id !== currentUserId); // Removed this line

      if (memberIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Fetch user profiles with all needed data
      const { data: userProfiles, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', memberIds);

      if (error) throw error;

      // Map the data directly from unified user_profiles
      const combinedMembers = userProfiles.map(up => {
        return {
          id: up.id,
          username: up.username,
          nickname: up.nickname || up.display_name || up.username,
          school: getSchoolByValue(up.school)?.name || 'N/A',
          avatar_icon: up.avatar_icon || 'person',
          avatar_icon_color: up.avatar_icon_color || '#FFFFFF',
          avatar_background_color: up.avatar_background_color || '#007AFF',
        };
      });

      setMembers(combinedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      Alert.alert('Error', 'Could not load community members');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendships = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`);

      if (error) throw error;

      const friendIds = new Set<string>();
      const pendingIds = new Set<string>();

      data.forEach(rel => {
        const otherUserId = rel.user_id_1 === currentUserId ? rel.user_id_2 : rel.user_id_1;
        if (rel.status === 'accepted') {
          friendIds.add(otherUserId);
        } else if (rel.status === 'pending' && rel.user_id_1 === currentUserId) {
          pendingIds.add(otherUserId);
        }
      });

      setFriends(friendIds);
      setPendingRequests(pendingIds);
    } catch (error) {
      console.error('Error fetching friendships:', error);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('friends')
        .insert({ 
          user_id_1: currentUserId, 
          user_id_2: friendId, 
          status: 'pending' 
        });

      if (error) {
        if (error.code === '23505') { // Duplicate key error
          Alert.alert('Error', 'Friend request already sent');
        } else {
          throw error;
        }
      } else {
        Alert.alert('Success', 'Friend request sent!');
        setPendingRequests(prev => new Set(prev).add(friendId));
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Could not send friend request');
    }
  };

  const renderMember = ({ item }: { item: UserProfile }) => {
    const isFriend = friends.has(item.id);
    const isPending = pendingRequests.has(item.id);
    const isCurrentUser = item.id === currentUserId;

    return (
      <TouchableOpacity onPress={() => router.push(`/user-profile/${item.id}`)}>
        <View style={styles.memberCard}>
          <View style={styles.memberInfo}>
            <View style={[styles.avatar, { backgroundColor: item.avatar_background_color }]}>
              <Ionicons name={item.avatar_icon} size={24} color={item.avatar_icon_color} />
            </View>
            <View style={styles.textInfo}>
              <Text style={styles.nickname}>{item.nickname}</Text>
              <Text style={styles.username}>@{item.username}</Text>
              {item.school && item.school !== 'N/A' && (
                <Text style={styles.school}>{item.school}</Text>
              )}
              
              {/* TODO: Re-enable quick stats preview - need to implement proper hooks pattern
                  Options:
                  1. Move useUserStats to component level and pass data down
                  2. Use context/state management for user stats
                  3. Pre-fetch stats when component mounts
                  
                  Current issue: useUserStats hook cannot be called inside renderMember function
                  due to React Rules of Hooks violation */}
              {/* <View style={styles.quickStats}>
                <View style={styles.quickStatItem}>
                  <Ionicons name="trophy" size={14} color="#fbbf24" />
                  <Text style={styles.quickStatText}>...</Text>
                  <Text style={styles.quickStatLabel}>Matches</Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.quickStatText}>...</Text>
                  <Text style={styles.quickStatLabel}>Ranking</Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                  <Text style={styles.quickStatText}>...</Text>
                  <Text style={styles.quickStatLabel}>Wins</Text>
                </View>
              </View> */}
            </View>
          </View>

          {isCurrentUser ? (
            <View style={[styles.statusButton, styles.youButton]}>
              <Text style={styles.youButtonText}>You</Text>
            </View>
          ) : isFriend ? (
            <View style={[styles.statusButton, styles.friendButton]}>
              <Text style={styles.friendButtonText}>Friends</Text>
            </View>
          ) : isPending ? (
            <View style={[styles.statusButton, styles.pendingButton]}>
              <Text style={styles.pendingButtonText}>Requested</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.statusButton, styles.addButton]}
              onPress={() => handleAddFriend(item.id)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <HapticBackButton 
          onPress={() => router.back()} 
          style={styles.backButton}
          color={theme.colors.primary}
          text=""
        />
        <Text style={styles.headerTitle}>{displayCommunityName} Members</Text>
        {communityId !== 'all' && communityId && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No other members in this community yet</Text>
            </View>
          }
                  />
        )}

        {/* Community Settings Panel */}
        {communityId !== 'all' && communityId && (
          <CommunitySettingsPanel
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            communityId={typeof communityId === 'string' ? communityId : communityId[0] || ''}
            communityName={typeof communityName === 'string' ? communityName : communityName[0] || ''}
            joinedAt={userJoinDate}
            onLeaveCommunity={() => {
              setSettingsVisible(false);
              // Navigate back since user is no longer in the community
              router.back();
            }}
          />
        )}
      </SafeAreaView>
    );
  }

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingsButton: {
    padding: 4,
    width: 40,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: theme.dark ? 0.3 : 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textInfo: {
    flex: 1,
  },
  nickname: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  school: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
  },
  addButtonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  friendButton: {
    backgroundColor: theme.dark ? theme.colors.backgroundTertiary : '#e8f4ff',
  },
  friendButtonText: {
    color: theme.colors.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  pendingButton: {
    backgroundColor: theme.colors.backgroundTertiary,
  },
  pendingButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
    fontSize: 14,
  },
  youButton: {
    backgroundColor: theme.colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  youButtonText: {
    color: theme.colors.textTertiary,
    fontWeight: '500',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
});
// app/community-members.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  SafeAreaView
} from 'react-native';
import { useAuth } from './_layout';

type UserProfile = {
  id: string;
  username: string;
  nickname: string;
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
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const currentUserId = session?.user?.id;

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
        .select('communities(*)')
        .eq('user_id', currentUserId);

      if (error) throw error;

      const communities = data
        .map(uc => uc.communities)
        .flat()
        .filter(Boolean) as Community[];
      setUserCommunities(communities);
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

      // Remove current user from the list
      memberIds = memberIds.filter(id => id !== currentUserId);

      if (memberIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Fetch user profiles
      const { data: userProfiles, error: userError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name')
        .in('id', memberIds);

      if (userError) throw userError;

      // Fetch profile details
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', memberIds);

      if (profileError) throw profileError;

      // Combine the data
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      const combinedMembers = userProfiles.map(up => {
        const profile = profileMap.get(up.id);
        return {
          id: up.id,
          username: up.username,
          nickname: profile?.nickname || up.display_name || up.username,
          avatar_icon: profile?.avatar_icon || 'person',
          avatar_icon_color: profile?.avatar_icon_color || '#FFFFFF',
          avatar_background_color: profile?.avatar_background_color || '#007AFF',
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

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={[styles.avatar, { backgroundColor: item.avatar_background_color }]}>
            <Ionicons name={item.avatar_icon} size={24} color={item.avatar_icon_color} />
          </View>
          <View style={styles.textInfo}>
            <Text style={styles.nickname}>{item.nickname}</Text>
            <Text style={styles.username}>@{item.username}</Text>
          </View>
        </View>

        {isFriend ? (
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
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{communityName} Members</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
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
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
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
    color: '#000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  friendButton: {
    backgroundColor: '#e8f4ff',
  },
  friendButtonText: {
    color: '#007AFF',
    fontWeight: '500',
    fontSize: 14,
  },
  pendingButton: {
    backgroundColor: '#f0f0f0',
  },
  pendingButtonText: {
    color: '#666',
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
    color: '#666',
    textAlign: 'center',
  },
});
// app/friends.tsx (Social page)
import { CommunityIcon } from '@/components/CommunityIcon';
import { HapticBackButton } from '@/components/HapticBackButton';
import { UserAvatar } from '@/components/social/UserAvatar';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { ThemedButton } from '../components/themed/ThemedButton';
import { ThemedInput } from '../components/themed/ThemedInput';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedView } from '../components/themed/ThemedView';
import { getSchoolByValue } from '../constants/schools';
import { useFeed } from '../contexts/FeedContext';
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

type FriendRequest = UserProfile & {
  request_direction: 'incoming' | 'outgoing';
};

type UserStats = {
  total_matches: number;
  total_wins: number;
  win_rate: number;
  total_throws: number;
  total_hits: number;
  hit_rate: number;
  total_catches: number;
  catch_rate: number;
  avg_score: number;
};

export default function FriendsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [pendingSentIds, setPendingSentIds] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<'friends' | 'invites'>('friends');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [schoolmates, setSchoolmates] = useState<UserProfile[]>([]);
  const [friendsOfFriends, setFriendsOfFriends] = useState<UserProfile[]>([]);
  const [loadingExpand, setLoadingExpand] = useState(false);
  
  // Dropdown state for expand sections
  const [showFriendsOfFriends, setShowFriendsOfFriends] = useState(false);
  const [showSchoolmates, setShowSchoolmates] = useState(false);

  const [viewingProfileOf, setViewingProfileOf] = useState<UserProfile | null>(null);
  const [viewingProfileStats, setViewingProfileStats] = useState<UserStats | null>(null);
  const [loadingProfileStats, setLoadingProfileStats] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Community invites state
  const [communityInvites, setCommunityInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [respondingToInvite, setRespondingToInvite] = useState<Set<number>>(new Set());
  const { refetch: refetchCommunities } = useFeed();

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        fetchFriendsAndRequests(user.id);
        fetchCommunityInvites();
        fetchExpandNetworkData(user.id);
      } else {
        setLoading(false);
      }
    };
    initialize();
  }, []);

  // Refresh invites when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        fetchCommunityInvites();
      }
    }, [currentUser])
  );

  const fetchCommunityInvites = async () => {
    setLoadingInvites(true);
    try {
      const { data, error } = await supabase.rpc('get_pending_invites');
      if (error) throw error;
      setCommunityInvites(data || []);
    } catch (error) {
      console.error('Error loading community invites:', error);
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleRespondToInvite = async (communityId: number, accept: boolean) => {
    setRespondingToInvite((prev) => new Set(prev).add(communityId));

    try {
      const { data, error } = await supabase.rpc('respond_to_invite', {
        p_community_id: communityId,
        p_accept: accept,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to respond to invite');
      }

      // Remove from local state
      setCommunityInvites((prev) => prev.filter((inv) => inv.community_id !== communityId));

      // Refresh communities if accepted
      if (accept) {
        refetchCommunities();
      }

      const message = accept ? 'You have joined the community!' : 'Invite declined.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Success', message);
      }
    } catch (error: any) {
      console.error('Error responding to invite:', error);
      if (Platform.OS === 'web') {
        alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to respond to invite');
      }
    } finally {
      setRespondingToInvite((prev) => {
        const newSet = new Set(prev);
        newSet.delete(communityId);
        return newSet;
      });
    }
  };

  // Debounced search effect
  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, currentUser]);

  const combineProfileData = (userProfile: any): UserProfile => {
    return {
      id: userProfile.id,
      username: userProfile.username,
      nickname: userProfile.nickname || userProfile.display_name,
      school: getSchoolByValue(userProfile.school)?.name || 'N/A',
      avatar_icon: userProfile.avatar_icon || 'person',
      avatar_icon_color: userProfile.avatar_icon_color || '#FFFFFF',
      avatar_background_color: userProfile.avatar_background_color || theme.colors.primary,
    };
  };

  const fetchFullProfiles = async (ids: string[]): Promise<Map<string, UserProfile>> => {
    const fullProfileMap = new Map<string, UserProfile>();
    if (ids.length === 0) return fullProfileMap;

    const { data: userProfiles, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
      .in('id', ids);

    if (error) {
      console.error("Profile loading error:", error);
      Alert.alert('Error', 'Could not load profile data.');
      return fullProfileMap;
    }

    userProfiles.forEach(up => {
      fullProfileMap.set(up.id, combineProfileData(up));
    });

    return fullProfileMap;
  };

  const fetchFriendsAndRequests = async (userId: string) => {
    setLoading(true);
    const { data: relationships, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (error) {
      Alert.alert('Error', 'Could not fetch your friends list.');
      setLoading(false);
      return;
    }

    const friendIds = new Set<string>();
    const requestDetails: { id: string, direction: 'incoming' | 'outgoing' }[] = [];

    relationships.forEach(rel => {
      const otherUserId = rel.user_id_1 === userId ? rel.user_id_2 : rel.user_id_1;
      if (rel.status === 'accepted') {
        friendIds.add(otherUserId);
      } else if (rel.status === 'pending') {
        requestDetails.push({ id: otherUserId, direction: rel.user_id_2 === userId ? 'incoming' : 'outgoing' });
      }
    });

    setPendingSentIds(new Set(requestDetails.filter(r => r.direction === 'outgoing').map(r => r.id)));

    const allRelatedIds = [...new Set([...Array.from(friendIds), ...requestDetails.map(r => r.id)])];
    const fullProfileMap = await fetchFullProfiles(allRelatedIds);

    const friendsList = Array.from(friendIds).map(id => fullProfileMap.get(id)).filter(Boolean) as UserProfile[];
    const requestsList = requestDetails.map(req => {
      const profile = fullProfileMap.get(req.id);
      return profile ? { ...profile, request_direction: req.direction } : null;
    }).filter(Boolean) as FriendRequest[];
      
    setFriends(friendsList);
    setFriendRequests(requestsList);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!currentUser) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    
    const { data: foundUsers, error } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', currentUser.id);

    if (error) {
      console.error("Search Error Details:", error);
      Alert.alert('Search Error', 'Could not perform the user search.');
      setSearchLoading(false);
      return;
    }

    const foundIds = foundUsers.map(u => u.id);
    const fullProfilesMap = await fetchFullProfiles(foundIds);
    setSearchResults(Array.from(fullProfilesMap.values()));
    setSearchLoading(false);
  };
  
  const handleAddFriend = async (friendId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('friends').insert({ user_id_1: currentUser.id, user_id_2: friendId, status: 'pending' });
    if (error) { Alert.alert('Error', 'Could not send friend request. You may have already sent one.'); } 
    else { Alert.alert('Success', 'Friend request sent!'); setPendingSentIds(prev => new Set(prev).add(friendId)); }
  };

  const handleAcceptRequest = async (friendId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('user_id_1', friendId).eq('user_id_2', currentUser.id);
    if (error) { Alert.alert('Error', 'Could not accept friend request.'); } 
    else { Alert.alert('Success', 'Friend request accepted!'); fetchFriendsAndRequests(currentUser.id); }
  };

  const handleDeclineRequest = async (friendId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('friends').delete().eq('user_id_1', friendId).eq('user_id_2', currentUser.id);
    if (error) { Alert.alert('Error', 'Could not decline friend request.'); } 
    else { Alert.alert('Success', 'Friend request declined.'); fetchFriendsAndRequests(currentUser.id); }
  };

  const handleCancelRequest = async (friendId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('friends').delete().eq('user_id_1', currentUser.id).eq('user_id_2', friendId);
    if (error) { Alert.alert('Error', 'Could not cancel friend request.'); } 
    else { 
      Alert.alert('Success', 'Friend request cancelled.'); 
      setPendingSentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
      fetchFriendsAndRequests(currentUser.id); 
    }
  };
  
  const mapRpcProfileData = (rpcProfile: any): UserProfile | null => {
    if (!rpcProfile) return null;
    return {
      id: rpcProfile.id,
      username: rpcProfile.username,
      nickname: rpcProfile.nickname,
      school: getSchoolByValue(rpcProfile.school)?.name || 'N/A',
      avatar_icon: rpcProfile.avatar_icon || 'person',
      avatar_icon_color: rpcProfile.avatar_icon_color || '#FFFFFF',
      avatar_background_color: rpcProfile.avatar_background_color || theme.colors.primary,
    };
  };

  const fetchExpandNetworkData = async (userId: string) => {
    setLoadingExpand(true);
    
    try {
      const { data: currentUserProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('school')
        .eq('id', userId)
        .single();
      
      if (userError) {
        console.error("Error fetching current user profile:", userError);
        setLoadingExpand(false);
        return;
      }
      
      const [schoolResponse, fofResponse] = await Promise.all([
        supabase.rpc('get_schoolmates', { input_user_id: userId }),
        supabase.rpc('get_friends_of_friends', { p_user_id: userId })
      ]);
      
      if (schoolResponse.error) {
        console.error("Error fetching schoolmates via RPC:", schoolResponse.error);
        
        if (currentUserProfile?.school) {
          const { data: directSchoolmates, error: directError } = await supabase
            .from('user_profiles')
            .select('id, username, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
            .eq('school', currentUserProfile.school)
            .neq('id', userId);
          
          if (directError) {
            console.error("Error with direct schoolmates query:", directError);
            setSchoolmates([]);
          } else {
            setSchoolmates(directSchoolmates?.map(mapRpcProfileData).filter(Boolean) as UserProfile[] || []);
          }
        } else {
          setSchoolmates([]);
        }
      } else {
        setSchoolmates(schoolResponse.data?.map(mapRpcProfileData).filter(Boolean) as UserProfile[] || []);
      }
      
      if (fofResponse.error) {
        console.error("Error fetching friends of friends via RPC:", fofResponse.error);
        setFriendsOfFriends([]);
      } else {
        setFriendsOfFriends(fofResponse.data?.map(mapRpcProfileData).filter(Boolean) as UserProfile[] || []);
      }
      
    } catch (error) {
      console.error("Unexpected error in fetchExpandNetworkData:", error);
      setSchoolmates([]);
      setFriendsOfFriends([]);
    } finally {
      setLoadingExpand(false);
    }
  };

  const handleViewProfile = async (friend: UserProfile) => {
    setViewingProfileOf(friend);
    setLoadingProfileStats(true);
    const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: friend.id });
    if (error) {
      Alert.alert("Error", "Could not fetch this user's stats.");
      console.error(error);
    } else if (data && data.length > 0) {
      setViewingProfileStats(data[0]);
    } else {
      setViewingProfileStats(null);
    }
    setLoadingProfileStats(false);
  };

  const renderUserCard = ({ item, showActions = false }: { item: UserProfile, showActions?: boolean }) => {
    const isFriend = friends.some(f => f.id === item.id);
    
    const renderActionButton = () => {
      if (isFriend) {
        return <ThemedButton title="Friends" size="small" disabled={true} />;
      } else if (pendingSentIds.has(item.id)) {
        return <ThemedButton title="Requested" size="small" disabled={true} />;
      } else {
        return <ThemedButton title="Add Friend" size="small" onPress={() => handleAddFriend(item.id)} />;
      }
    };

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/user-profile/${item.id}`)}
        activeOpacity={0.7}
      >
        <ThemedView variant="card" style={styles.userCard}>
          <UserAvatar
            profilePictureUrl={null}
            icon={item.avatar_icon}
            iconColor={item.avatar_icon_color}
            backgroundColor={item.avatar_background_color}
            size={52}
          />
          <View style={styles.userInfo}>
            <ThemedText variant="body" style={styles.username}>{item.nickname}</ThemedText>
            <ThemedText variant="caption" style={styles.userHandle}>{`@${item.username}`}</ThemedText>
            {item.school && (
              <View style={styles.schoolContainer}>
                <Ionicons name="school-outline" size={12} color={theme.colors.textSecondary} />
                <ThemedText variant="caption" style={styles.schoolText} numberOfLines={1}>
                  {item.school}
                </ThemedText>
              </View>
            )}
          </View>
          {showActions ? renderActionButton() : <Ionicons name="chevron-forward" size={22} color={theme.colors.textSecondary} />}
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const renderFriendRequestCard = ({ item, type }: { item: FriendRequest, type: 'incoming' | 'outgoing' }) => {
    return (
      <ThemedView variant="card" style={styles.userCard}>
        <UserAvatar
          profilePictureUrl={null}
          icon={item.avatar_icon}
          iconColor={item.avatar_icon_color}
          backgroundColor={item.avatar_background_color}
          size={52}
        />
        <View style={styles.userInfo}>
          <ThemedText variant="body" style={styles.username}>{item.nickname}</ThemedText>
          <ThemedText variant="caption" style={styles.userHandle}>{`@${item.username}`}</ThemedText>
        </View>
        {type === 'incoming' ? (
          <View style={styles.requestButtons}>
            <ThemedButton title="Accept" size="small" variant="primary" onPress={() => handleAcceptRequest(item.id)} />
            <ThemedButton title="Decline" size="small" variant="outline" onPress={() => handleDeclineRequest(item.id)} />
          </View>
        ) : (
          <ThemedButton title="Cancel" size="small" variant="outline" onPress={() => handleCancelRequest(item.id)} />
        )}
      </ThemedView>
    );
  };

  const renderCommunityInviteCard = (item: any) => {
    const isResponding = respondingToInvite.has(item.community_id);
    return (
      <View style={[styles.inviteCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.inviteContent}>
          <CommunityIcon
            icon={item.community_icon}
            iconColor={item.community_icon_color}
            backgroundColor={item.community_background_color}
            size={52}
          />
          <View style={styles.inviteInfo}>
            <ThemedText variant="body" style={styles.inviteCommunityName}>
              {item.community_name}
            </ThemedText>
            <ThemedText variant="caption" style={{ color: theme.colors.textSecondary }}>
              Invited by {item.inviter_name}
            </ThemedText>
            <ThemedText variant="caption" style={{ color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 }}>
              {new Date(item.created_at).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>
        <View style={styles.inviteActions}>
          <TouchableOpacity
            style={[styles.inviteDeclineButton, { borderColor: theme.colors.border }]}
            onPress={() => handleRespondToInvite(item.community_id, false)}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color={theme.colors.textSecondary} />
            ) : (
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inviteAcceptButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => handleRespondToInvite(item.community_id, true)}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderExpandSection = (title: string, data: UserProfile[], isOpen: boolean, onToggle: () => void, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.expandSection}>
      <TouchableOpacity 
        style={[styles.expandHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} 
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.expandHeaderLeft}>
          <Ionicons name={icon} size={20} color={theme.colors.primary} />
          <ThemedText variant="body" style={styles.expandHeaderText}>{title}</ThemedText>
          <View style={[styles.countBadge, { backgroundColor: theme.colors.primary + '20' }]}>
            <ThemedText variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
              {data.length}
            </ThemedText>
          </View>
        </View>
        <Ionicons 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={theme.colors.textSecondary} 
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.expandContent}>
          {loadingExpand ? (
            <ActivityIndicator style={{ marginVertical: 20 }} size="small" />
          ) : data.length > 0 ? (
            data.map(item => (
              <View key={item.id}>
                {renderUserCard({ item, showActions: true })}
              </View>
            ))
          ) : (
            <View style={styles.emptyStateSmall}>
              <ThemedText variant="caption" style={styles.emptyTextSmall}>
                No users found
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </View>
  );
  
  const renderProfileStatsView = () => {
    const friend = viewingProfileOf!;
    return (
      <View style={styles.fullScreenView}>
        <View style={styles.profileHeader}>
            <HapticBackButton 
              style={styles.backButtonInline} 
              onPress={() => setViewingProfileOf(null)}
              text="Back to Friends"
              color={theme.colors.primary}
            />
        </View>

        <ScrollView contentContainerStyle={styles.profileContent}>
            <View style={styles.profileInfoContainer}>
                <View style={[styles.profileAvatar, { backgroundColor: friend.avatar_background_color }]}>
                    <Ionicons name={friend.avatar_icon} size={50} color={friend.avatar_icon_color} />
                </View>
                <ThemedText variant='title'>{friend.nickname}</ThemedText>
                <ThemedText variant='body' color='primary'>{`@${friend.username}`}</ThemedText>
            </View>

            {loadingProfileStats ? <ActivityIndicator style={{ marginTop: 20 }} size="large" /> :
                viewingProfileStats ? (
                    <ThemedView variant="card" style={styles.statsCard}>
                        <ThemedText variant='subtitle' style={styles.statsTitle}>Player Stats</ThemedText>
                        <View style={styles.statRow}><ThemedText>Games Played</ThemedText><ThemedText variant='body' color='primary'>{viewingProfileStats.total_matches}</ThemedText></View>
                        <View style={styles.statRow}><ThemedText>Win Rate</ThemedText><ThemedText variant='body' color='primary'>{viewingProfileStats.win_rate.toFixed(1)}%</ThemedText></View>
                        <View style={styles.statRow}><ThemedText>Average Score</ThemedText><ThemedText variant='body' color='primary'>{viewingProfileStats.avg_score.toFixed(1)}</ThemedText></View>
                        <View style={styles.statRow}><ThemedText>Hit Rate</ThemedText><ThemedText variant='body' color='primary'>{viewingProfileStats.hit_rate.toFixed(1)}%</ThemedText></View>
                        <View style={styles.statRow}><ThemedText>Catch Rate</ThemedText><ThemedText variant='body' color='primary'>{viewingProfileStats.catch_rate.toFixed(1)}%</ThemedText></View>
                    </ThemedView>
                ) : <ThemedText style={styles.emptyText}>No stats available for this user.</ThemedText>
            }
        </ScrollView>
      </View>
    );
  };
  
  if (viewingProfileOf) {
    return <ThemedView style={styles.container}>{renderProfileStatsView()}</ThemedView>;
  }

  const incomingRequests = friendRequests.filter(r => r.request_direction === 'incoming');
  const outgoingRequests = friendRequests.filter(r => r.request_direction === 'outgoing');
  const totalInvitesBadge = incomingRequests.length + communityInvites.length;

  return (
    <ThemedView style={styles.container}>
      <HapticBackButton
        onPress={() => router.back()}
        style={styles.backButton}
        color={theme.colors.primary}
      />

      <View style={styles.tabContainer}>
        {['friends', 'invites'].map((tab) => {
          const badgeCount = tab === 'invites' ? totalInvitesBadge : 0;
          const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
          
          return (
          <TouchableOpacity 
            key={tab} 
            style={[
              styles.tab, 
              currentTab === tab && styles.activeTab, 
              currentTab === tab && { borderBottomColor: theme.colors.primary }
            ]} 
            onPress={() => setCurrentTab(tab as any)}
          >
            <View style={styles.tabContent}>
              <ThemedText 
                variant={currentTab === tab ? 'subtitle' : 'body'}
                style={[
                  styles.tabText,
                  currentTab === tab && { color: theme.colors.primary }
                ]}
              >
                  {tabLabel}
              </ThemedText>
                {badgeCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                    <ThemedText style={styles.badgeText}>{badgeCount}</ThemedText>
                </View>
              )}
            </View>
          </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.content}>
        {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" />}

        {/* FRIENDS TAB */}
        {currentTab === 'friends' && !loading && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Search Bar */}
            <View style={styles.searchSection}>
              <ThemedInput 
                placeholder="Search by username..." 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
                icon={searchLoading ? 
                  <ActivityIndicator size={20} color={theme.colors.textSecondary} /> : 
                  <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
                } 
              />
            </View>

            {/* Search Results */}
            {searchQuery.trim() ? (
              <View>
                <ThemedText variant="subtitle" style={styles.sectionTitle}>Search Results</ThemedText>
                {searchLoading ? (
                  <ActivityIndicator style={{ marginVertical: 20 }} size="small" />
                ) : searchResults.length > 0 ? (
                  searchResults.map(item => (
                    <View key={item.id}>
                      {renderUserCard({ item, showActions: true })}
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyStateSmall}>
                    <Ionicons name="search-outline" size={32} color={theme.colors.textSecondary} />
                    <ThemedText variant="caption" style={styles.emptyTextSmall}>
                      No users found matching &quot;{searchQuery}&quot;
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Friends List */}
                <ThemedText variant="subtitle" style={styles.sectionTitle}>Friends</ThemedText>
                {friends.length > 0 ? (
                  friends.map(item => (
                    <View key={item.id}>
                      {renderUserCard({ item, showActions: false })}
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} style={styles.emptyIcon} />
                    <ThemedText variant="subtitle" style={styles.emptyTitle}>No Friends Yet</ThemedText>
                    <ThemedText variant="caption" style={styles.emptyText}>
                      Search for friends above or expand your network below
                    </ThemedText>
                  </View>
                )}

                {/* Expand Network Dropdowns */}
                <ThemedText variant="subtitle" style={[styles.sectionTitle, { marginTop: 24 }]}>
                  Expand Your Network
                </ThemedText>
                
                {renderExpandSection(
                  'Friends of Friends',
                  friendsOfFriends,
                  showFriendsOfFriends,
                  () => setShowFriendsOfFriends(!showFriendsOfFriends),
                  'git-network-outline'
                )}
                
                {renderExpandSection(
                  'From Your School',
                  schoolmates,
                  showSchoolmates,
                  () => setShowSchoolmates(!showSchoolmates),
                  'school-outline'
                )}
                
                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        )}

        {/* INVITES TAB */}
        {currentTab === 'invites' && !loading && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Community Invites */}
            <ThemedText variant="subtitle" style={styles.sectionTitle}>Community Invites</ThemedText>
            {loadingInvites ? (
              <ActivityIndicator style={{ marginVertical: 20 }} size="small" />
            ) : communityInvites.length > 0 ? (
              communityInvites.map(item => (
                <View key={item.invite_id}>
                  {renderCommunityInviteCard(item)}
                </View>
              ))
            ) : (
              <View style={styles.emptyStateSmall}>
                <Ionicons name="home-outline" size={32} color={theme.colors.textSecondary} />
                <ThemedText variant="caption" style={styles.emptyTextSmall}>
                  No pending community invites
                </ThemedText>
              </View>
            )}

            {/* Incoming Friend Requests */}
            <ThemedText variant="subtitle" style={[styles.sectionTitle, { marginTop: 24 }]}>Friend Requests</ThemedText>
            {incomingRequests.length > 0 ? (
              incomingRequests.map(item => (
                <View key={item.id}>
                  {renderFriendRequestCard({ item, type: 'incoming' })}
                </View>
              ))
            ) : (
              <View style={styles.emptyStateSmall}>
                <Ionicons name="mail-outline" size={32} color={theme.colors.textSecondary} />
                <ThemedText variant="caption" style={styles.emptyTextSmall}>
                  No incoming friend requests
                </ThemedText>
              </View>
            )}

            {/* Sent Friend Requests */}
            <ThemedText variant="subtitle" style={[styles.sectionTitle, { marginTop: 24 }]}>Sent Requests</ThemedText>
            {outgoingRequests.length > 0 ? (
              outgoingRequests.map(item => (
                <View key={item.id}>
                  {renderFriendRequestCard({ item, type: 'outgoing' })}
                </View>
              ))
            ) : (
              <View style={styles.emptyStateSmall}>
                <Ionicons name="paper-plane-outline" size={32} color={theme.colors.textSecondary} />
                <ThemedText variant="caption" style={styles.emptyTextSmall}>
                  No pending sent requests
                </ThemedText>
              </View>
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: 60 
  },
  backButton: { 
    position: 'absolute', 
    top: 60, 
    left: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 10 
  },
  tabContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e5e5', 
    marginTop: 40,
    marginHorizontal: 12,
  },
  tab: { 
    flex: 1,
    paddingVertical: 14, 
    borderBottomWidth: 3, 
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  activeTab: { 
    borderBottomWidth: 3,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 12, 
    paddingTop: 16 
  },
  fullScreenView: { 
    flex: 1, 
    paddingTop: 60 
  },
  searchSection: { 
    marginBottom: 16 
  },
  userCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    marginBottom: 12, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userInfo: { 
    flex: 1, 
    marginLeft: 12 
  },
  username: { 
    fontWeight: '600',
    marginBottom: 2,
  },
  userHandle: {
    opacity: 0.7,
    marginBottom: 4,
  },
  schoolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  schoolText: {
    opacity: 0.6,
    fontSize: 12,
  },
  requestButtons: { 
    flexDirection: 'row', 
    gap: 8 
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    opacity: 0.3,
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: { 
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
  },
  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTextSmall: {
    textAlign: 'center',
    opacity: 0.6,
  },
  sectionTitle: { 
    marginBottom: 12, 
    paddingHorizontal: 4, 
    fontWeight: '700',
    fontSize: 16,
  },
  backButtonInline: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  profileHeader: { 
    flexDirection: 'row', 
    justifyContent: 'flex-start', 
    alignItems: 'center', 
    marginBottom: 20, 
    paddingHorizontal: 20 
  },
  profileContent: { 
    paddingVertical: 10 
  },
  profileInfoContainer: { 
    alignItems: 'center', 
    marginBottom: 30, 
    paddingHorizontal: 20 
  },
  profileAvatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  statsCard: { 
    marginHorizontal: 20, 
    padding: 20, 
    borderRadius: 12 
  },
  statsTitle: { 
    textAlign: 'center', 
    marginBottom: 20 
  },
  statRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e5e5' 
  },
  // Expand section styles
  expandSection: {
    marginBottom: 12,
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  expandHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandHeaderText: {
    fontWeight: '500',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  expandContent: {
    marginTop: 8,
    paddingLeft: 8,
  },
  // Community invite styles
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  inviteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inviteInfo: {
    marginLeft: 12,
    flex: 1,
  },
  inviteCommunityName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteDeclineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteAcceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

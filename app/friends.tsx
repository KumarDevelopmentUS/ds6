// app/friends.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedButton } from '../components/themed/ThemedButton';
import { ThemedInput } from '../components/themed/ThemedInput';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedView } from '../components/themed/ThemedView';
import { getSchoolByValue } from '@/constants/schools';
import { useTheme } from '@/contexts/ThemeContext';

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
  const [currentTab, setCurrentTab] = useState<'friends' | 'requests' | 'expand'>('friends');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [schoolmates, setSchoolmates] = useState<UserProfile[]>([]);
  const [friendsOfFriends, setFriendsOfFriends] = useState<UserProfile[]>([]);
  const [loadingExpand, setLoadingExpand] = useState(false);

  const [viewingProfileOf, setViewingProfileOf] = useState<UserProfile | null>(null);
  const [viewingProfileStats, setViewingProfileStats] = useState<UserStats | null>(null);
  const [loadingProfileStats, setLoadingProfileStats] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        fetchFriendsAndRequests(user.id);
      } else {
        setLoading(false);
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (currentTab === 'expand' && currentUser && schoolmates.length === 0 && friendsOfFriends.length === 0) {
      fetchExpandNetworkData(currentUser.id);
    }
  }, [currentTab, currentUser]);

  const combineProfileData = (userProfile: any, secondaryProfile?: any): UserProfile => {
    return {
      id: userProfile.id,
      username: userProfile.username,
      nickname: secondaryProfile?.nickname || userProfile.display_name,
      school: getSchoolByValue(secondaryProfile?.school)?.name || 'N/A',
      avatar_icon: secondaryProfile?.avatar_icon || 'person',
      avatar_icon_color: secondaryProfile?.avatar_icon_color || '#FFFFFF',
      avatar_background_color: secondaryProfile?.avatar_background_color || theme.colors.primary,
    };
  };

  const fetchFullProfiles = async (ids: string[]): Promise<Map<string, UserProfile>> => {
    const fullProfileMap = new Map<string, UserProfile>();
    if (ids.length === 0) return fullProfileMap;

    const { data: userProfiles, error: userProfilesError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name')
      .in('id', ids);

    const { data: secondaryProfiles, error: secondaryProfilesError } = await supabase
      .from('profiles')
      .select('id, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
      .in('id', ids);

    if (userProfilesError || secondaryProfilesError) {
      console.error("Profile loading error:", userProfilesError || secondaryProfilesError);
      Alert.alert('Error', 'Could not load profile data.');
      return fullProfileMap;
    }

    const secondaryProfilesMap = new Map(secondaryProfiles.map(p => [p.id, p]));
    
    userProfiles.forEach(up => {
      const sp = secondaryProfilesMap.get(up.id);
      fullProfileMap.set(up.id, combineProfileData(up, sp));
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
    setLoading(true);
    
    const { data: foundUsers, error } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', currentUser.id);

    if (error) {
      console.error("Search Error Details:", error);
      Alert.alert('Search Error', 'Could not perform the user search.');
      setLoading(false);
      return;
    }

    const foundIds = foundUsers.map(u => u.id);
    const fullProfilesMap = await fetchFullProfiles(foundIds);
    setSearchResults(Array.from(fullProfilesMap.values()));
    setLoading(false);
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
    const [schoolResponse, fofResponse] = await Promise.all([
      supabase.rpc('get_schoolmates', { user_id: userId }),
      supabase.rpc('get_friends_of_friends', { p_user_id: userId })
    ]);
    setLoadingExpand(false);
    if (schoolResponse.error) console.error("Error fetching schoolmates:", schoolResponse.error);
    else setSchoolmates(schoolResponse.data?.map(mapRpcProfileData).filter(Boolean) as UserProfile[] || []);
    if (fofResponse.error) console.error("Error fetching friends of friends:", fofResponse.error);
    else setFriendsOfFriends(fofResponse.data?.map(mapRpcProfileData).filter(Boolean) as UserProfile[] || []);
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
      setViewingProfileStats(null); // No stats returned
    }
    setLoadingProfileStats(false);
  };

  const renderUserProfile = ({ item, from }: { item: UserProfile | FriendRequest, from: 'requests' | 'friends' | 'expand' }) => {
    const isFriend = friends.some(f => f.id === item.id);
    const isRequested = pendingSentIds.has(item.id);

    const renderActionButton = () => {
      if (isFriend) return <ThemedButton title="Friends" size="small" disabled={true} />;
      if (isRequested) return <ThemedButton title="Requested" size="small" disabled={true} />;
      return <ThemedButton title="Add" size="small" onPress={() => handleAddFriend(item.id)} />;
    };

    return (
      <TouchableOpacity disabled={from !== 'friends'} onPress={() => handleViewProfile(item)}>
        <ThemedView variant="card" style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: item.avatar_background_color }]}>
            <Ionicons name={item.avatar_icon} size={30} color={item.avatar_icon_color} />
          </View>
          <View style={styles.userInfo}>
            <ThemedText variant="body" style={styles.username}>{item.nickname}</ThemedText>
            <ThemedText variant="caption">{`@${item.username}`}</ThemedText>
            <ThemedText variant="caption" numberOfLines={1}>{item.school}</ThemedText>
          </View>
          { from === 'expand' && renderActionButton() }
          { 'request_direction' in item && item.request_direction === 'incoming' && (
              <View style={styles.requestButtons}>
                <ThemedButton title="Accept" size="small" variant="primary" onPress={() => handleAcceptRequest(item.id)} />
                <ThemedButton title="Decline" size="small" variant="secondary" onPress={() => handleDeclineRequest(item.id)} />
              </View>
          )}
          { 'request_direction' in item && item.request_direction === 'outgoing' && <ThemedButton title="Requested" size="small" disabled={true} /> }
          { from === 'friends' && <Ionicons name="stats-chart-outline" size={20} color={theme.colors.textSecondary} /> }
        </ThemedView>
      </TouchableOpacity>
    );
  };
  
  const renderProfileStatsView = () => {
    const friend = viewingProfileOf!;
    return (
      <View style={styles.fullScreenView}>
        <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.backButtonInline} onPress={() => setViewingProfileOf(null)}>
                <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
                <ThemedText color='primary' style={{marginLeft: 8}}>Back to Friends</ThemedText>
            </TouchableOpacity>
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

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        <ThemedText style={styles.backText}>Back</ThemedText>
      </TouchableOpacity>

      <View style={styles.tabContainer}>
        {['friends', 'requests', 'expand'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, currentTab === tab && styles.activeTab, {borderColor: theme.colors.primary}]} onPress={() => setCurrentTab(tab as any)}>
            <ThemedText variant={currentTab === tab ? 'subtitle' : 'body'}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'requests' && friendRequests.length > 0 && ` (${friendRequests.length})`}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" />}

        {currentTab === 'friends' && !loading && (
            <FlatList data={friends} renderItem={(props) => renderUserProfile({...props, from: 'friends'})} keyExtractor={(item) => item.id} ListEmptyComponent={<ThemedText style={styles.emptyText}>You have no friends yet.</ThemedText>} />
        )}

        {currentTab === 'requests' && !loading && (
          <SectionList
            sections={[
              { title: 'Incoming Requests', data: friendRequests.filter(r => r.request_direction === 'incoming') },
              { title: 'Sent Requests', data: friendRequests.filter(r => r.request_direction === 'outgoing') },
            ]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderUserProfile({ item, from: 'requests' })}
            renderSectionHeader={({ section: { title, data } }) => (
                data.length > 0 ? <ThemedText variant="subtitle" style={styles.expandSectionTitle}>{title}</ThemedText> : null
            )}
            ListEmptyComponent={<ThemedText style={styles.emptyText}>No new friend requests.</ThemedText>}
          />
        )}
        
        {currentTab === 'expand' && (
          <View style={{flex: 1}}>
            <View style={styles.searchSection}>
              <ThemedInput placeholder="Search by username..." value={searchQuery} onChangeText={setSearchQuery} icon={<Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />} />
              <ThemedButton title="Search" onPress={handleSearch} style={{ marginTop: 10 }} />
            </View>

            {loadingExpand ? <ActivityIndicator/> : 
              (searchResults.length > 0 || searchQuery) ? (
                <FlatList data={searchResults} renderItem={(props) => renderUserProfile({...props, from: 'expand'})} keyExtractor={(item) => item.id} ListEmptyComponent={<ThemedText style={styles.emptyText}>No users found.</ThemedText>} />
              ) : (
                <ScrollView>
                  <ThemedText variant="subtitle" style={styles.expandSectionTitle}>From Your School</ThemedText>
                  {schoolmates.length > 0 ? (
                    schoolmates.map(item => <View key={item.id}>{renderUserProfile({ item, from: 'expand' })}</View>)
                  ) : (
                    <ThemedText style={styles.emptyText}>No new people found from your school.</ThemedText>
                  )}
                  
                  <ThemedText variant="subtitle" style={styles.expandSectionTitle}>Friends of Friends</ThemedText>
                  {friendsOfFriends.length > 0 ? (
                    friendsOfFriends.map(item => <View key={item.id}>{renderUserProfile({ item, from: 'expand' })}</View>)
                  ) : (
                    <ThemedText style={styles.emptyText}>No new friends of friends found.</ThemedText>
                  )}
                </ScrollView>
              )
            }
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  backButton: { position: 'absolute', top: 60, left: 20, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  backText: { marginLeft: 8 },
  tabContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginTop: 40 },
  tab: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomWidth: 2 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  fullScreenView: { flex: 1, paddingTop: 60 },
  searchSection: { marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 10, borderRadius: 8 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  userInfo: { flex: 1 },
  username: { fontWeight: 'bold' },
  requestButtons: { flexDirection: 'row', gap: 8 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#888' },
  expandSectionTitle: { marginTop: 20, marginBottom: 10, paddingHorizontal: 5, fontWeight: 'bold', color: '#6c757d' },
  backButtonInline: { flexDirection: 'row', alignItems: 'center' },
  profileHeader: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  profileContent: { paddingVertical: 10 },
  profileInfoContainer: { alignItems: 'center', marginBottom: 30, paddingHorizontal: 20 },
  profileAvatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  statsCard: { marginHorizontal: 20, padding: 20, borderRadius: 8 },
  statsTitle: { textAlign: 'center', marginBottom: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }
});
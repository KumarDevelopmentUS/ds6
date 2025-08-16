// app/user-profile/[userId].tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { ThemedButton } from '../../components/themed/ThemedButton';
import { ThemedText } from '../../components/themed/ThemedText';
import { ThemedView } from '../../components/themed/ThemedView';
import { getSchoolByValue } from '../../constants/schools';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface UserProfile {
  id: string;
  username: string;
  nickname: string;
  school: string;
  avatar_icon: keyof typeof Ionicons.glyphMap;
  avatar_icon_color: string;
  avatar_background_color: string;
  avatar_url?: string;
}

interface UserStats {
  totalMatches: number;
  totalWins: number;
  winRate: number;
  totalThrows: number;
  totalHits: number;
  hitRate: number;
  totalCatches: number;
  totalCatchAttempts: number;
  catchRate: number;
  totalFifaSuccess: number;
  totalFifaAttempts: number;
  fifaRate: number;
  averageRanking: number;
}

interface FriendshipStatus {
  status: 'none' | 'friends' | 'pending_sent' | 'pending_received';
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { userId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>({ status: 'none' });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingFriendship, setLoadingFriendship] = useState(true);

  useEffect(() => {
    if (userId) {
      // Check if user is viewing their own profile
      if (session?.user?.id === userId) {
        router.replace('/stats');
        return;
      }
      
      loadUserProfile();
      loadUserStats();
      loadFriendshipStatus();
    }
  }, [userId, session]);

  const loadUserProfile = async () => {
    if (!userId || typeof userId !== 'string') return;

    try {
      // Fetch user profile from both tables
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', userId)
        .single();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname, school, avatar_icon, avatar_icon_color, avatar_background_color')
        .eq('id', userId)
        .single();

      if (userError && profileError) {
        throw new Error('User not found');
      }

      const combinedProfile: UserProfile = {
        id: userId,
        username: userProfile?.username || 'unknown',
        nickname: profile?.nickname || userProfile?.display_name || 'Player',
        school: profile?.school ? getSchoolByValue(profile.school)?.name || 'N/A' : 'N/A',
        avatar_icon: profile?.avatar_icon || 'person',
        avatar_icon_color: profile?.avatar_icon_color || '#FFFFFF',
        avatar_background_color: profile?.avatar_background_color || theme.colors.primary,
        avatar_url: userProfile?.avatar_url,
      };

      setProfile(combinedProfile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Could not load user profile');
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    if (!userId || typeof userId !== 'string') return;

    try {
      setLoadingStats(true);
      
      console.log('Loading stats for user:', userId);
      
      // Use the hybrid approach: try stored stats first, fallback to calculation
      const { getUserStatsHybrid } = await import('../../utils/profileSync');
      const stats = await getUserStatsHybrid(userId);
      
      console.log('Loaded stats:', stats);
      setStats(stats);
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadFriendshipStatus = async () => {
    if (!userId || typeof userId !== 'string') return;

    try {
      setLoadingFriendship(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: friendship, error } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .eq('status', 'pending');

      if (error) throw error;

      if (friendship && friendship.length > 0) {
        const relationship = friendship.find(f => 
          (f.user_id_1 === user.id && f.user_id_2 === userId) ||
          (f.user_id_1 === userId && f.user_id_2 === user.id)
        );

        if (relationship) {
          if (relationship.user_id_1 === user.id) {
            setFriendshipStatus({ status: 'pending_sent' });
          } else {
            setFriendshipStatus({ status: 'pending_received' });
          }
        }
      } else {
        // Check if they're already friends
        const { data: existingFriendship, error: friendError } = await supabase
          .from('friends')
          .select('*')
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
          .or(`user_id_1.eq.${userId},user_id_2.eq.${user.id}`)
          .eq('status', 'accepted');

        if (!friendError && existingFriendship && existingFriendship.length > 0) {
          const isFriend = existingFriendship.some(f => 
            (f.user_id_1 === user.id && f.user_id_2 === userId) ||
            (f.user_id_1 === userId && f.user_id_2 === user.id)
          );
          
          if (isFriend) {
            setFriendshipStatus({ status: 'friends' });
          } else {
            setFriendshipStatus({ status: 'none' });
          }
        } else {
          setFriendshipStatus({ status: 'none' });
        }
      }
    } catch (error) {
      console.error('Error loading friendship status:', error);
    } finally {
      setLoadingFriendship(false);
    }
  };

  const handleAddFriend = async () => {
    if (!userId || typeof userId !== 'string') return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('friends')
        .insert({
          user_id_1: user.id,
          user_id_2: userId,
          status: 'pending'
        });

      if (error) throw error;

      setFriendshipStatus({ status: 'pending_sent' });
      Alert.alert('Success', 'Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Could not send friend request');
    }
  };

  const handleAcceptRequest = async () => {
    if (!userId || typeof userId !== 'string') return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (error) throw error;

      setFriendshipStatus({ status: 'friends' });
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Could not accept friend request');
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedView style={styles.container}>
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.centerLoader} />
        </ThemedView>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedView style={styles.container}>
          <View style={styles.content}>
            <HapticBackButton onPress={() => router.back()} style={styles.backButton} />
            <ThemedView variant="card" style={styles.errorContainer}>
              <ThemedText variant="title">User Not Found</ThemedText>
              <ThemedText variant="body">This user profile could not be loaded.</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HapticBackButton onPress={() => router.back()} style={styles.backButton} />
        {/* Profile Header */}
        <ThemedView variant="card" style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: profile.avatar_background_color }]}>
            {profile.avatar_url ? (
              <Ionicons name="person" size={60} color={profile.avatar_icon_color} />
            ) : (
              <Ionicons name={profile.avatar_icon} size={60} color={profile.avatar_icon_color} />
            )}
          </View>
          
          <View style={styles.profileInfo}>
            <ThemedText variant="title" style={styles.nickname}>{profile.nickname}</ThemedText>
            <ThemedText variant="body" style={styles.username}>@{profile.username}</ThemedText>
            {profile.school && profile.school !== 'N/A' && (
              <ThemedText variant="caption" style={styles.school}>{profile.school}</ThemedText>
            )}
          </View>
        </ThemedView>

        {/* Friendship Actions */}
        {loadingFriendship ? (
          <ThemedView variant="card" style={styles.actionsCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <ThemedText variant="caption" style={styles.loadingText}>Loading...</ThemedText>
          </ThemedView>
        ) : (
          <ThemedView variant="card" style={styles.actionsCard}>
            {friendshipStatus.status === 'none' && (
              <ThemedButton
                title="Add Friend"
                onPress={handleAddFriend}
                size="medium"
                variant="primary"
              />
            )}
            {friendshipStatus.status === 'pending_sent' && (
              <ThemedText variant="body" style={styles.statusText}>Friend Request Sent</ThemedText>
            )}
            {friendshipStatus.status === 'pending_received' && (
              <ThemedButton
                title="Accept Request"
                onPress={handleAcceptRequest}
                size="medium"
                variant="success"
              />
            )}
            {friendshipStatus.status === 'friends' && (
              <ThemedText variant="body" style={styles.statusText}>Friends</ThemedText>
            )}
          </ThemedView>
        )}

        {/* Stats Grid */}
        {!loadingStats && stats && (
          <>
            {stats.totalMatches > 0 ? (
              <>
                <View style={styles.statsGrid}>
                  <ThemedView variant="card" style={styles.statCard}>
                    <Ionicons name="star" size={24} color={theme.colors.warning} />
                    <ThemedText variant="title" color="warning">
                      {stats.averageRanking}
                    </ThemedText>
                    <ThemedText variant="caption">Average Ranking</ThemedText>
                  </ThemedView>

                  <ThemedView variant="card" style={styles.statCard}>
                    <Ionicons name="trophy" size={24} color={theme.colors.warning} />
                    <ThemedText variant="title" color="warning">
                      {stats.totalMatches}
                    </ThemedText>
                    <ThemedText variant="caption">Total Matches</ThemedText>
                  </ThemedView>

                  <ThemedView variant="card" style={styles.statCard}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
                    <ThemedText variant="title" color="success">
                      {stats.totalWins}
                    </ThemedText>
                    <ThemedText variant="caption">Total Wins</ThemedText>
                  </ThemedView>

                  <ThemedView variant="card" style={styles.statCard}>
                    <Ionicons name="trending-up" size={24} color={theme.colors.primary} />
                    <ThemedText variant="title" color="primary">
                      {stats.winRate.toFixed(1)}%
                    </ThemedText>
                    <ThemedText variant="caption">Win Rate</ThemedText>
                  </ThemedView>
                </View>

                {/* Detailed Stats */}
                <ThemedView variant="card" style={styles.detailsCard}>
                  <ThemedText variant="subtitle" style={styles.sectionTitle}>
                    Performance Statistics
                  </ThemedText>
                  
                  <View style={styles.detailRow}>
                    <ThemedText variant="body">Hit Rate</ThemedText>
                    <ThemedText variant="body" color="primary">{stats.hitRate.toFixed(1)}%</ThemedText>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <ThemedText variant="body">Catch Rate</ThemedText>
                    <ThemedText variant="body" color="primary">{stats.catchRate.toFixed(1)}%</ThemedText>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <ThemedText variant="body">FIFA Rate</ThemedText>
                    <ThemedText variant="body" color="primary">{stats.fifaRate.toFixed(1)}%</ThemedText>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <ThemedText variant="body">Total Throws</ThemedText>
                    <ThemedText variant="body" color="primary">{stats.totalThrows}</ThemedText>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <ThemedText variant="body">Total Catches</ThemedText>
                    <ThemedText variant="body" color="primary">{stats.totalCatches}</ThemedText>
                  </View>
                </ThemedView>
              </>
            ) : (
              <ThemedView variant="card" style={styles.emptyStatsCard}>
                <Ionicons name="stats-chart-outline" size={48} color={theme.colors.textSecondary} />
                <ThemedText variant="subtitle" style={styles.emptyStatsTitle}>No Statistics Available</ThemedText>
                <ThemedText variant="body" style={styles.emptyStatsText}>
                  This user hasn&apos;t played any matches yet.
                </ThemedText>
              </ThemedView>
            )}
          </>
        )}

        {loadingStats && (
          <ThemedView variant="card" style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <ThemedText variant="body" style={styles.loadingText}>Loading statistics...</ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 60, // Space for back button
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 20, // Add space between back button and first card
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  profileInfo: {
    flex: 1,
  },
  nickname: {
    marginBottom: 4,
    fontSize: 24,
    fontWeight: 'bold',
  },
  username: {
    marginBottom: 4,
    color: '#6b7280',
    fontSize: 16,
  },
  school: {
    color: '#6b7280',
    fontSize: 14,
  },
  actionsCard: {
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  statusText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 12,
  },
  detailsCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  loadingCard: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
    borderRadius: 12,
  },
  emptyStatsCard: {
    padding: 20,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyStatsTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyStatsText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
  },
});

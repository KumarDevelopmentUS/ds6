import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface LeaderboardPlayer {
  id: string;
  nickname: string | null;
  username: string | null;
  school: string | null;
  avatar_icon: string | null;
  avatar_icon_color: string | null;
  avatar_background_color: string | null;
  total_matches_played: number;
  total_wins: number;
  total_hits: number;
  average_rating: number | null;
  win_percentage: number;
  rank: number;
}

type SortType = 'average_rating' | 'total_hits' | 'total_wins';
type FilterType = 'global' | 'school' | 'friends';

// Podium colors for top 3 positions
const PODIUM_COLORS = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver  
  3: '#CD7F32', // Bronze
};

interface LeaderboardProps {
  maxPlayers?: number;
  showHeader?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ 
  maxPlayers = 10,
  showHeader = true 
}) => {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortType>('average_rating');
  const [filterBy, setFilterBy] = useState<FilterType>('global');
  const [userSchool, setUserSchool] = useState<string | null>(null);
  const [userFriends, setUserFriends] = useState<string[]>([]);

  useEffect(() => {
    fetchUserSchool();
    fetchUserFriends();
  }, [session]);

  useEffect(() => {
    if (filterBy === 'school' && !userSchool && session) {
      // If filtering by school but user has no school, fallback to global
      setFilterBy('global');
    } else {
      fetchLeaderboard();
    }
  }, [sortBy, filterBy, userSchool, userFriends]);

  const fetchUserSchool = async () => {
    if (!session?.user?.id) return;
    
    try {
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('school')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setUserSchool(userProfile?.school || null);
    } catch (error) {
      console.error('Error fetching user school:', error);
    }
  };

  const fetchUserFriends = async () => {
    if (!session?.user?.id) return;
    
    try {
      const { data: relationships, error } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id_1.eq.${session.user.id},user_id_2.eq.${session.user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds: string[] = [];
      relationships?.forEach(rel => {
        const otherUserId = rel.user_id_1 === session.user.id ? rel.user_id_2 : rel.user_id_1;
        friendIds.push(otherUserId);
      });

      setUserFriends(friendIds);
    } catch (error) {
      console.error('Error fetching user friends:', error);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Build query based on filter
      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          nickname,
          username,
          school,
          avatar_icon,
          avatar_icon_color,
          avatar_background_color,
          total_matches_played,
          total_wins,
          total_hits,
          average_rating
        `)
        .not('total_matches_played', 'is', null)
        .gt('total_matches_played', 0);

      // Apply school filter if needed
      if (filterBy === 'school' && userSchool) {
        query = query.eq('school', userSchool);
      }

      // Apply friends filter if needed
      if (filterBy === 'friends') {
        if (userFriends.length > 0) {
          query = query.in('id', userFriends);
        } else {
          // If no friends, return empty result by filtering for impossible condition
          query = query.eq('id', 'impossible-id-that-will-never-exist');
        }
      }

      // Apply sorting
      let orderColumn = sortBy;
      let ascending = false;

      if (sortBy === 'average_rating') {
        query = query.not('average_rating', 'is', null).order('average_rating', { ascending: false });
      } else if (sortBy === 'total_hits') {
        query = query.order('total_hits', { ascending: false });
      } else if (sortBy === 'total_wins') {
        query = query.order('total_wins', { ascending: false });
      }

      const { data, error } = await query.limit(maxPlayers * 2); // Get more to account for filtering

      if (error) throw error;

      // Process the data
      const processedPlayers: LeaderboardPlayer[] = (data || []).map((player, index) => {
        const winPercentage = player.total_matches_played > 0 
          ? Math.round((player.total_wins / player.total_matches_played) * 100)
          : 0;

        return {
          ...player,
          total_matches_played: player.total_matches_played || 0,
          total_wins: player.total_wins || 0,
          total_hits: player.total_hits || 0,
          win_percentage: winPercentage,
          rank: index + 1
        };
      });

      // Sort by calculated fields (since we calculated them on frontend)
      if (sortBy === 'total_hits') {
        processedPlayers.sort((a, b) => {
          if (b.total_hits !== a.total_hits) {
            return b.total_hits - a.total_hits;
          }
          // Tie-breaker: more games played
          return b.total_matches_played - a.total_matches_played;
        });
      } else if (sortBy === 'total_wins') {
        processedPlayers.sort((a, b) => {
          if (b.total_wins !== a.total_wins) {
            return b.total_wins - a.total_wins;
          }
          // Tie-breaker: more games played
          return b.total_matches_played - a.total_matches_played;
        });
      }

      // Re-assign ranks after sorting
      processedPlayers.forEach((player, index) => {
        player.rank = index + 1;
      });

      setPlayers(processedPlayers.slice(0, maxPlayers));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (player: LeaderboardPlayer): string => {
    return player.nickname || player.username || 'Anonymous';
  };

  const getSchoolDisplayName = (schoolValue: string | null): string => {
    if (!schoolValue) return 'Unknown';
    const school = getSchoolByValue(schoolValue);
    return school ? school.display : schoolValue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSortButtonStyle = (sort: SortType) => [
    styles.sortButton,
    { 
      backgroundColor: sortBy === sort ? theme.colors.primary : theme.colors.card,
      borderColor: sortBy === sort ? theme.colors.primary : theme.colors.border
    }
  ];

  const getFilterButtonStyle = (filter: FilterType) => [
    styles.filterButton,
    { 
      backgroundColor: filterBy === filter ? theme.colors.primary : theme.colors.card,
      borderColor: filterBy === filter ? theme.colors.primary : theme.colors.border
    }
  ];

  const getSortValue = (player: LeaderboardPlayer): string => {
    switch (sortBy) {
      case 'average_rating':
        return player.average_rating?.toFixed(1) || 'N/A';
      case 'total_hits':
        return player.total_hits.toString();
      case 'total_wins':
        return player.total_wins.toString();
      default:
        return 'N/A';
    }
  };

  const getSortLabel = (): string => {
    switch (sortBy) {
      case 'average_rating':
        return 'Avg Rating';
      case 'total_hits':
        return 'Total Points';
      case 'total_wins':
        return 'Number of Wins';
      default:
        return 'Score';
    }
  };

  const canFilterBySchool = userSchool !== null;
  const canFilterByFriends = true; // Always show friends filter

  const getRankBadgeColor = (rank: number) => {
    return PODIUM_COLORS[rank as keyof typeof PODIUM_COLORS] || theme.colors.card;
  };

  const getRankTextColor = (rank: number) => {
    return rank <= 3 ? '#fff' : theme.colors.text;
  };

  const getRankIconColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#8B7D00'; // Much darker gold for better contrast
      case 2:
        return '#4A4A4A'; // Much darker gray for better contrast
      case 3:
        return '#5D2F0A'; // Much darker brown for better contrast
      default:
        return theme.colors.text;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return 'trophy';
      case 2:
        return 'medal';
      case 3:
        return 'ribbon';
      default:
        return null;
    }
  };

  return (
    <ThemedView variant="card" style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
                  <View style={styles.titleRow}>
          <ThemedText variant="subtitle" style={styles.title}>
            Top Players
          </ThemedText>
        </View>
          
          {/* Filters */}
          <View style={styles.controls}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={getFilterButtonStyle('global')}
                onPress={() => setFilterBy('global')}
              >
                <ThemedText 
                  variant="caption" 
                  style={[styles.filterText, { color: filterBy === 'global' ? '#fff' : theme.colors.text }]}
                >
                  Global
                </ThemedText>
              </TouchableOpacity>
              
              {canFilterBySchool && (
                <TouchableOpacity
                  style={getFilterButtonStyle('school')}
                  onPress={() => setFilterBy('school')}
                >
                  <ThemedText 
                    variant="caption" 
                    style={[styles.filterText, { color: filterBy === 'school' ? '#fff' : theme.colors.text }]}
                  >
                    My School
                  </ThemedText>
                </TouchableOpacity>
              )}
              
              {canFilterByFriends && (
                <TouchableOpacity
                  style={getFilterButtonStyle('friends')}
                  onPress={() => setFilterBy('friends')}
                >
                  <ThemedText 
                    variant="caption" 
                    style={[styles.filterText, { color: filterBy === 'friends' ? '#fff' : theme.colors.text }]}
                  >
                    Friends
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Sort Options */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
              <TouchableOpacity
                style={getSortButtonStyle('average_rating')}
                onPress={() => setSortBy('average_rating')}
              >
                <ThemedText 
                  variant="caption" 
                  style={[styles.sortText, { color: sortBy === 'average_rating' ? '#fff' : theme.colors.text }]}
                >
                  Avg Rating
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={getSortButtonStyle('total_hits')}
                onPress={() => setSortBy('total_hits')}
              >
                <ThemedText 
                  variant="caption" 
                  style={[styles.sortText, { color: sortBy === 'total_hits' ? '#fff' : theme.colors.text }]}
                >
                  Total Points
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={getSortButtonStyle('total_wins')}
                onPress={() => setSortBy('total_wins')}
              >
                <ThemedText 
                  variant="caption" 
                  style={[styles.sortText, { color: sortBy === 'total_wins' ? '#fff' : theme.colors.text }]}
                >
                  Number of Wins
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText variant="caption" style={styles.loadingText}>
            Loading leaderboard...
          </ThemedText>
        </View>
      ) : players.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={48} color={theme.colors.textSecondary} />
          <ThemedText variant="body" style={styles.emptyText}>
            No players found
          </ThemedText>
          <ThemedText variant="caption" style={styles.emptySubtext}>
            {filterBy === 'school' 
              ? 'No players from your school have played games yet' 
              : filterBy === 'friends'
              ? 'None of your friends have played games yet'
              : 'No players have completed games yet'}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.playersList}>
          {/* Header Row */}
          <View style={styles.listHeader}>
            <ThemedText variant="caption" style={[styles.rankHeader, { color: theme.colors.textSecondary }]}>
              Rank
            </ThemedText>
            <ThemedText variant="caption" style={[styles.nameHeader, { color: theme.colors.textSecondary }]}>
              Player
            </ThemedText>
            <ThemedText variant="caption" style={[styles.scoreHeader, { color: theme.colors.textSecondary }]}>
              {getSortLabel()}
            </ThemedText>
          </View>

          {players.map((player, index) => (
            <View key={player.id} style={styles.playerRow}>
              {/* Rank */}
              <View style={styles.rankContainer}>
                <View style={[
                  styles.rankBadge,
                  { backgroundColor: getRankBadgeColor(player.rank) }
                ]}>
                  {getRankIcon(player.rank) ? (
                    <Ionicons 
                      name={getRankIcon(player.rank) as any} 
                      size={16} 
                      color={getRankIconColor(player.rank)} 
                    />
                  ) : (
                    <ThemedText variant="caption" style={[
                      styles.rankText,
                      { color: getRankTextColor(player.rank) }
                    ]}>
                      {player.rank}
                    </ThemedText>
                  )}
                </View>
              </View>

              {/* Player Info */}
              <View style={styles.playerInfo}>
                <View style={styles.playerMain}>
                  <View style={[
                    styles.avatar,
                    { backgroundColor: player.avatar_background_color || theme.colors.primary }
                  ]}>
                    <Ionicons 
                      name={player.avatar_icon as any || 'person'} 
                      size={20} 
                      color={player.avatar_icon_color || '#fff'} 
                    />
                  </View>
                  <View style={styles.playerDetails}>
                    <ThemedText variant="body" style={styles.playerName}>
                      {getDisplayName(player)}
                    </ThemedText>
                    {filterBy === 'global' && player.school && (
                      <ThemedText variant="caption" style={[styles.playerSchool, { color: theme.colors.textSecondary }]}>
                        {getSchoolDisplayName(player.school)}
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>

              {/* Score */}
              <View style={styles.scoreContainer}>
                <ThemedText variant="body" style={styles.scoreValue}>
                  {getSortValue(player)}
                </ThemedText>
                <ThemedText variant="caption" style={[styles.gamesCount, { color: theme.colors.textSecondary }]}>
                  {player.total_matches_played} games
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    marginLeft: 8,
    marginBottom: 0,
  },
  controls: {
    gap: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    // borderColor set dynamically in getFilterButtonStyle
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  sortButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    // borderColor set dynamically in getSortButtonStyle
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  playersList: {
    marginTop: 8,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 16,
  },
  rankHeader: {
    width: 50,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  nameHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scoreHeader: {
    width: 80,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 20,
  },
  playerSchool: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  scoreContainer: {
    width: 80,
    alignItems: 'center',
  },
  scoreValue: {
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
  },
  gamesCount: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});

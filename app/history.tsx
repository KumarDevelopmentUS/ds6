// app/history.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedButton } from '../components/themed/ThemedButton';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedView } from '../components/themed/ThemedView';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from './_layout';

interface SavedMatch {
  id: string;
  userId: string;
  roomCode: string;
  matchSetup: {
    title: string;
    arena: string;
    playerNames: string[];
    teamNames: string[];
    gameScoreLimit: number;
    sinkPoints: number;
    winByTwo: boolean;
  };
  playerStats: { [key: number]: PlayerStats };
  teamPenalties: { 1: number; 2: number };
  matchStartTime: string;
  winnerTeam: number | null;
  matchDuration: number;
  userSlotMap: { [key: string]: string | null };
  createdAt: string;
}

interface PlayerStats {
  name: string;
  throws: number;
  hits: number;
  blunders: number;
  catches: number;
  score: number;
  aura: number;
  fifaAttempts: number;
  fifaSuccess: number;
  hitStreak: number;
  specialThrows: number;
  lineThrows: number;
  goals: number;
  onFireCount: number;
  currentlyOnFire: boolean;
  tableDie: number;
  line: number;
  hit: number;
  knicker: number;
  dink: number;
  sink: number;
  short: number;
  long: number;
  side: number;
  height: number;
  catchPlusAura: number;
  drop: number;
  miss: number;
  twoHands: number;
  body: number;
  goodKick: number;
  badKick: number;
}

export default function GameHistoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');

  useEffect(() => {
    if (session?.user) {
      loadMatches();
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadMatches = async () => {
    if (!session?.user) return;

    try {
      const { data, error } = await supabase
        .from('saved_matches')
        .select('*')
        .eq('userId', session.user.id)
        .order('createdAt', { ascending: false });

      if (error) throw error;

      // Filter matches to only include those where user was a player
      const playerMatches = (data || []).filter(match => {
        const userSlot = Object.entries(match.userSlotMap || {}).find(
          ([_, userId]) => userId === session.user.id
        );
        return userSlot !== undefined;
      });

      setMatches(playerMatches);
    } catch (error: any) {
      console.error('Error loading matches:', error);
      Alert.alert('Error', 'Failed to load match history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  const calculateTeamScore = (match: SavedMatch, teamNumber: number): number => {
    const playerIndices = teamNumber === 1 ? [1, 2] : [3, 4];
    const teamScore = playerIndices.reduce((sum, playerId) => {
      return sum + (match.playerStats[playerId]?.score || 0);
    }, 0);
    return teamScore - (match.teamPenalties[teamNumber as 1 | 2] || 0);
  };

  const getUserTeam = (match: SavedMatch): number | null => {
    if (!session?.user) return null;
    
    for (const [slot, userId] of Object.entries(match.userSlotMap)) {
      if (userId === session.user.id) {
        const playerSlot = parseInt(slot);
        return playerSlot <= 2 ? 1 : 2;
      }
    }
    return null;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getFilteredMatches = (): SavedMatch[] => {
    if (filter === 'all') return matches;
    
    return matches.filter(match => {
      const userTeam = getUserTeam(match);
      if (!userTeam) return false;
      
      if (filter === 'wins') {
        return match.winnerTeam === userTeam;
      } else {
        return match.winnerTeam !== userTeam && match.winnerTeam !== null;
      }
    });
  };

  

  if (!session?.user) {
    return (
      <>
        <Stack.Screen 
          options={{
            headerShown: false,
          }}
        />
        <ThemedView style={styles.container}>
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color={theme.colors.text} />
            <ThemedText variant="subtitle" style={styles.emptyStateText}>
              Sign in to view your game history
            </ThemedText>
            <ThemedButton
              title="Sign In"
              onPress={() => router.push('/(auth)/login')}
              size="medium"
              style={{ marginTop: 20 }}
            />
          </View>
        </ThemedView>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen 
          options={{
            headerShown: false,
          }}
        />
        <ThemedView style={styles.container}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </ThemedView>
      </>
    );
  }

  const filteredMatches = getFilteredMatches();

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Back Button */}
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText variant="title">Game History</ThemedText>
          <ThemedText variant="caption">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'} played
          </ThemedText>
        </ThemedView>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'wins', 'losses'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterTab,
                filter === filterType && styles.filterTabActive,
              ]}
              onPress={() => setFilter(filterType)}
            >
              <ThemedText
                variant="body"
                color={filter === filterType ? 'primary' : undefined}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Match List */}
        {filteredMatches.length === 0 ? (
          <ThemedView variant="card" style={styles.emptyCard}>
            <ThemedText variant="body" style={styles.emptyText}>
              {matches.length === 0 
                ? "No matches found. Join a game as a player to see your history!"
                : "No matches found for this filter."}
            </ThemedText>
          </ThemedView>
        ) : (
          filteredMatches.map((match) => {
            const team1Score = calculateTeamScore(match, 1);
            const team2Score = calculateTeamScore(match, 2);
            const userTeam = getUserTeam(match);
            const isWin = userTeam && match.winnerTeam === userTeam;
            const isExpanded = expandedMatch === match.id;

            return (
              <ThemedView key={match.id} variant="card" style={styles.matchCard}>
                <TouchableOpacity
                  onPress={() => setExpandedMatch(isExpanded ? null : match.id)}
                  activeOpacity={0.7}
                >
                  {/* Match Header */}
                  <View style={styles.matchHeader}>
                    <View style={styles.matchInfo}>
                      <ThemedText variant="subtitle">{match.matchSetup.title}</ThemedText>
                      <ThemedText variant="caption">{match.matchSetup.arena}</ThemedText>
                      <ThemedText variant="caption">{formatDate(match.createdAt)}</ThemedText>
                    </View>
                    <View style={styles.matchResult}>
                      {isWin !== null && (
                        <View
                          style={[
                            styles.resultBadge,
                            isWin ? styles.winBadge : styles.lossBadge,
                          ]}
                        >
                          <ThemedText variant="caption" color="primary">
                            {isWin ? 'WIN' : 'LOSS'}
                          </ThemedText>
                        </View>
                      )}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={theme.colors.text}
                      />
                    </View>
                  </View>

                  {/* Score Summary */}
                  <View style={styles.scoreSummary}>
                    <View style={styles.teamScore}>
                      <ThemedText
                        variant="body"
                        color={match.winnerTeam === 1 ? 'primary' : undefined}
                      >
                        {match.matchSetup.teamNames[0]}
                      </ThemedText>
                      <ThemedText
                        variant="title"
                        color={match.winnerTeam === 1 ? 'primary' : undefined}
                      >
                        {team1Score}
                      </ThemedText>
                    </View>
                    <ThemedText variant="caption" style={styles.vs}>vs</ThemedText>
                    <View style={styles.teamScore}>
                      <ThemedText
                        variant="body"
                        color={match.winnerTeam === 2 ? 'primary' : undefined}
                      >
                        {match.matchSetup.teamNames[1]}
                      </ThemedText>
                      <ThemedText
                        variant="title"
                        color={match.winnerTeam === 2 ? 'primary' : undefined}
                      >
                        {team2Score}
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />
                    
                    {/* Match Details */}
                    <View style={styles.detailsRow}>
                      <ThemedText variant="caption">Duration:</ThemedText>
                      <ThemedText variant="body">{formatDuration(match.matchDuration)}</ThemedText>
                    </View>
                    <View style={styles.detailsRow}>
                      <ThemedText variant="caption">Room Code:</ThemedText>
                      <ThemedText variant="body">{match.roomCode}</ThemedText>
                    </View>

                    {/* Player Stats */}
                    <ThemedText variant="subtitle" style={styles.sectionTitle}>
                      Player Performance
                    </ThemedText>
                    {[1, 2, 3, 4].map((playerId) => {
                      const player = match.playerStats[playerId];
                      if (!player) return null;

                      const isUserPlayer = match.userSlotMap[playerId.toString()] === session.user?.id;
                      const hitRate = player.throws > 0 ? ((player.hits / player.throws) * 100).toFixed(1) : '0';

                      return (
                        <View
                          key={playerId}
                          style={[
                            styles.playerRow,
                            isUserPlayer && styles.userPlayerRow,
                          ]}
                        >
                          <ThemedText variant="body" style={styles.playerName}>
                            {player.name} {isUserPlayer && '(You)'}
                          </ThemedText>
                          <View style={styles.playerStats}>
                            <ThemedText variant="caption">
                              {player.hits}/{player.throws} ({hitRate}%)
                            </ThemedText>
                            <ThemedText variant="caption" color="primary">
                              {player.score} pts
                            </ThemedText>
                          </View>
                        </View>
                      );
                    })}

                    {/* Actions */}
                    
                  </View>
                )}
              </ThemedView>
            );
          })
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
    padding: 20,
    paddingTop: 100, // Add more padding for back button
  },
  backButton: {
    position: 'absolute',
    top: 60, // Moved down to avoid status bar/notch
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    marginBottom: 24,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  matchCard: {
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winBadge: {
    backgroundColor: '#22c55e',
  },
  lossBadge: {
    backgroundColor: '#ef4444',
  },
  scoreSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  teamScore: {
    alignItems: 'center',
  },
  vs: {
    marginHorizontal: 20,
  },
  expandedContent: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  userPlayerRow: {
    backgroundColor: '#eff6ff',
  },
  playerName: {
    flex: 1,
  },
  playerStats: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 16,
    textAlign: 'center',
  },
});
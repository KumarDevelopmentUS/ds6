// app/history.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonMatchCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemedButton } from '../components/themed/ThemedButton';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedView } from '../components/themed/ThemedView';
import { useTheme } from '../contexts/ThemeContext';

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
  // NEW PROPERTIES (ADDED FOR BEER DIE RULESET)
  validThrows?: number;
  catchAttempts?: number;
  successfulCatches?: number;
  redemptionShots?: number;
}

export default function GameHistoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const styles = createStyles(theme);
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'draws'>('all');

  useEffect(() => {
    if (session?.user) {
      loadMatches();
    } else {
      setLoading(false);
    }
  }, [session]);

  // Calculate player rating: 45% throw + 45% catch + 15% FIFA (max 105%)
  const calculatePlayerRating = (player: PlayerStats): number => {
    if (!player) return 0;

    const hitRate = player.throws > 0 ? player.hits / player.throws : 0;
    
    // Corrected Catch Rate calculation based on the rulebook
    // Denominator is total catches plus total blunders (defensive errors + 'height' throws)
    const totalDefensivePlays = player.catches + player.blunders;
    const catchRate = totalDefensivePlays > 0 ? player.catches / totalDefensivePlays : 0;
    
    const fifaRate = player.fifaAttempts > 0 ? player.fifaSuccess / player.fifaAttempts : 0;

    // New formula: 45% throw + 45% catch + 15% FIFA
    const baseScore = (0.45 * hitRate + 0.45 * catchRate + 0.15 * fifaRate) * 100;

    // Check for awards (each adds 1 point to rating)
    let awards = 0;
    
    // Isaac Newton: Hit accuracy >= 80%
    if (hitRate >= 0.80 && player.throws > 0) awards++;
    
    // Wayne Gretzky: 2 or more goals
    if (player.goals >= 2) awards++;
    
    // Iron Dome: Catch rate >= 80% (using the corrected catch rate logic)
    if (catchRate >= 0.80 && totalDefensivePlays > 0) awards++;
    
    // Incineroar: On fire throws > 70% of total throws
    if (player.throws > 0 && player.onFireCount / player.throws > 0.70) awards++;
    
    // Yusuf Dikeç: Special throws > 15% of total throws
    if (player.throws > 0 && player.specialThrows / player.throws > 0.15) awards++;
    
    // Ronaldo: FIFA success >= 70%
    if (player.fifaAttempts > 0 && player.fifaSuccess / player.fifaAttempts >= 0.70) awards++;
    
    // Border Patrol: Line throws > 15% of total throws
    if (player.throws > 0 && player.lineThrows / player.throws > 0.15) awards++;
    
    // Dennis Rodman: Aura >= 8
    if (player.aura >= 8) awards++;

    const finalRating = Math.min(105, baseScore + awards);
    const roundedRating = Math.round(finalRating * 100) / 100; // Round to 2 decimal places
    
    return roundedRating;
  };

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
      } else if (filter === 'losses') {
        return !!match.winnerTeam && match.winnerTeam !== userTeam;
      } else {
        return !match.winnerTeam;
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
            <Ionicons name="time-outline" size={80} color={theme.colors.textSecondary} style={styles.emptyStateIcon} />
            <ThemedText variant="title" style={styles.emptyStateTitle}>
              Game History
            </ThemedText>
            <ThemedText variant="body" style={styles.emptyStateText}>
              Sign in to track your matches and view detailed performance stats
            </ThemedText>
            <ThemedButton
              title="Sign In"
              onPress={() => router.push('/(auth)/login')}
              size="medium"
              style={{ marginTop: 24 }}
              icon={<Ionicons name="log-in-outline" size={20} color="#FFFFFF" />}
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
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <HapticBackButton 
              onPress={() => router.back()} 
              style={styles.backButton}
              color={theme.colors.primary}
            />
            <ThemedView style={styles.header}>
              <ThemedText variant="title">Game History</ThemedText>
              <ThemedText variant="caption" style={styles.headerCaption}>
                Loading your matches...
              </ThemedText>
            </ThemedView>
            <View style={{ padding: 16, gap: 12 }}>
              <SkeletonMatchCard />
              <SkeletonMatchCard />
              <SkeletonMatchCard />
            </View>
          </ScrollView>
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
        <HapticBackButton 
          onPress={() => router.back()} 
          style={styles.backButton}
          color={theme.colors.primary}
        />

        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText variant="title">Game History</ThemedText>
          <View style={styles.headerInfo}>
            <Ionicons name="trophy-outline" size={16} color={theme.colors.textSecondary} />
            <ThemedText variant="caption" style={styles.headerCaption}>
              {matches.length} {matches.length === 1 ? 'match' : 'matches'} played
            </ThemedText>
          </View>
        </ThemedView>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'wins', 'losses', 'draws'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterTab,
                filter === filterType && styles.filterTabActive,
                filter === filterType && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              ]}
              onPress={() => setFilter(filterType)}
            >
              <ThemedText
                variant="body"
                style={{
                  fontWeight: filter === filterType ? '700' : '500',
                  color: filter === filterType ? '#FFFFFF' : theme.colors.text,
                  fontSize: 15,
                  textAlign: 'center'
                }}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Match List */}
        {filteredMatches.length === 0 ? (
          <EmptyState
            type="history"
            title={matches.length === 0 ? "No Matches Yet" : "No Matches Found"}
            description={matches.length === 0 
                ? "Join a game as a player to start building your match history!"
                : "Try a different filter to see more matches"}
            icon={matches.length === 0 ? "game-controller-outline" : "filter-outline"}
            actionLabel={matches.length === 0 ? "Start a Match" : "Clear Filter"}
            onAction={() => matches.length === 0 
              ? router.push('/tracker/join') 
              : setFilter('all')
            }
          />
        ) : (
          filteredMatches.map((match) => {
            const team1Score = calculateTeamScore(match, 1);
            const team2Score = calculateTeamScore(match, 2);
            const userTeam = getUserTeam(match);
            const isDraw = !match.winnerTeam;
            const isWin = !isDraw && userTeam && match.winnerTeam === userTeam;
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
                      {userTeam && (
                        <View
                          style={[
                            styles.resultBadge,
                            isDraw ? styles.drawBadge : isWin ? styles.winBadge : styles.lossBadge,
                          ]}
                        >
                          <ThemedText variant="caption" style={styles.badgeText}>
                            {isDraw ? 'DRAW' : isWin ? 'WIN' : 'LOSS'}
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
                    <View style={styles.playersGrid}>
                      {[1, 2, 3, 4].map((playerId) => {
                        const player = match.playerStats[playerId];
                        if (!player) return null;

                        const isUserPlayer = match.userSlotMap[playerId.toString()] === session.user?.id;
                        const hitRate = player.throws > 0 ? ((player.hits / player.throws) * 100).toFixed(1) : '0';
                        const totalDefensivePlays = player.catches + player.blunders;
                        const catchRate = totalDefensivePlays > 0 ? ((player.catches / totalDefensivePlays) * 100).toFixed(1) : '0';
                        const fifaRate = player.fifaAttempts > 0 ? ((player.fifaSuccess / player.fifaAttempts) * 100).toFixed(1) : '0';

                        return (
                          <View
                            key={playerId}
                            style={[
                              styles.playerCard,
                              isUserPlayer && styles.userPlayerCard,
                            ]}
                          >
                            <View style={styles.playerHeader}>
                              <ThemedText variant="body" style={styles.playerName}>
                                {player.name} {isUserPlayer && '(You)'}
                              </ThemedText>
                              <ThemedText variant="caption" color="primary">
                                {player.score} pts
                              </ThemedText>
                            </View>
                            
                            <View style={styles.playerStatsGrid}>
                              <View style={styles.statItem}>
                                <ThemedText variant="caption" style={styles.statLabel}>Hit %</ThemedText>
                                <ThemedText variant="body" style={styles.statValue}>{hitRate}%</ThemedText>
                              </View>
                              <View style={styles.statItem}>
                                <ThemedText variant="caption" style={styles.statLabel}>Total Throws</ThemedText>
                                <ThemedText variant="body" style={styles.statValue}>{player.throws}</ThemedText>
                              </View>
                              <View style={styles.statItem}>
                                <ThemedText variant="caption" style={styles.statLabel}>Catch %</ThemedText>
                                <ThemedText variant="body" style={styles.statValue}>{catchRate}%</ThemedText>
                              </View>
                              <View style={styles.statItem}>
                                <ThemedText variant="caption" style={styles.statLabel}>Total Catches</ThemedText>
                                <ThemedText variant="body" style={styles.statValue}>{player.catches}</ThemedText>
                              </View>
                              <View style={styles.statItem}>
                                <ThemedText variant="caption" style={styles.statLabel}>FIFA %</ThemedText>
                                <ThemedText variant="body" style={styles.statValue}>{fifaRate}%</ThemedText>
                              </View>
                              <View style={styles.statItem}>
                                <ThemedText variant="caption" style={styles.statLabel}>Rating</ThemedText>
                                <ThemedText variant="body" style={styles.statValue}>
                                  {calculatePlayerRating(player)}%
                                </ThemedText>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>

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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 12,
    paddingTop: 100,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    marginBottom: 20,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  headerCaption: {
    opacity: 0.7,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 10,
    paddingHorizontal: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: theme.dark ? 0.3 : 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.dark ? 0.4 : 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyCard: {
    padding: 48,
    alignItems: 'center',
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
  matchCard: {
    marginBottom: 12,
    borderRadius: 12,
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
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  winBadge: {
    backgroundColor: theme.colors.success,
  },
  lossBadge: {
    backgroundColor: theme.colors.error,
  },
  drawBadge: {
    backgroundColor: theme.colors.warning,
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
    backgroundColor: theme.colors.border,
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
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  playerCard: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: theme.colors.backgroundTertiary,
    minHeight: 200,
  },
  userPlayerCard: {
    backgroundColor: theme.dark ? theme.colors.backgroundSecondary : '#eff6ff',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
  playerStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    opacity: 0.3,
    marginBottom: 20,
  },
  emptyStateTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
    maxWidth: 300,
  },
});
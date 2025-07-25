// app/tracker/scoreboard.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

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
}

interface LiveMatch {
  id: string;
  roomCode: string;
  status: 'waiting' | 'active' | 'finished';
  matchSetup: {
    title: string;
    arena: string;
    playerNames: string[];
    teamNames: string[];
    gameScoreLimit: number;
    sinkPoints: number;
    winByTwo: boolean;
  };
  livePlayerStats: { [key: number]: PlayerStats };
  liveTeamPenalties: { 1: number; 2: number };
  matchStartTime: string | null;
  winnerTeam: number | null;
}

export default function ScoreboardScreen() {
  const { roomCode } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate team score
  const calculateTeamScore = useCallback((teamNumber: number, playerStats: { [key: number]: PlayerStats }, teamPenalties: { 1: number; 2: number }): number => {
    const playerIndices = teamNumber === 1 ? [1, 2] : [3, 4];
    const teamScore = playerIndices.reduce((sum, playerId) => {
      return sum + (playerStats[playerId]?.score || 0);
    }, 0);
    return teamScore - (teamPenalties[teamNumber as 1 | 2] || 0);
  }, []);

  // Calculate player rating
  const calculatePlayerRating = useCallback((player: PlayerStats): number => {
    if (!player) return 0;

    const hitRate = player.throws > 0 ? player.hits / player.throws : 0;
    const totalDefensivePlays = player.catches + player.blunders;
    const catchRate = totalDefensivePlays > 0 ? player.catches / totalDefensivePlays : 0;
    const averageRate = (hitRate + catchRate) / 2;
    const fifaRate = player.fifaAttempts > 0 ? player.fifaSuccess / player.fifaAttempts : 0;

    return Math.round(((0.85 * averageRate) + (0.10 * fifaRate)) / 0.95 * 100);
  }, []);

  // Load match data
  const loadMatchData = useCallback(async () => {
    if (!roomCode || Array.isArray(roomCode)) return;
    
    try {
      const { data, error } = await supabase
        .from('live_matches')
        .select('*')
        .eq('roomCode', roomCode)
        .in('status', ['waiting', 'active', 'finished'])
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setErrorMessage('Match not found or has ended');
        } else {
          setErrorMessage('Error loading match: ' + error.message);
        }
        return;
      }

      setLiveMatch({
        id: data.id,
        roomCode: data.roomCode,
        status: data.status,
        matchSetup: data.matchSetup,
        livePlayerStats: data.livePlayerStats || {},
        liveTeamPenalties: data.liveTeamPenalties || { 1: 0, 2: 0 },
        matchStartTime: data.matchStartTime,
        winnerTeam: data.winnerTeam,
      });
      setErrorMessage('');
    } catch (error) {
      console.error('Error loading match:', error);
      setErrorMessage('Failed to load match data');
    }
  }, [roomCode]);

  // Initial load
  useEffect(() => {
    loadMatchData().finally(() => setIsLoading(false));
  }, [loadMatchData]);

  // Set up real-time subscription
  useEffect(() => {
    if (!liveMatch?.id) return;

    const subscription = supabase
      .channel(`scoreboard:${liveMatch.id}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_matches',
          filter: `id=eq.${liveMatch.id}`
        },
        (payload) => {
          const updatedMatch = payload.new as any;
          setLiveMatch(prev => prev ? {
            ...prev,
            livePlayerStats: updatedMatch.livePlayerStats,
            liveTeamPenalties: updatedMatch.liveTeamPenalties,
            status: updatedMatch.status,
            winnerTeam: updatedMatch.winnerTeam,
          } : null);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [liveMatch?.id]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMatchData();
    setIsRefreshing(false);
  }, [loadMatchData]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText style={styles.loadingText}>Loading scoreboard...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!liveMatch) {
    return (
      <SafeAreaView style={styles.container}>
        <HapticBackButton 
          onPress={() => router.back()} 
          style={styles.backButton}
        />
        <View style={styles.centerContainer}>
          <ThemedText variant="title" color="error">Match Not Found</ThemedText>
          <ThemedText variant="body" style={styles.errorText}>
            {errorMessage || `The match with room code "${roomCode}" could not be found.`}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const team1Score = calculateTeamScore(1, liveMatch.livePlayerStats, liveMatch.liveTeamPenalties);
  const team2Score = calculateTeamScore(2, liveMatch.livePlayerStats, liveMatch.liveTeamPenalties);

  return (
    <SafeAreaView style={styles.container}>
      <HapticBackButton 
        onPress={() => router.back()} 
        style={styles.backButton}
      />

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Match Header */}
        <ThemedView variant="card" style={styles.matchHeader}>
          <ThemedText variant="title">{liveMatch.matchSetup.title}</ThemedText>
          <ThemedText variant="subtitle">{liveMatch.matchSetup.arena}</ThemedText>
          <ThemedText variant="caption">Room: {roomCode}</ThemedText>
          <ThemedText variant="caption">
            Status: {liveMatch.status === 'waiting' ? 'Waiting to Start' : 
                    liveMatch.status === 'active' ? 'In Progress' : 'Finished'}
          </ThemedText>
        </ThemedView>

        {/* Scoreboard */}
        <ThemedView variant="card" style={styles.scoreboardCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>Scoreboard</ThemedText>
          
          <View style={styles.scoreContainer}>
            <View style={styles.teamScore}>
              <Text style={[styles.teamName, { color: theme.colors.primary }]}>
                {liveMatch.matchSetup.teamNames[0]}
              </Text>
              <Text style={[styles.score, { color: theme.colors.primary }]}>
                {team1Score}
              </Text>
            </View>
            
            <Text style={styles.versus}>VS</Text>
            
            <View style={styles.teamScore}>
              <Text style={[styles.teamName, { color: theme.colors.error }]}>
                {liveMatch.matchSetup.teamNames[1]}
              </Text>
              <Text style={[styles.score, { color: theme.colors.error }]}>
                {team2Score}
              </Text>
            </View>
          </View>

          {liveMatch.status === 'finished' && liveMatch.winnerTeam && (
            <View style={styles.winnerContainer}>
              <Text style={styles.winnerText}>
                🏆 {liveMatch.matchSetup.teamNames[liveMatch.winnerTeam - 1]} Wins!
              </Text>
            </View>
          )}
        </ThemedView>

        {/* Player Stats */}
        <ThemedView variant="card" style={styles.statsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>Player Statistics</ThemedText>
          
          {[1, 2, 3, 4].map((playerId) => {
            const player = liveMatch.livePlayerStats[playerId];
            if (!player) return null;

            const rating = calculatePlayerRating(player);
            const hitRate = player.throws > 0 ? Math.round((player.hits / player.throws) * 100) : 0;
            const catchRate = (player.catches + player.blunders) > 0 ? 
              Math.round((player.catches / (player.catches + player.blunders)) * 100) : 0;

            return (
              <View key={playerId} style={styles.playerRow}>
                <View style={styles.playerHeader}>
                  <Text style={[styles.playerName, { color: playerId <= 2 ? theme.colors.primary : theme.colors.error }]}>
                    {player.name}
                  </Text>
                  <View style={styles.playerMeta}>
                    <Text style={styles.playerScore}>{player.score} pts</Text>
                    <Text style={styles.playerRating}>⭐ {rating}</Text>
                    {player.currentlyOnFire && <Text style={styles.onFireBadge}>🔥</Text>}
                  </View>
                </View>
                
                <View style={styles.playerStats}>
                  <View style={styles.statGroup}>
                    <Text style={styles.statLabel}>Throwing</Text>
                    <Text style={styles.statValue}>
                      {player.hits}/{player.throws} ({hitRate}%)
                    </Text>
                  </View>
                  
                  <View style={styles.statGroup}>
                    <Text style={styles.statLabel}>Defense</Text>
                    <Text style={styles.statValue}>
                      {player.catches} catches ({catchRate}%)
                    </Text>
                  </View>
                  
                  <View style={styles.statGroup}>
                    <Text style={styles.statLabel}>Special</Text>
                    <Text style={styles.statValue}>
                      {player.specialThrows} special, {player.goals} goals
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ThemedView>

        {/* Game Rules */}
        <ThemedView variant="card" style={styles.rulesCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>Game Rules</ThemedText>
          <Text style={styles.ruleText}>• First to {liveMatch.matchSetup.gameScoreLimit} points</Text>
          <Text style={styles.ruleText}>• Sink worth {liveMatch.matchSetup.sinkPoints} points</Text>
          <Text style={styles.ruleText}>• Win by two: {liveMatch.matchSetup.winByTwo ? 'ON' : 'OFF'}</Text>
          <Text style={styles.ruleText}>• Team penalties: Team 1 (-{liveMatch.liveTeamPenalties[1]}), Team 2 (-{liveMatch.liveTeamPenalties[2]})</Text>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    marginVertical: 20,
  },
  matchHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  scoreboardCard: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  teamScore: {
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  score: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  versus: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  winnerContainer: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  winnerText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2563eb',
  },
  statsCard: {
    marginBottom: 20,
  },
  playerRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 16,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerScore: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  playerRating: {
    fontSize: 14,
    color: '#666',
  },
  onFireBadge: {
    fontSize: 16,
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statGroup: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  rulesCard: {
    marginBottom: 20,
  },
  ruleText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
}); 
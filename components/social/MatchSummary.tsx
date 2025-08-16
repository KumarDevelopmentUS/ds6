import { MatchSummaryData, PlayerStats } from '@/types/social';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../themed/ThemedText';
import { ThemedView } from '../themed/ThemedView';

interface MatchSummaryProps {
  matchData: MatchSummaryData;
  showFullDetails?: boolean;
}

export default function MatchSummary({ matchData, showFullDetails = false }: MatchSummaryProps) {
  const router = useRouter();

  // Calculate player rating using the same formula as the app
  const calculatePlayerRating = (player: PlayerStats): number => {
    if (!player) return 0;

    const hitRate = player.throws > 0 ? player.hits / player.throws : 0;
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
    
    // Iron Dome: Catch rate >= 80%
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
    return Math.round(finalRating * 100) / 100;
  };

  // Calculate team scores
  const calculateTeamScore = (teamNumber: number): number => {
    const playerIndices = teamNumber === 1 ? [1, 2] : [3, 4];
    const teamScore = playerIndices.reduce((sum, playerId) => {
      return sum + (matchData.playerStats[playerId]?.score || 0);
    }, 0);
    return teamScore - (matchData.teamPenalties[teamNumber as 1 | 2] || 0);
  };

  const team1Score = calculateTeamScore(1);
  const team2Score = calculateTeamScore(2);
  const matchDate = new Date(matchData.matchStartTime).toLocaleDateString();
  const matchDurationMinutes = Math.floor(matchData.matchDuration / 60);

  // Handle player navigation
  const handlePlayerPress = (playerId: number) => {
    const userId = matchData.userSlotMap[playerId.toString()];
    if (userId) {
      router.push(`/user-profile/${userId}`);
    }
  };

  // Check if player has a user account
  const isRegisteredPlayer = (playerId: number): boolean => {
    return !!matchData.userSlotMap[playerId.toString()];
  };

  // Condensed view for feed
  if (!showFullDetails) {
    return (
      <ThemedView style={styles.condensedContainer}>
        {/* Match Header */}
        <View style={styles.condensedHeader}>
          <Ionicons name="trophy-outline" size={14} color="#666" />
          <ThemedText variant="caption" style={styles.condensedTitle}>
            {matchData.matchSetup.title}
          </ThemedText>
        </View>

        {/* Just the scores */}
        <View style={styles.condensedScoreContainer}>
          <ThemedText variant="body" style={styles.condensedTeamName}>
            {matchData.matchSetup.teamNames[0]}
          </ThemedText>
          <ThemedText 
            variant="body" 
            style={[
              styles.condensedScore, 
              matchData.winnerTeam === 1 && styles.condensedWinnerScore
            ]}
          >
            {team1Score}
          </ThemedText>
          
          <ThemedText variant="caption" style={styles.condensedVs}>-</ThemedText>
          
          <ThemedText 
            variant="body" 
            style={[
              styles.condensedScore, 
              matchData.winnerTeam === 2 && styles.condensedWinnerScore
            ]}
          >
            {team2Score}
          </ThemedText>
          <ThemedText variant="body" style={styles.condensedTeamName}>
            {matchData.matchSetup.teamNames[1]}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Full view for post detail
  return (
    <ThemedView style={styles.container}>
      {/* Match Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="trophy-outline" size={16} color="#666" />
          <ThemedText variant="caption" style={styles.matchTitle}>
            {matchData.matchSetup.title} • {matchData.matchSetup.arena}
          </ThemedText>
        </View>
        <ThemedText variant="caption" style={styles.matchDate}>
          {matchDate} • {matchDurationMinutes}m
        </ThemedText>
      </View>

      {/* Team Scores */}
      <View style={styles.scoreContainer}>
        <View style={styles.teamScore}>
          <ThemedText variant="body" style={styles.teamName}>
            {matchData.matchSetup.teamNames[0]}
          </ThemedText>
          <ThemedText 
            variant="heading" 
            style={[
              styles.score, 
              matchData.winnerTeam === 1 && styles.winnerScore
            ]}
          >
            {team1Score}
          </ThemedText>
        </View>
        
        <ThemedText variant="body" style={styles.vs}>VS</ThemedText>
        
        <View style={styles.teamScore}>
          <ThemedText variant="body" style={styles.teamName}>
            {matchData.matchSetup.teamNames[1]}
          </ThemedText>
          <ThemedText 
            variant="heading" 
            style={[
              styles.score, 
              matchData.winnerTeam === 2 && styles.winnerScore
            ]}
          >
            {team2Score}
          </ThemedText>
        </View>
      </View>

      {/* Players Grid */}
      <View style={styles.playersContainer}>
        <ThemedText variant="caption" style={styles.playersHeader}>
          Players
        </ThemedText>
        
        <View style={styles.playersGrid}>
          {[1, 2, 3, 4].map((playerId) => {
            const player = matchData.playerStats[playerId];
            if (!player) return null;

            const isRegistered = isRegisteredPlayer(playerId);
            const rating = calculatePlayerRating(player);
            const teamNumber = playerId <= 2 ? 1 : 2;

            return (
              <TouchableOpacity
                key={playerId}
                style={[
                  styles.playerCard,
                  teamNumber === matchData.winnerTeam && styles.winnerPlayerCard
                ]}
                onPress={() => handlePlayerPress(playerId)}
                disabled={!isRegistered}
                activeOpacity={isRegistered ? 0.7 : 1}
              >
                <View style={styles.playerHeader}>
                  <View style={styles.playerNameRow}>
                    <ThemedText 
                      variant="body" 
                      style={[
                        styles.playerName,
                        !isRegistered && styles.guestPlayerName
                      ]}
                      numberOfLines={1}
                    >
                      {player.name}
                    </ThemedText>
                    {!isRegistered && (
                      <ThemedText variant="caption" style={styles.guestLabel}>
                        Guest
                      </ThemedText>
                    )}
                    {isRegistered && (
                      <Ionicons name="chevron-forward" size={14} color="#666" />
                    )}
                  </View>
                  <ThemedText variant="caption" style={styles.playerScore}>
                    {player.score} pts
                  </ThemedText>
                </View>
                
                {/* Always show rating in full view */}
                <View style={styles.playerStats}>
                  <ThemedText variant="caption" style={styles.statText}>
                    Rating: {rating}%
                  </ThemedText>
                </View>
                
                {/* Show detailed stats in full view */}
                <View style={styles.playerStatsDetailed}>
                  <ThemedText variant="caption" style={styles.statText}>
                    Hits: {player.hits}/{player.throws} • Catches: {player.catches}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Winner Indicator */}
      {matchData.winnerTeam && (
        <View style={styles.winnerContainer}>
          <Ionicons name="trophy" size={16} color="#FFD700" />
          <ThemedText variant="caption" style={styles.winnerText}>
            {matchData.matchSetup.teamNames[matchData.winnerTeam - 1]} Wins!
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  condensedContainer: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  condensedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  condensedTitle: {
    marginLeft: 4,
    fontWeight: '600',
    color: '#374151',
    fontSize: 12,
  },
  condensedScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  condensedTeamName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
  condensedScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginHorizontal: 8,
  },
  condensedWinnerScore: {
    color: '#059669',
  },
  condensedVs: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 4,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchTitle: {
    marginLeft: 6,
    fontWeight: '600',
    color: '#374151',
  },
  matchDate: {
    color: '#6B7280',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  teamScore: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
  },
  winnerScore: {
    color: '#059669',
  },
  vs: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginHorizontal: 16,
  },
  playersContainer: {
    marginBottom: 12,
  },
  playersHeader: {
    marginBottom: 8,
    fontWeight: '600',
    color: '#374151',
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  winnerPlayerCard: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  playerHeader: {
    marginBottom: 4,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  guestPlayerName: {
    color: '#6B7280',
  },
  guestLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  playerScore: {
    color: '#6B7280',
  },
  playerStats: {
    marginTop: 4,
  },
  playerStatsDetailed: {
    marginTop: 2,
  },
  statText: {
    fontSize: 11,
    color: '#6B7280',
  },
  winnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  winnerText: {
    marginLeft: 6,
    fontWeight: '600',
    color: '#059669',
  },
});

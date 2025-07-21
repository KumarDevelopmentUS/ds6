// app/components/GameStats.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ThemedText } from './themed/ThemedText';
import { ThemedView } from './themed/ThemedView';

interface Player {
  id: string;
  name: string;
  score: number;
  rolls: number[];
}

interface GameStatsProps {
  players: Player[];
}

export const GameStats: React.FC<GameStatsProps> = ({ players }) => {
  const { theme } = useTheme();

  const calculateStats = (rolls: number[]) => {
    if (rolls.length === 0) return { avg: 0, max: 0, min: 0 };
    
    const sum = rolls.reduce((a, b) => a + b, 0);
    const avg = sum / rolls.length;
    const max = Math.max(...rolls);
    const min = Math.min(...rolls);
    
    return { avg: avg.toFixed(1), max, min };
  };

  return (
    <ThemedView variant="card">
      <ThemedText variant="subtitle" style={styles.title}>
        Game Statistics
      </ThemedText>
      
      {players.map((player) => {
        const stats = calculateStats(player.rolls);
        
        return (
          <View key={player.id} style={styles.playerStats}>
            <ThemedText variant="body" style={styles.playerName}>
              {player.name}
            </ThemedText>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText variant="caption">Avg</ThemedText>
                <ThemedText variant="body" color="primary">
                  {stats.avg}
                </ThemedText>
              </View>
              
              <View style={styles.statItem}>
                <ThemedText variant="caption">Max</ThemedText>
                <ThemedText variant="body" color="success">
                  {stats.max}
                </ThemedText>
              </View>
              
              <View style={styles.statItem}>
                <ThemedText variant="caption">Min</ThemedText>
                <ThemedText variant="body" color="warning">
                  {stats.min}
                </ThemedText>
              </View>
              
              <View style={styles.statItem}>
                <ThemedText variant="caption">Rolls</ThemedText>
                <ThemedText variant="body">
                  {player.rolls.length}
                </ThemedText>
              </View>
            </View>
          </View>
        );
      })}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  title: {
    marginBottom: 16,
  },
  playerStats: {
    marginBottom: 16,
  },
  playerName: {
    fontWeight: '600',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
});
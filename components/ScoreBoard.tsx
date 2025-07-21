// app/components/ScoreBoard.tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ThemedText } from './themed/ThemedText';
import { ThemedView } from './themed/ThemedView';

interface Player {
  id: string;
  name: string;
  score: number;
  rolls: number[];
}

interface ScoreBoardProps {
  players: Player[];
  currentPlayer: number;
  onPlayerPress?: (index: number) => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ 
  players, 
  currentPlayer,
  onPlayerPress 
}) => {
  const { theme } = useTheme();

  return (
    <ThemedView variant="card" style={styles.container}>
      <ThemedText variant="subtitle" style={styles.title}>
        Scoreboard
      </ThemedText>
      
      <View style={styles.playersGrid}>
        {players.map((player, index) => (
          <TouchableOpacity
            key={player.id}
            onPress={() => onPlayerPress?.(index)}
            disabled={!onPlayerPress}
            style={[
              styles.playerCard,
              {
                backgroundColor: index === currentPlayer 
                  ? theme.colors.primary + '20' 
                  : theme.colors.background,
                borderColor: index === currentPlayer 
                  ? theme.colors.primary 
                  : theme.colors.border,
              }
            ]}
          >
            <ThemedText variant="body" style={styles.playerName}>
              {player.name}
            </ThemedText>
            <ThemedText 
              variant="title" 
              color={index === currentPlayer ? 'primary' : undefined}
            >
              {player.score}
            </ThemedText>
            <ThemedText variant="caption">
              {player.rolls.length} rolls
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </ThemedView>
  );
};

export default ScoreBoard; // Make sure your component is exported as default


const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    marginBottom: 16,
  },
  playersGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  playerCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  playerName: {
    marginBottom: 8,
    fontWeight: '600',
  },
});
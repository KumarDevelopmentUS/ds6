import { MatchSummaryData } from '@/types/social';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '../themed/ThemedText';
import { ThemedView } from '../themed/ThemedView';
import MatchSummary from './MatchSummary';

// Demo match data for testing
const demoMatchData: MatchSummaryData = {
  id: 'demo-match-123',
  matchSetup: {
    title: 'Intense Showdown',
    arena: 'University Gym',
    playerNames: ['Alice', 'Bob', 'Charlie', 'Diana'],
    teamNames: ['Fire Dragons', 'Ice Wolves'],
    gameScoreLimit: 21,
    sinkPoints: 3,
    winByTwo: true,
  },
  playerStats: {
    1: {
      name: 'Alice',
      throws: 10,
      hits: 8,
      blunders: 2,
      catches: 5,
      score: 15,
      aura: 7,
      fifaAttempts: 3,
      fifaSuccess: 2,
      hitStreak: 4,
      specialThrows: 2,
      lineThrows: 1,
      goals: 3,
      onFireCount: 3,
      currentlyOnFire: false,
      tableDie: 0,
      line: 1,
      hit: 8,
      knicker: 0,
      dink: 1,
      sink: 2,
      short: 0,
      long: 1,
      side: 0,
      height: 1,
      catchPlusAura: 12,
      drop: 1,
      miss: 1,
      twoHands: 3,
      body: 1,
      goodKick: 2,
      badKick: 1,
    },
    2: {
      name: 'Bob',
      throws: 8,
      hits: 5,
      blunders: 1,
      catches: 3,
      score: 8,
      aura: 4,
      fifaAttempts: 2,
      fifaSuccess: 1,
      hitStreak: 2,
      specialThrows: 1,
      lineThrows: 0,
      goals: 1,
      onFireCount: 1,
      currentlyOnFire: false,
      tableDie: 0,
      line: 0,
      hit: 5,
      knicker: 1,
      dink: 0,
      sink: 1,
      short: 1,
      long: 0,
      side: 1,
      height: 0,
      catchPlusAura: 7,
      drop: 0,
      miss: 1,
      twoHands: 2,
      body: 1,
      goodKick: 1,
      badKick: 1,
    },
    3: {
      name: 'Charlie',
      throws: 12,
      hits: 9,
      blunders: 3,
      catches: 4,
      score: 12,
      aura: 6,
      fifaAttempts: 4,
      fifaSuccess: 3,
      hitStreak: 5,
      specialThrows: 3,
      lineThrows: 2,
      goals: 2,
      onFireCount: 4,
      currentlyOnFire: false,
      tableDie: 1,
      line: 2,
      hit: 9,
      knicker: 0,
      dink: 2,
      sink: 1,
      short: 0,
      long: 2,
      side: 1,
      height: 2,
      catchPlusAura: 10,
      drop: 2,
      miss: 1,
      twoHands: 2,
      body: 0,
      goodKick: 3,
      badKick: 1,
    },
    4: {
      name: 'Diana',
      throws: 6,
      hits: 4,
      blunders: 2,
      catches: 6,
      score: 9,
      aura: 8,
      fifaAttempts: 1,
      fifaSuccess: 1,
      hitStreak: 3,
      specialThrows: 0,
      lineThrows: 0,
      goals: 2,
      onFireCount: 2,
      currentlyOnFire: false,
      tableDie: 0,
      line: 0,
      hit: 4,
      knicker: 1,
      dink: 0,
      sink: 1,
      short: 0,
      long: 0,
      side: 0,
      height: 1,
      catchPlusAura: 14,
      drop: 1,
      miss: 1,
      twoHands: 4,
      body: 2,
      goodKick: 1,
      badKick: 0,
    },
  },
  teamPenalties: { 1: 0, 2: 1 },
  userSlotMap: {
    '1': 'user-alice-123',
    '2': 'user-bob-456', 
    '3': null, // Charlie is a guest
    '4': 'user-diana-789',
  },
  winnerTeam: 1,
  matchDuration: 1800, // 30 minutes
  matchStartTime: new Date().toISOString(),
};

export default function MatchSummaryDemo() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedView style={styles.header}>
        <ThemedText variant="title">Match Summary Component Demo</ThemedText>
        <ThemedText variant="body" style={styles.description}>
          This demonstrates how linked match summaries will appear in social posts.
        </ThemedText>
      </ThemedView>

      <ThemedText variant="title" style={styles.sectionTitle}>
        Compact View
      </ThemedText>
      <MatchSummary matchData={demoMatchData} showFullDetails={false} />

      <ThemedText variant="title" style={styles.sectionTitle}>
        Detailed View
      </ThemedText>
      <MatchSummary matchData={demoMatchData} showFullDetails={true} />

      <ThemedView style={styles.infoBox}>
        <ThemedText variant="body" style={styles.infoText}>
          • Registered players (Alice, Bob, Diana) are clickable and lead to profiles
        </ThemedText>
        <ThemedText variant="body" style={styles.infoText}>
          • Guest players (Charlie) are not clickable and show "Guest" label
        </ThemedText>
        <ThemedText variant="body" style={styles.infoText}>
          • Winner team and players are highlighted in green
        </ThemedText>
        <ThemedText variant="body" style={styles.infoText}>
          • Player ratings calculated using the new 45/45/15 formula
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  description: {
    marginTop: 8,
    color: '#6B7280',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  infoText: {
    marginBottom: 8,
    color: '#374151',
    lineHeight: 20,
  },
});

import { HapticBackButton } from '@/components/HapticBackButton';
import { Leaderboard as LeaderboardComponent } from '@/components/Leaderboard';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const BackButton = () => (
    <HapticBackButton
      onPress={() => router.back()}
      style={styles.backButton}
      color={theme.colors.primary}
    />
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText variant="title">Leaderboard</ThemedText>
        </ThemedView>

        {/* Full Leaderboard */}
        <LeaderboardComponent maxPlayers={25} showHeader={true} />
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
  headerSubtext: {
    marginTop: 4,
    opacity: 0.7,
  },
});

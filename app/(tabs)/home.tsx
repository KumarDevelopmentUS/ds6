// app/(tabs)/home.tsx
import { MenuCard } from '@/components/MenuCard';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { debugFeedProvider, debugRLSPolicies, debugUserCommunities, forceFeedRefetch, joinCommunityManually, refreshFeedCache, testDatabaseConnection } from '@/utils/profileSync';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

// Array of fun dice facts
const diceFacts = [
  'The oldest known dice were excavated in Iran and date back 5,000 years!',
  'In ancient Rome, throwing dice was illegal except during Saturnalia festivals.',
  'The opposite sides of a standard die always add up to 7.',
  "The dots on dice are called 'pips' - a term that dates back to the 14th century.",
  'Casino dice are transparent to prevent cheating with weighted dice.',
  "The world's largest die weighs over 4,500 pounds and is located in Las Vegas!",
  'In Japan, dice games were so popular that the government banned them multiple times throughout history.',
  'The probability of rolling snake eyes (two ones) is 1 in 36, or about 2.78%.',
  "Medieval dice were often made from animal bones, earning them the nickname 'bones'.",
  'The ancient Greeks believed dice rolls were controlled by the gods, not chance.',
  'In World War II, British POWs received escape maps hidden inside Monopoly dice.',
  'The most expensive dice ever sold were ancient Roman dice that fetched $17,925 at auction.',
  'Dice have been found in Egyptian tombs dating back to 2000 BCE.',
  "The phrase 'no dice' meaning 'no luck' originated in American slang in the early 20th century.",
  'Professional casino dice are manufactured to a tolerance of 0.0005 inches!',
  'The Unicode character for die face-1 is ⚀ and was added in 1993.',
  'In Dungeons & Dragons, a natural 20 (rolling 20 on a d20) is cause for celebration!',
  'The ancient Chinese game of Sic Bo uses three dice and dates back to ancient China.',
  'Fuzzy dice hanging from rearview mirrors became popular in the 1950s as a symbol of rebellion.',
  "The phrase 'the die is cast' was famously said by Julius Caesar when crossing the Rubicon.",
  "The word 'Dice' is derived from the Old French word 'dé', which means 'die'!",
  "Does anyone read these facts? If you do, you're rolling with the best!",
  "The ancient Babylonians used dice made from whale bones for their sacred rituals!",
  "In medieval times, dice were considered so addictive that many kingdoms banned them entirely.",
  "The first loaded dice were discovered in a 2,000-year-old Roman archaeological site.",
  "Casino dice weigh exactly 2.5 grams and must be perfectly balanced to 1/5000th of an inch.",
  "The ancient Vikings believed that dice rolls could predict the outcome of battles.",
  "In 17th century France, dice games were so popular that Louis XIV banned them at court.",
  "The probability of rolling three sixes in a row is 1 in 216, or about 0.46%.",
  "Ancient Chinese emperors used ivory dice inlaid with gold for royal gaming sessions.",
  "The term 'loaded dice' originally referred to dice weighted with mercury or lead.",
  "In ancient Greece, dice were thrown to choose which gods to worship each day.",
  "The world record for most dice rolled simultaneously is 33,616 dice in one throw!",
  "Medieval monks were forbidden from playing dice games, calling them 'the devil's bones'.",
  "The first transparent dice were created in 1960 to prevent casino cheating.",
  "Ancient Egyptian pharaohs were buried with golden dice for entertainment in the afterlife.",
  "The phrase 'dice with death' originated from Roman gladiator gambling traditions.",
  "In feudal Japan, samurai used dice to determine battle formations and strategies.",
  "The smallest functional dice ever made measures just 0.3 millimeters per side.",
  "Ancient Persian dice were carved from precious gems and passed down through generations.",
  "The mathematical study of dice probability laid the foundation for modern statistics.",
  "In colonial America, dice games were banned in most settlements as immoral gambling.",
  "The first electronic dice were invented in 1975 for early computer gaming systems.",
  "Are you still rolling through these facts? You must really love the randomness of knowledge!",
  "In ancient China, dice were used to predict the future and fortune-telling.",
];

export default function MainMenuScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState({
    totalGames: 0,
    winRate: 0,
    avgScore: 0,
  });
  const [randomFact, setRandomFact] = useState('');

  useEffect(() => {
    loadUserData();
    // Select a random fact when component mounts
    const randomIndex = Math.floor(Math.random() * diceFacts.length);
    setRandomFact(diceFacts[randomIndex]);
  }, [session]);

  const loadUserData = async () => {
    if (session?.user) {
      const firstName =
        session.user.user_metadata?.first_name ||
        session.user.user_metadata?.nickname ||
        'Player';
      setUserName(firstName);

      try {
        // Load real user stats from saved_matches
        const { data: matches, error } = await supabase
          .from('saved_matches')
          .select('*')
          .eq('userId', session.user.id);

        if (error) throw error;

        if (matches && matches.length > 0) {
          // Filter matches where user was actually playing (not just hosting)
          const playerMatches = matches.filter(match => {
            // Check if user was assigned to a player slot
            const userSlot = Object.entries(match.userSlotMap || {}).find(
              ([_, userId]) => userId === session.user.id
            );
            return userSlot !== undefined;
          });

          if (playerMatches.length > 0) {
            // Calculate stats only from matches where user was a player
            let totalWins = 0;
            let totalScore = 0;

            playerMatches.forEach(match => {
              // Find user's team
              const userSlot = Object.entries(match.userSlotMap).find(
                ([_, userId]) => userId === session.user.id
              )?.[0];

              if (userSlot) {
                const playerSlot = parseInt(userSlot);
                const userTeam = playerSlot <= 2 ? 1 : 2;

                // Check if user's team won
                if (match.winnerTeam === userTeam) {
                  totalWins++;
                }

                // Add user's score from this match
                const userStats = match.playerStats[playerSlot];
                if (userStats) {
                  totalScore += userStats.score || 0;
                }
              }
            });

            const winRate =
              playerMatches.length > 0
                ? Math.round((totalWins / playerMatches.length) * 100)
                : 0;
            const avgScore =
              playerMatches.length > 0
                ? Math.round(totalScore / playerMatches.length)
                : 0;

            setStats({
              totalGames: playerMatches.length,
              winRate: winRate,
              avgScore: avgScore,
            });
          } else {
            // User has saved matches but wasn't a player in any
            setStats({
              totalGames: 0,
              winRate: 0,
              avgScore: 0,
            });
          }
        } else {
          // No matches found
          setStats({
            totalGames: 0,
            winRate: 0,
            avgScore: 0,
          });
        }
      } catch (error) {
        console.error('Error loading user stats:', error);
        // Fallback to zeros on error
        setStats({
          totalGames: 0,
          winRate: 0,
          avgScore: 0,
        });
      }
    } else {
      setUserName('Guest');
      // Guest stats
      setStats({
        totalGames: 0,
        winRate: 0,
        avgScore: 0,
      });
    }
  };

  const handleQuickStart = () => {
    // Generate room code with only capital letters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomCode = '';
    for (let i = 0; i < 6; i++) {
      roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    router.push({
      pathname: '/tracker/[roomCode]',
      params: { roomCode },
    } as any);
  };

  const handleJoinRoom = () => {
    Alert.prompt(
      'Join Room',
      'Enter room code:',
      code => {
        if (code && code.length === 6) {
          const upperCode = code.toUpperCase(); // Convert to uppercase
          router.push({
            pathname: '/tracker/[roomCode]',
            params: { roomCode: upperCode },
          } as any);
        } else {
          Alert.alert('Invalid Code', 'Room code must be 6 characters');
        }
      },
      'plain-text'
    );
  };

  const handleAuthRequired = (action: string) => {
    if (!session) {
      Alert.alert('Sign In Required', `Please sign in to ${action}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return false;
    }
    return true;
  };

  // Debug functions
  const handleTestJoinCommunity = () => {
    joinCommunityManually('arizona_state_university', 'school');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText variant="title">Hello, {userName}! 👋</ThemedText>
        <ThemedText variant="caption" style={styles.headerSubtext}>
          Ready to play?
        </ThemedText>
      </ThemedView>

      {/* Quick Stats - Show login prompt for guests */}
      {session ? (
        <ThemedView variant="card" style={styles.statsCard}>
          <ThemedText variant="subtitle" style={styles.statsTitle}>
            Your Stats
          </ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <ThemedText variant="title" color="primary">
                {stats.totalGames}
              </ThemedText>
              <ThemedText variant="caption">Games</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText variant="title" color="success">
                {stats.winRate}%
              </ThemedText>
              <ThemedText variant="caption">Win Rate</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText variant="title" color="warning">
                {stats.avgScore}
              </ThemedText>
              <ThemedText variant="caption">Avg Score</ThemedText>
            </View>
          </View>
        </ThemedView>
      ) : (
        <ThemedView variant="card" style={styles.statsCard}>
          <ThemedText variant="subtitle" style={styles.statsTitle}>
            Track Your Progress
          </ThemedText>
          <ThemedText variant="body" style={styles.guestText}>
            Sign in to save your game history and track your stats!
          </ThemedText>
          <ThemedButton
            title="Sign In"
            onPress={() => router.push('/(auth)/login')}
            size="medium"
            style={{ marginTop: 16 }}
          />
        </ThemedView>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <ThemedButton
          title="Quick Start"
          onPress={handleQuickStart}
          size="large"
          icon={<Ionicons name="flash" size={24} color="#FFFFFF" />}
          style={styles.quickStartButton}
        />

        <ThemedButton
          title="Join Room"
          variant="outline"
          onPress={() => router.push('/tracker/join')}
          size="large"
          icon={
            <Ionicons
              name="enter-outline"
              size={24}
              color={theme.colors.primary}
            />
          }
          style={styles.joinButton}
        />
      </View>

      {/* Menu Options */}
      <View style={styles.menuGrid}>
        <MenuCard
          title="Game History"
          icon="time-outline"
          color={theme.colors.info}
          onPress={() => {
            if (handleAuthRequired('view game history')) {
              // CORRECTED: Use absolute path
              router.push('/history');
            }
          }}
        />
        <MenuCard
          title="Statistics"
          icon="stats-chart"
          color={theme.colors.success}
          onPress={() => {
            if (handleAuthRequired('view statistics')) {
              // CORRECTED: Use absolute path
              router.push('/stats');
            }
          }}
        />
        <MenuCard
          title="Friends"
          icon="people-outline"
          color={theme.colors.warning}
          onPress={() => {
            if (handleAuthRequired('view friends')) {
              // Corrected action text
              // CORRECTED: Use absolute path
              router.push('/friends');
            }
          }}
        />
        <MenuCard
          title="Tournaments"
          icon="trophy-outline"
          color={theme.colors.error}
          onPress={() =>
            Alert.alert('Coming Soon', 'Tournaments will be available soon!')
          }
        />
      </View>

      {/* Fun Fact Section */}
      <ThemedView variant="card" style={styles.funFactCard}>
        <View style={styles.funFactHeader}>
          <Ionicons name="dice" size={24} color={theme.colors.primary} />
          <ThemedText variant="subtitle" style={styles.funFactTitle}>
            Did You Know?
          </ThemedText>
        </View>
        <ThemedText variant="body" style={styles.funFactText}>
          {randomFact}
        </ThemedText>
      </ThemedView>

      {/* Debug Section - Only show for authenticated users */}
      {false && session && (
        <ThemedView variant="card" style={styles.debugCard}>
          <View style={styles.debugHeader}>
            <Ionicons name="bug" size={24} color={theme.colors.warning} />
            <ThemedText variant="subtitle" style={styles.debugTitle}>
              Debug Tools
            </ThemedText>
          </View>
          <View style={styles.debugButtons}>
            <ThemedButton
              title="🧪 Test DB"
              variant="outline"
              onPress={testDatabaseConnection}
              size="small"
              style={styles.debugButton}
            />
            <ThemedButton
              title="🏘️ My Communities"
              variant="outline"
              onPress={debugUserCommunities}
              size="small"
              style={styles.debugButton}
            />
            <ThemedButton
              title="📡 Feed Provider"
              variant="outline"
              onPress={debugFeedProvider}
              size="small"
              style={styles.debugButton}
            />
            <ThemedButton
              title="🔄 Fresh Query"
              variant="outline"
              onPress={forceFeedRefetch}
              size="small"
              style={styles.debugButton}
            />
            <ThemedButton
              title="🔐 Check RLS"
              variant="outline"
              onPress={debugRLSPolicies}
              size="small"
              style={styles.debugButton}
            />
            <ThemedButton
              title="🔄 Refresh Cache"
              variant="outline"
              onPress={refreshFeedCache}
              size="small"
              style={styles.debugButton}
            />
            <ThemedButton
              title="🎓 Join ASU"
              variant="outline"
              onPress={handleTestJoinCommunity}
              size="small"
              style={styles.debugButton}
            />
          </View>
        </ThemedView>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerSubtext: {
    marginTop: 4,
  },
  statsCard: {
    marginBottom: 24,
  },
  statsTitle: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  guestText: {
    textAlign: 'center',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickStartButton: {
    flex: 1,
  },
  joinButton: {
    flex: 1,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  funFactCard: {
    marginTop: 24,
    marginBottom: 20,
  },
  funFactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  funFactTitle: {
    marginLeft: 8,
    marginBottom: 0,
  },
  funFactText: {
    lineHeight: 22,
    fontStyle: 'italic',
  },
  debugCard: {
    marginTop: 16,
    marginBottom: 20,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  debugTitle: {
    marginLeft: 8,
    marginBottom: 0,
  },
  debugButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  debugButton: {
    flex: 1,
    minWidth: 100,
  },
});

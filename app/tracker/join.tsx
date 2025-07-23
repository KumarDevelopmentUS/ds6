// app/tracker/join.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface LiveMatch {
  id: string;
  roomCode: string;
  hostId: string;
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
  participants: string[];
  userSlotMap: { [key: string]: string | null };
  livePlayerStats: any;
  matchStartTime: string | null;
}

export default function JoinMatchScreen() {
  const { roomCode } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { theme } = useTheme();
  
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  
  // Auth state for login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');

  // Load live match data
  const loadLiveMatch = useCallback(async () => {
    if (!roomCode || Array.isArray(roomCode)) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_matches')
        .select('*')
        .eq('roomCode', roomCode)
        .in('status', ['waiting', 'active'])
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
        hostId: data.hostId,
        status: data.status,
        matchSetup: data.matchSetup || {
          title: 'Match',
          arena: 'Arena',
          playerNames: ['Player1', 'Player2', 'Player3', 'Player4'],
          teamNames: ['Team 1', 'Team 2'],
          gameScoreLimit: 11,
          sinkPoints: 3,
          winByTwo: true,
        },
        participants: data.participants || [],
        userSlotMap: data.userSlotMap || {},
        livePlayerStats: data.livePlayerStats || {},
        matchStartTime: data.matchStartTime,
      });
    } catch (error) {
      console.error('Error loading live match:', error);
      setErrorMessage('Failed to load match');
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    loadLiveMatch();
  }, [loadLiveMatch]);

  // Handle authentication
  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
              display_name: username || 'Player',
            },
          },
        });

        if (error) throw error;
        if (data.user) {
          setErrorMessage('Please check your email to confirm your account');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (data.user) {
          setShowLogin(false);
          setErrorMessage('');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setErrorMessage(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle joining as a specific player
  const handleJoinAsPlayer = async (playerSlot: number) => {
    if (!session?.user || !liveMatch) {
      setErrorMessage('Must be logged in to join');
      return;
    }

    // Check if slot is already taken by another user
    if (liveMatch.userSlotMap[playerSlot.toString()] && 
        liveMatch.userSlotMap[playerSlot.toString()] !== session.user.id) {
      Alert.alert('Slot Taken', `Player slot ${playerSlot} is already taken by another user.`);
      return;
    }

    // Check if user is already in a different slot
    const existingSlot = Object.keys(liveMatch.userSlotMap).find(
      key => liveMatch.userSlotMap[key] === session.user.id
    );
    if (existingSlot && existingSlot !== playerSlot.toString()) {
      Alert.alert('Already Joined', `You are already assigned to Player slot ${existingSlot}. You can only join one slot per match.`);
      return;
    }

    setIsJoining(true);
    try {
      // Get user profile for nickname
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', session.user.id)
        .single();

      const nickname = profileData?.nickname || session.user.email?.split('@')[0] || `Player ${playerSlot}`;

      // Update match data
      const updatedUserSlotMap = { 
        ...liveMatch.userSlotMap, 
        [playerSlot.toString()]: session.user.id 
      };
      
      const updatedParticipants = liveMatch.participants.includes(session.user.id)
        ? liveMatch.participants
        : [...liveMatch.participants, session.user.id];

      const updatedPlayerNames = [...liveMatch.matchSetup.playerNames];
      updatedPlayerNames[playerSlot - 1] = nickname;

      const updatedPlayerStats = { ...liveMatch.livePlayerStats };
      if (updatedPlayerStats[playerSlot]) {
        updatedPlayerStats[playerSlot].name = nickname;
      }

      const { error: updateError } = await supabase
        .from('live_matches')
        .update({
          userSlotMap: updatedUserSlotMap,
          participants: updatedParticipants,
          matchSetup: {
            ...liveMatch.matchSetup,
            playerNames: updatedPlayerNames
          },
          livePlayerStats: updatedPlayerStats
        })
        .eq('id', liveMatch.id);

      if (updateError) throw updateError;

      Alert.alert('Success', `You have successfully joined as ${nickname}!`, [
        {
          text: 'Go to Match',
          onPress: () => router.push(`/tracker/${roomCode}`)
        }
      ]);
      
    } catch (error: any) {
      console.error('Error joining match:', error);
      setErrorMessage(`Failed to join match: ${error.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  // Handle joining as spectator
  const handleJoinAsSpectator = async () => {
    if (!session?.user || !liveMatch) {
      setErrorMessage('Must be logged in to join as spectator');
      return;
    }

    setIsJoining(true);
    try {
      const updatedParticipants = liveMatch.participants.includes(session.user.id)
        ? liveMatch.participants
        : [...liveMatch.participants, session.user.id];

      const { error } = await supabase
        .from('live_matches')
        .update({ participants: updatedParticipants })
        .eq('id', liveMatch.id);

      if (error) throw error;

      router.push(`/tracker/${roomCode}`);
    } catch (error: any) {
      console.error('Error joining as spectator:', error);
      setErrorMessage('Failed to join as spectator: ' + error.message);
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText style={styles.loadingText}>Loading match...</ThemedText>
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
            The match with room code "{roomCode}" could not be found or has ended.
          </ThemedText>
          <ThemedButton 
            title="Go Home" 
            onPress={() => router.push('/')}
            style={styles.button}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HapticBackButton 
        onPress={() => router.back()} 
        style={styles.backButton}
      />

      <ScrollView style={styles.content}>
        {/* Match Info */}
        <ThemedView variant="card" style={styles.matchCard}>
          <ThemedText variant="title">Join Match</ThemedText>
          <ThemedText variant="subtitle">{liveMatch.matchSetup.title}</ThemedText>
          <ThemedText variant="body">{liveMatch.matchSetup.arena}</ThemedText>
          <ThemedText variant="caption">Room Code: {roomCode}</ThemedText>
          <ThemedText variant="caption">
            Status: {liveMatch.status === 'waiting' ? 'Waiting to Start' : 'In Progress'}
          </ThemedText>
        </ThemedView>

        {/* Login Section */}
        {!session ? (
          <ThemedView variant="card" style={styles.authCard}>
            <ThemedText variant="subtitle">Login Required</ThemedText>
            <ThemedText variant="body" style={styles.authText}>
              You need to be logged in to join this match.
            </ThemedText>

            {!showLogin ? (
              <View style={styles.authButtons}>
                <ThemedButton
                  title="Login"
                  onPress={() => setShowLogin(true)}
                  style={styles.button}
                />
                <ThemedButton
                  title="Continue as Guest"
                  onPress={() => router.push(`/tracker/${roomCode}`)}
                  variant="outline"
                  style={styles.button}
                />
              </View>
            ) : (
              <View>
                {isSignUp && (
                  <ThemedInput
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    style={styles.input}
                  />
                )}
                <ThemedInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <ThemedInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={styles.input}
                />
                <View style={styles.authButtons}>
                  <ThemedButton
                    title={isSignUp ? 'Sign Up' : 'Login'}
                    onPress={handleLogin}
                    loading={isLoading}
                    style={styles.button}
                  />
                  <ThemedButton
                    title={isSignUp ? 'Have an account?' : 'Need an account?'}
                    onPress={() => setIsSignUp(!isSignUp)}
                    variant="outline"
                    style={styles.button}
                  />
                </View>
              </View>
            )}
          </ThemedView>
        ) : (
          /* Player Selection */
          <ThemedView variant="card" style={styles.playersCard}>
            <ThemedText variant="subtitle">Select Player Slot</ThemedText>
            <ThemedText variant="body" style={styles.instructionText}>
              Choose which player you want to control:
            </ThemedText>

            <View style={styles.playerGrid}>
              {[1, 2, 3, 4].map((playerId) => {
                const isSlotTaken = !!(liveMatch.userSlotMap[playerId.toString()] && 
                                   liveMatch.userSlotMap[playerId.toString()] !== session.user?.id);
                const isMySlot = liveMatch.userSlotMap[playerId.toString()] === session.user?.id;

                return (
                  <TouchableOpacity
                    key={playerId}
                    style={[
                      styles.playerSlot,
                      isSlotTaken && styles.playerSlotTaken,
                      isMySlot && styles.playerSlotMine,
                    ]}
                    onPress={() => handleJoinAsPlayer(playerId)}
                    disabled={isJoining || isSlotTaken}
                  >
                    <Text style={[
                      styles.playerSlotText,
                      isSlotTaken && styles.playerSlotTextTaken
                    ]}>
                      {liveMatch.matchSetup.playerNames[playerId - 1]}
                    </Text>
                    <Text style={styles.playerSlotNumber}>Player {playerId}</Text>
                    {isSlotTaken && <Text style={styles.takenText}>Taken</Text>}
                    {isMySlot && <Text style={styles.mySlotText}>You</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedButton
              title="Join as Spectator"
              onPress={handleJoinAsSpectator}
              variant="outline"
              loading={isJoining}
              style={styles.spectatorButton}
            />
          </ThemedView>
        )}

        {/* Game Rules */}
        <ThemedView variant="card" style={styles.rulesCard}>
          <ThemedText variant="subtitle">Game Rules</ThemedText>
          <ThemedText variant="caption">• First to {liveMatch.matchSetup.gameScoreLimit} points</ThemedText>
          <ThemedText variant="caption">• Sink worth {liveMatch.matchSetup.sinkPoints} points</ThemedText>
          <ThemedText variant="caption">• Win by two: {liveMatch.matchSetup.winByTwo ? 'ON' : 'OFF'}</ThemedText>
        </ThemedView>

        {/* Error Message */}
        {errorMessage && (
          <ThemedView variant="card" style={styles.errorCard}>
            <ThemedText variant="body" color="error">{errorMessage}</ThemedText>
          </ThemedView>
        )}

        {/* Navigation */}
        <View style={styles.navButtons}>
          <ThemedButton
            title="View Match"
            onPress={() => router.push(`/tracker/${roomCode}`)}
            variant="outline"
            style={styles.navButton}
          />
          <ThemedButton
            title="Home"
            onPress={() => router.push('/')}
            variant="ghost"
            style={styles.navButton}
          />
        </View>
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
  matchCard: {
    marginBottom: 20,
  },
  authCard: {
    marginBottom: 20,
  },
  authText: {
    marginBottom: 15,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    marginBottom: 10,
  },
  playersCard: {
    marginBottom: 20,
  },
  instructionText: {
    marginBottom: 15,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  playerSlot: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  playerSlotTaken: {
    backgroundColor: '#ccc',
  },
  playerSlotMine: {
    backgroundColor: '#28a745',
  },
  playerSlotText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  playerSlotTextTaken: {
    color: '#666',
  },
  playerSlotNumber: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
  },
  takenText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  mySlotText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  spectatorButton: {
    marginTop: 10,
  },
  rulesCard: {
    marginBottom: 20,
  },
  errorCard: {
    marginBottom: 20,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    flex: 1,
  },
  button: {
    flex: 1,
  },
}); 
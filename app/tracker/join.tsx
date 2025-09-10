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
  status: 'active' | 'finished';
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
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  
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
        .in('status', ['active'])
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

  // Smart real-time subscription for join screen (only when waiting)
  useEffect(() => {
    if (!liveMatch?.id || liveMatch.status === 'active' || liveMatch.status === 'finished') {
      console.log('Join screen: Skipping subscription - game not in waiting state');
      return;
    }

    console.log('Join screen: Setting up subscription for waiting room');

    // Only update every 2 seconds for join screen (less frequent than game tracker)
    let lastUpdateTime = 0;
    let updateBuffer: any = null;
    let timeoutId: number | null = null;

    const applyUpdate = () => {
      if (updateBuffer) {
        console.log('Join screen: Applying batched update');
        const updatedMatch = updateBuffer;

        // Update local state with live data
        setLiveMatch(prev => prev ? {
          ...prev,
          status: updatedMatch.status,
          participants: updatedMatch.participants || [],
          userSlotMap: updatedMatch.userSlotMap || {},
          matchSetup: {
            ...prev.matchSetup,
            playerNames: updatedMatch.matchSetup?.playerNames || prev.matchSetup.playerNames
          },
          livePlayerStats: updatedMatch.livePlayerStats || {},
          matchStartTime: updatedMatch.matchStartTime,
        } : null);

        // Clear any error messages when data updates successfully
        if (errorMessage) {
          setErrorMessage('');
        }

        lastUpdateTime = Date.now();
        updateBuffer = null;
      }
    };

    const subscription = supabase
      .channel(`join_screen:${liveMatch.id}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_matches',
          filter: `id=eq.${liveMatch.id}`
        },
        (payload) => {
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUpdateTime;

          updateBuffer = payload.new as LiveMatch;

          if (timeoutId) clearTimeout(timeoutId as any);

          if (timeSinceLastUpdate >= 2000) {
            // Apply immediately if 2 seconds have passed
            applyUpdate();
          } else {
            // Schedule update for 2-second mark
            timeoutId = setTimeout(applyUpdate, 2000 - timeSinceLastUpdate);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Join screen subscription error:', err);
          setIsRealtimeConnected(false);
        } else {
          console.log('Join screen subscription status:', status);
          setIsRealtimeConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      console.log('Join screen: Cleaning up smart subscription');
      if (timeoutId) clearTimeout(timeoutId as any);
      subscription.unsubscribe();
    };
  }, [liveMatch?.id, liveMatch?.status, errorMessage]);

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
      const { data: profileData } = await supabase
        .from('user_profiles')
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

      // Update local state immediately to reflect the change
      setLiveMatch(prev => prev ? {
        ...prev,
        userSlotMap: updatedUserSlotMap,
        participants: updatedParticipants,
        matchSetup: {
          ...prev.matchSetup,
          playerNames: updatedPlayerNames
        },
        livePlayerStats: updatedPlayerStats
      } : null);

      // Reset selected player state
      setSelectedPlayer(null);

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
            The match with room code &quot;{roomCode}&quot; could not be found or has ended.
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
          <View style={styles.matchHeader}>
            <View style={styles.matchTitleRow}>
              <ThemedText variant="title">Join Match</ThemedText>
              <View style={styles.realtimeIndicator}>
                <View style={[
                  styles.realtimeDot, 
                  { backgroundColor: isRealtimeConnected ? theme.colors.primary : '#ccc' }
                ]} />
                <ThemedText variant="caption" style={[
                  styles.realtimeText,
                  { opacity: isRealtimeConnected ? 0.8 : 0.4 }
                ]}>
                  {isRealtimeConnected ? 'Live' : 'Connecting...'}
                </ThemedText>
              </View>
            </View>
            <ThemedText variant="subtitle">{liveMatch.matchSetup.title}</ThemedText>
            <ThemedText variant="body">{liveMatch.matchSetup.arena}</ThemedText>
            <ThemedText variant="caption">Room Code: {roomCode}</ThemedText>
            <View style={styles.statusRow}>
              <ThemedText variant="caption">
                Status: {liveMatch.status === 'active' ? 'In Progress' : 'Finished'}
              </ThemedText>
              {liveMatch.status === 'active' && (
                <View style={styles.activeIndicator}>
                  <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} />
                  <ThemedText variant="caption" style={styles.activeText}>Match Started</ThemedText>
                </View>
              )}
            </View>
            <ThemedText variant="caption">
              Players Joined: {liveMatch.participants.length}
            </ThemedText>
          </View>
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
                const slotUserId = liveMatch.userSlotMap[playerId.toString()];
                const isAvailable = !isSlotTaken && !isMySlot;

                return (
                  <TouchableOpacity
                    key={playerId}
                    style={[
                      styles.playerSlot,
                      isSlotTaken && styles.playerSlotTaken,
                      isMySlot && styles.playerSlotMine,
                      isAvailable && styles.playerSlotAvailable,
                      isJoining && selectedPlayer === playerId && styles.playerSlotJoining,
                    ]}
                    onPress={() => {
                      setSelectedPlayer(playerId);
                      setShowConfirmDialog(true);
                    }}
                    disabled={isJoining || isSlotTaken}
                  >
                    <View style={styles.playerSlotContent}>
                      <Text style={[
                        styles.playerSlotText,
                        isSlotTaken && styles.playerSlotTextTaken,
                        isAvailable && styles.playerSlotTextAvailable
                      ]}>
                        {liveMatch.matchSetup.playerNames[playerId - 1]}
                      </Text>
                      <Text style={styles.playerSlotNumber}>Player {playerId}</Text>
                      
                      {isSlotTaken && (
                        <View style={styles.slotStatusContainer}>
                          <Text style={styles.takenText}>Taken</Text>
                          {slotUserId && (
                            <Text style={styles.userIdText}>
                              {slotUserId === session.user?.id ? 'You' : 'Other Player'}
                            </Text>
                          )}
                        </View>
                      )}
                      
                      {isMySlot && (
                        <View style={styles.slotStatusContainer}>
                          <Text style={styles.mySlotText}>You</Text>
                        </View>
                      )}
                      
                      {isAvailable && (
                        <View style={styles.slotStatusContainer}>
                          <Text style={styles.availableText}>Available</Text>
                        </View>
                      )}
                      
                      {isJoining && selectedPlayer === playerId && (
                        <View style={styles.slotStatusContainer}>
                          <ActivityIndicator size="small" color="white" />
                          <Text style={styles.joiningText}>Joining...</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>


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
            <View style={styles.errorContent}>
              <ThemedText variant="body" color="error">{errorMessage}</ThemedText>
              <ThemedButton
                title="Retry"
                onPress={loadLiveMatch}
                variant="outline"
                style={styles.retryButton}
              />
            </View>
          </ThemedView>
        )}

        {/* Navigation */}
        <View style={styles.navButtons}>
          <ThemedButton
            title="View Scoreboard"
            onPress={() => router.push(`/tracker/scoreboard?roomCode=${roomCode}`)}
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

        {/* Confirmation Dialog */}
        {showConfirmDialog && selectedPlayer && (
          <View style={styles.overlay}>
            <View style={styles.confirmDialog}>
              <ThemedText variant="subtitle" style={styles.confirmTitle}>
                Confirm Player Selection
              </ThemedText>
              <ThemedText variant="body" style={styles.confirmMessage}>
                Are you sure you want to join as {liveMatch?.matchSetup.playerNames[selectedPlayer - 1]} (Player {selectedPlayer})?
              </ThemedText>
              <View style={styles.confirmButtons}>
                <ThemedButton
                  title="Cancel"
                  onPress={() => {
                    setShowConfirmDialog(false);
                    setSelectedPlayer(null);
                  }}
                  variant="outline"
                  style={styles.confirmButton}
                />
                <ThemedButton
                  title="Confirm"
                  onPress={() => {
                    setShowConfirmDialog(false);
                    handleJoinAsPlayer(selectedPlayer);
                    setSelectedPlayer(null);
                  }}
                  loading={isJoining}
                  style={styles.confirmButton}
                />
              </View>
            </View>
          </View>
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
  matchHeader: {
    gap: 8,
  },
  matchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeText: {
    fontSize: 11,
    opacity: 0.8,
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
  realtimeText: {
    opacity: 0.8,
  },
  authCard: {
    marginBottom: 20,
  },
  authText: {
    marginBottom: 15,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'center',
    minHeight: 80,
  },
  playerSlotAvailable: {
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#0056CC',
  },
  playerSlotJoining: {
    backgroundColor: '#FF9500',
    opacity: 0.8,
  },
  playerSlotTaken: {
    backgroundColor: '#ccc',
  },
  playerSlotMine: {
    backgroundColor: '#28a745',
  },
  playerSlotContent: {
    alignItems: 'center',
    gap: 4,
  },
  playerSlotText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  playerSlotTextTaken: {
    color: '#666',
  },
  playerSlotTextAvailable: {
    color: 'white',
  },
  playerSlotNumber: {
    color: 'white',
    fontSize: 12,
    marginTop: 2,
  },
  slotStatusContainer: {
    alignItems: 'center',
    marginTop: 4,
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
  availableText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  joiningText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  userIdText: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  rulesCard: {
    marginBottom: 20,
  },
  errorCard: {
    marginBottom: 20,
  },
  errorContent: {
    gap: 12,
    alignItems: 'center',
  },
  retryButton: {
    alignSelf: 'stretch',
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
    minWidth: 120,
    maxWidth: 200,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmDialog: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  confirmTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
  },
}); 
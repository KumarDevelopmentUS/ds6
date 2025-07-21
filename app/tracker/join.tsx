// app/tracker/join.tsx
'use client';

import { createClient } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';

// Import useCallback and useEffect from React
import React, { useCallback, useEffect, useState } from 'react';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedInput } from '@/components/themed/ThemedInput';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';

// Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

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
  playerMap: { [key: string]: number };
  matchStartTime: string | null;
}

const JoinMatchPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPlayerSlot, setSelectedPlayerSlot] = useState<number | null>(
    null
  );
  const [showLogin, setShowLogin] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');

  // Get current user
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        setShowLogin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- FIX 1: Wrap loadLiveMatch in useCallback ---
  const loadLiveMatch = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_matches')
        .select('*')
        .eq('room_code', roomCode)
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
        roomCode: data.room_code,
        hostId: data.host_id,
        status: data.status,
        matchSetup: data.match_setup,
        participants: data.participants || [],
        playerMap: data.player_map || {},
        matchStartTime: data.match_start_time,
      });
    } catch (error) {
      console.error('Error loading live match:', error);
      setErrorMessage('Failed to load match');
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]); // Dependency for useCallback

  // --- FIX 2: Add loadLiveMatch to the dependency array ---
  useEffect(() => {
    if (roomCode) {
      loadLiveMatch();
    }
  }, [roomCode, loadLiveMatch]); // Correctly add loadLiveMatch here

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        // Sign up
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
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setCurrentUser(data.user);
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

  const handleJoinAsPlayer = async () => {
    if (!currentUser || !liveMatch || selectedPlayerSlot === null) {
      setErrorMessage('Please select a player slot');
      return;
    }

    // Check if player slot is already taken
    const isSlotTaken = Object.values(liveMatch.playerMap).includes(
      selectedPlayerSlot
    );
    if (isSlotTaken) {
      setErrorMessage('This player slot is already taken');
      return;
    }

    setIsJoining(true);
    try {
      const updatedPlayerMap = {
        ...liveMatch.playerMap,
        [currentUser.id]: selectedPlayerSlot,
      };

      const updatedParticipants = liveMatch.participants.includes(
        currentUser.id
      )
        ? liveMatch.participants
        : [...liveMatch.participants, currentUser.id];

      const { error } = await supabase
        .from('live_matches')
        .update({
          player_map: updatedPlayerMap,
          participants: updatedParticipants,
        })
        .eq('id', liveMatch.id);

      if (error) throw error;

      // Redirect to the main tracker page
      router.push(`/tracker/${roomCode}`);
    } catch (error: any) {
      console.error('Error joining match:', error);
      setErrorMessage('Failed to join match: ' + error.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinAsSpectator = async () => {
    if (!currentUser || !liveMatch) {
      setErrorMessage('Must be logged in to join as spectator');
      return;
    }

    setIsJoining(true);
    try {
      const updatedParticipants = liveMatch.participants.includes(
        currentUser.id
      )
        ? liveMatch.participants
        : [...liveMatch.participants, currentUser.id];

      const { error } = await supabase
        .from('live_matches')
        .update({
          participants: updatedParticipants,
        })
        .eq('id', liveMatch.id);

      if (error) throw error;

      // Redirect to the main tracker page
      router.push(`/tracker/${roomCode}`);
    } catch (error: any) {
      console.error('Error joining as spectator:', error);
      setErrorMessage('Failed to join as spectator: ' + error.message);
    } finally {
      setIsJoining(false);
    }
  };

  const getPlayerSlotStatus = (
    slotNumber: number
  ): 'available' | 'taken' | 'you' => {
    if (!liveMatch || !currentUser) return 'available';

    const userInSlot = Object.keys(liveMatch.playerMap).find(
      userId => liveMatch.playerMap[userId] === slotNumber
    );

    if (userInSlot === currentUser.id) return 'you';
    if (userInSlot) return 'taken';
    return 'available';
  };

  const getUsernameForSlot = (slotNumber: number): string => {
    if (!liveMatch) return '';

    const userId = Object.keys(liveMatch.playerMap).find(
      id => liveMatch.playerMap[id] === slotNumber
    );

    if (userId) {
      // In a real app, you'd fetch the username from user_profiles
      return `User ${userId.slice(0, 8)}`;
    }

    return '';
  };

  if (isLoading) {
    return (
      <ThemedView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <ThemedText variant="title">Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!liveMatch) {
    return (
      <ThemedView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <ThemedText variant="title" color="error">
          Match Not Found
        </ThemedText>
        {/* --- FIX 3: Replace " with &quot; --- */}
        <ThemedText
          variant="body"
          style={{ textAlign: 'center', marginBottom: 20 }}
        >
          The match with room code &quot;{roomCode}&quot; could not be found or
          has ended.
        </ThemedText>
        <ThemedButton title="Go Home" onPress={() => router.push('/')} />
      </ThemedView>
    );
  }

  if (liveMatch.status === 'finished') {
    return (
      <ThemedView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <ThemedText variant="title" color="warning">
          Match Finished
        </ThemedText>
        <ThemedText
          variant="body"
          style={{ textAlign: 'center', marginBottom: 20 }}
        >
          This match has already finished.
        </ThemedText>
        <ThemedButton
          title="View Results"
          onPress={() => router.push(`/tracker/${roomCode}`)}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, padding: 20 }}>
      {/* Header */}
      <ThemedView variant="card" style={{ marginBottom: 20 }}>
        <ThemedText variant="title">Join Match</ThemedText>
        <ThemedText variant="subtitle">{liveMatch.matchSetup.title}</ThemedText>
        <ThemedText variant="body">{liveMatch.matchSetup.arena}</ThemedText>
        <ThemedText variant="caption">Room Code: {roomCode}</ThemedText>
        <ThemedText variant="caption">
          Status:{' '}
          {liveMatch.status === 'waiting' ? 'Waiting to Start' : 'In Progress'}
        </ThemedText>
        {liveMatch.matchStartTime && (
          <ThemedText variant="caption">
            Started: {new Date(liveMatch.matchStartTime).toLocaleTimeString()}
          </ThemedText>
        )}
      </ThemedView>

      {/* Login Section */}
      {!currentUser && (
        <ThemedView variant="card" style={{ marginBottom: 20 }}>
          <ThemedText variant="subtitle">Login Required</ThemedText>
          <ThemedText variant="body" style={{ marginBottom: 15 }}>
            You need to be logged in to join this match.
          </ThemedText>

          {!showLogin ? (
            <ThemedView style={{ flexDirection: 'row', gap: 10 }}>
              <ThemedButton
                title="Login"
                onPress={() => setShowLogin(true)}
                variant="primary"
              />
              <ThemedButton
                title="Continue as Guest"
                onPress={() => router.push(`/tracker/${roomCode}`)}
                variant="outline"
              />
            </ThemedView>
          ) : (
            <ThemedView>
              {isSignUp && (
                <ThemedInput
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                  style={{ marginBottom: 10 }}
                />
              )}

              <ThemedInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ marginBottom: 10 }}
              />

              <ThemedInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{ marginBottom: 15 }}
              />

              <ThemedView
                style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}
              >
                <ThemedButton
                  title={isSignUp ? 'Sign Up' : 'Login'}
                  onPress={handleLogin}
                  loading={isLoading}
                  variant="primary"
                />
                <ThemedButton
                  title="Cancel"
                  onPress={() => setShowLogin(false)}
                  variant="outline"
                />
              </ThemedView>

              <ThemedButton
                title={
                  isSignUp
                    ? 'Already have an account? Login'
                    : 'Need an account? Sign Up'
                }
                onPress={() => setIsSignUp(!isSignUp)}
                variant="ghost"
                size="small"
              />
            </ThemedView>
          )}
        </ThemedView>
      )}

      {/* Team Layout */}
      {currentUser && (
        <ThemedView variant="card" style={{ marginBottom: 20 }}>
          <ThemedText variant="subtitle">Choose Your Role</ThemedText>

          {/* Team 1 */}
          <ThemedView style={{ marginBottom: 20 }}>
            <ThemedText
              variant="body"
              style={{ fontWeight: 'bold', marginBottom: 10 }}
            >
              {liveMatch.matchSetup.teamNames[0]}
            </ThemedText>

            <ThemedView
              style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}
            >
              {[1, 2].map(slotNumber => {
                const status = getPlayerSlotStatus(slotNumber);
                const username = getUsernameForSlot(slotNumber);

                return (
                  <ThemedView key={slotNumber} style={{ flex: 1 }}>
                    <ThemedButton
                      title={`${
                        liveMatch.matchSetup.playerNames[slotNumber - 1]
                      }`}
                      variant={
                        selectedPlayerSlot === slotNumber
                          ? 'primary'
                          : status === 'taken'
                          ? 'secondary'
                          : status === 'you'
                          ? 'primary'
                          : 'outline'
                      }
                      disabled={status === 'taken'}
                      onPress={() => setSelectedPlayerSlot(slotNumber)}
                      style={{ marginBottom: 5 }}
                    />
                    <ThemedText
                      variant="caption"
                      style={{ textAlign: 'center' }}
                    >
                      {status === 'taken'
                        ? `Taken by ${username}`
                        : status === 'you'
                        ? 'You'
                        : 'Available'}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          </ThemedView>

          {/* Team 2 */}
          <ThemedView style={{ marginBottom: 20 }}>
            <ThemedText
              variant="body"
              style={{ fontWeight: 'bold', marginBottom: 10 }}
            >
              {liveMatch.matchSetup.teamNames[1]}
            </ThemedText>

            <ThemedView
              style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}
            >
              {[3, 4].map(slotNumber => {
                const status = getPlayerSlotStatus(slotNumber);
                const username = getUsernameForSlot(slotNumber);

                return (
                  <ThemedView key={slotNumber} style={{ flex: 1 }}>
                    <ThemedButton
                      title={`${
                        liveMatch.matchSetup.playerNames[slotNumber - 1]
                      }`}
                      variant={
                        selectedPlayerSlot === slotNumber
                          ? 'primary'
                          : status === 'taken'
                          ? 'secondary'
                          : status === 'you'
                          ? 'primary'
                          : 'outline'
                      }
                      disabled={status === 'taken'}
                      onPress={() => setSelectedPlayerSlot(slotNumber)}
                      style={{ marginBottom: 5 }}
                    />
                    <ThemedText
                      variant="caption"
                      style={{ textAlign: 'center' }}
                    >
                      {status === 'taken'
                        ? `Taken by ${username}`
                        : status === 'you'
                        ? 'You'
                        : 'Available'}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          </ThemedView>

          {/* Action Buttons */}
          <ThemedView style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <ThemedButton
              title="Join as Player"
              onPress={handleJoinAsPlayer}
              loading={isJoining}
              disabled={selectedPlayerSlot === null}
              variant="primary"
              style={{ flex: 1 }}
            />
            <ThemedButton
              title="Join as Spectator"
              onPress={handleJoinAsSpectator}
              loading={isJoining}
              variant="outline"
              style={{ flex: 1 }}
            />
          </ThemedView>
        </ThemedView>
      )}

      {/* Game Rules */}
      <ThemedView variant="card" style={{ marginBottom: 20 }}>
        <ThemedText variant="subtitle">Game Rules</ThemedText>
        <ThemedText variant="caption">
          • First to {liveMatch.matchSetup.gameScoreLimit} points
        </ThemedText>
        <ThemedText variant="caption">
          • Sink worth {liveMatch.matchSetup.sinkPoints} points
        </ThemedText>
        <ThemedText variant="caption">
          • Win by two: {liveMatch.matchSetup.winByTwo ? 'ON' : 'OFF'}
        </ThemedText>
      </ThemedView>

      {/* Error Message */}
      {errorMessage && (
        <ThemedView variant="card" style={{ marginBottom: 20 }}>
          <ThemedText variant="body" color="error">
            {errorMessage}
          </ThemedText>
        </ThemedView>
      )}

      {/* Navigation */}
      <ThemedView style={{ flexDirection: 'row', gap: 10 }}>
        <ThemedButton
          title="View Match"
          onPress={() => router.push(`/tracker/${roomCode}`)}
          variant="outline"
          style={{ flex: 1 }}
        />
        <ThemedButton
          title="Home"
          onPress={() => router.push('/')}
          variant="ghost"
          style={{ flex: 1 }}
        />
      </ThemedView>
    </ThemedView>
  );
};

export default JoinMatchPage;

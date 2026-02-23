// app/tracker/[roomCode]/page.tsx
'use client';

import { HapticBackButton } from '@/components/HapticBackButton';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';

// Simple ID generator for room codes
const generateId = (length: number = 6): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // Only capital letters
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// NEW: Updated PlayerStats interface for Beer Die ruleset - matches types/social.ts
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
  tableThrows: number;
  goals: number;
  onFireCount: number;
  currentlyOnFire: boolean;

  // NEW: Beer Die throw outcomes
  line: number;
  hit: number;
  goal: number;
  dink: number;
  sink: number;
  invalid: number; // Replaces all old bad throws

  // NEW: Beer Die defense outcomes
  miss: number; // Only miss, no drop/twoHands/body/catchPlusAura

  // FIFA outcomes
  goodKick: number;
  badKick: number;

  // NEW: Additional Beer Die stats
  validThrows: number;      // Count of valid throws (line, hit, goal, dink, sink)
  catchAttempts: number;    // Count of defensive attempts
  successfulCatches: number; // Count of successful catches
  redemptionShots: number;  // Count of redemption attempts
}

// Type for match setup, consistent with your jsonb schema
interface MatchSetup {
  title: string;
  arena: string;
  playerNames: string[];
  teamNames: string[];
  gameScoreLimit: number;
  sinkPoints: number;
  winByTwo: boolean;
}

// Type for live match data, directly mapping to the live_matches table
interface LiveMatch {
  id: string;
  roomCode: string;
  hostId: string | null; // HostId can be null for guest matches
  status: 'active' | 'finished';
  createdAt: string;
  matchSetup: MatchSetup;
  participants: string[];
  userSlotMap: { [key: string]: string | null }; // Maps player slot (string) to userId (string) or null
  livePlayerStats: { [key: number]: PlayerStats };
  liveTeamPenalties: { [key: string]: number };
  matchStartTime: string | null;
  winnerTeam: number | null;
}

const DieStatsTracker: React.FC = () => {
  const { roomCode } = useLocalSearchParams();
  const roomCodeString = Array.isArray(roomCode) ? roomCode[0] : roomCode || generateId(6);
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Core game state, initialized with default values
  const [matchSetup, setMatchSetup] = useState<MatchSetup>({
    title: 'Finals',
    arena: 'The Grand Dome',
    playerNames: ['Player1', 'Player2', 'Player3', 'Player4'],
    teamNames: ['Team 1', 'Team 2'],
    gameScoreLimit: 11,
    sinkPoints: 3,
    winByTwo: true,
  });

  const [playerStats, setPlayerStats] = useState<{ [key: number]: PlayerStats }>({});
  const [teamPenalties, setTeamPenalties] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [matchStartTime, setMatchStartTime] = useState<Date | null>(null);
  const [matchFinished, setMatchFinished] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState<number | null>(null);

  // Manual score adjustment state
  const [manualAdjustments, setManualAdjustments] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [adjustmentHistory, setAdjustmentHistory] = useState<{
    team: number;
    amount: number;
    timestamp: Date;
  }[]>([]);

  // Live session state for real-time updates
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null); // Supabase user object
  const [loadingAuth, setLoadingAuth] = useState(true); // Added local loadingAuth state
  const [isHost, setIsHost] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  // State to store player slot to user ID mapping
  const [userSlotMap, setUserSlotMap] = useState<{ [key: string]: string | null }>({});



  // UI state for managing different views and interactions
  const [isSetupVisible, setIsSetupVisible] = useState(true); // Control setup visibility, starts true
  const [showStats, setShowStats] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showManualAdjust, setShowManualAdjust] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State for tracking current play actions
  const [throwingPlayer, setThrowingPlayer] = useState<number | null>(null);
  const [throwResult, setThrowResult] = useState<string>('');
  const [defendingPlayer, setDefendingPlayer] = useState<number | null>(null);
  const [defendingResult, setDefendingResult] = useState<string>('');
  const [fifaKicker, setFifaKicker] = useState<number | null>(null);
  const [fifaAction, setFifaAction] = useState<string>('');
  const [showFifa, setShowFifa] = useState(false);
  // NEW: showRedemption removed - redemption is now a throw result
  const [showQRCode, setShowQRCode] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showHomeConfirmation, setShowHomeConfirmation] = useState(false);
  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false);

  // NEW: Helper function to get initial empty player stats - Beer Die ruleset
  const getInitialPlayerStats = (): PlayerStats => ({
    name: '',
    throws: 0,
    hits: 0,
    blunders: 0,
    catches: 0,
    score: 0,
    aura: 0,
    fifaAttempts: 0,
    fifaSuccess: 0,
    hitStreak: 0,
    specialThrows: 0,
    lineThrows: 0,
    tableThrows: 0,
    goals: 0,
    onFireCount: 0,
    currentlyOnFire: false,
    
    // NEW: Beer Die throw outcomes
    line: 0,
    hit: 0,
    goal: 0,
    dink: 0,
    sink: 0,
    invalid: 0, // Replaces all old bad throws

    // NEW: Beer Die defense outcomes  
    miss: 0, // Only miss, no other defense options

    // FIFA outcomes
    goodKick: 0,
    badKick: 0,

    // NEW: Additional Beer Die stats
    validThrows: 0,      // Count of valid throws (line, hit, goal, dink, sink)
    catchAttempts: 0,    // Count of defensive attempts
    successfulCatches: 0, // Count of successful catches
    redemptionShots: 0,  // Count of redemption attempts
  });

  // Initialize player stats and router redirection on component mount
  useEffect(() => {
    console.log('DieStatsTracker: Component mounted, initializing player stats.');
    const initialStats: { [key: number]: PlayerStats } = {};
    for (let i = 1; i <= 4; i++) {
      initialStats[i] = getInitialPlayerStats();
    }
    setPlayerStats(initialStats);

    // Redirect to the correct roomCode if not already there
    // This is important for consistent URLs, especially when a roomCode is generated
    if (!roomCode) {
      router.replace(`/tracker/${roomCodeString}`);
    }

    // Set the join link for sharing - using query parameters
    setJoinLink(`${process.env.EXPO_PUBLIC_APP_URL || 'https://diestats.app'}/tracker/join?roomCode=${roomCodeString}`);
  }, [roomCode, roomCodeString, router]);

  // Effect to manage Supabase authentication session directly within this component
  useEffect(() => {
    // Function to check the initial session
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setCurrentUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoadingAuth(false); // Authentication check is complete
      }
    };

    initAuth(); // Call the initialization function

    // Set up a real-time listener for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setCurrentUser(newSession?.user ?? null);
      setLoadingAuth(false); // Ensure loading is set to false after auth state is determined
    });

    // Cleanup function to unsubscribe from the auth listener when the component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

  // Effect to check user access and load existing match data
  useEffect(() => {
    // Only proceed if auth is not loading and we have a roomCode string
    if (loadingAuth || !roomCodeString) return;

    const loadExistingMatch = async () => {
      console.log(`Loading match for room ${roomCodeString}`);

      try {
        const { data, error } = await supabase
          .from('live_matches')
          .select('*')
          .eq('roomCode', roomCodeString)
          .in('status', ['active'])
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            console.log('Error loading match:', error.message);
          }
          setIsSetupVisible(true);
          return;
        }

        if (data) {
          console.log('Match loaded successfully');
          setLiveSessionId(data.id);
          setMatchSetup(data.matchSetup);
          setPlayerStats(data.livePlayerStats);
          setTeamPenalties(data.liveTeamPenalties as { 1: number; 2: number });
          // Ensure matchStartTime is properly set - if it's null or invalid, set to current time
          if (data.matchStartTime) {
            const startTime = new Date(data.matchStartTime);
            // If the start time is in the future (more than 1 minute), it's likely a timezone issue
            if (startTime.getTime() > Date.now() + 60000) {
              console.log('Match start time appears to be in the future, using current time instead');
              setMatchStartTime(new Date());
            } else {
              setMatchStartTime(startTime);
            }
          } else {
            setMatchStartTime(new Date());
          }
          setUserSlotMap(data.userSlotMap || {});
          setIsSetupVisible(false);
          
          if (currentUser && data.hostId === currentUser.id) {
            setIsHost(true);
          }
        }
      } catch (error) {
        console.error('Error loading match:', error);
      }
    };

    loadExistingMatch();
  }, [roomCodeString, currentUser, loadingAuth]); // Depend on roomCodeString, currentUser, and loadingAuth

  // Supabase Realtime listener for live match updates
  // Smart subscription management for game updates
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Enable subscription only when game is active and user is participating
  useEffect(() => {
    if (liveSessionId && !matchFinished) {
      console.log('Game tracker: Enabling smart subscription');
      setSubscriptionEnabled(true);
    } else {
      console.log('Game tracker: Disabling subscription - game finished or no session');
      setSubscriptionEnabled(false);
    }
  }, [liveSessionId, matchFinished]);

  // Live Match Data Synchronization with smart batching
  useEffect(() => {
    if (!liveSessionId || !subscriptionEnabled) {
      console.log('No live session ID or subscription disabled, skipping subscription setup.');
      return;
    }

    console.log(`Setting up smart live subscription for ${liveSessionId}`);

    // Batch updates to avoid excessive re-renders
    let updateBuffer: any = null;
    let timeoutId: number | null = null;

    const applyBufferedUpdate = () => {
      if (updateBuffer) {
        console.log('Game tracker: Applying batched update');
        const updatedMatch = updateBuffer;

        // Update local state with live data
        setPlayerStats(updatedMatch.livePlayerStats);
        setTeamPenalties(updatedMatch.liveTeamPenalties as { 1: number; 2: number });
        setMatchSetup(prev => ({
          ...prev,
          playerNames: updatedMatch.matchSetup.playerNames
        }));
        setUserSlotMap(updatedMatch.userSlotMap || {});

        if (updatedMatch.status === 'finished') {
          setMatchFinished(true);
          setWinnerTeam(updatedMatch.winnerTeam);
        }

        setLastUpdateTime(Date.now());
        updateBuffer = null;
      }
    };

    const subscription = supabase
      .channel(`live_match:${liveSessionId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_matches',
          filter: `id=eq.${liveSessionId}`
        },
        (payload) => {
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUpdateTime;

          // Buffer updates and apply them in batches (minimum 500ms between updates)
          updateBuffer = payload.new as LiveMatch;

          if (timeoutId) clearTimeout(timeoutId as any);

          if (timeSinceLastUpdate >= 500) {
            // Apply immediately if enough time has passed
            applyBufferedUpdate();
          } else {
            // Delay update to avoid spam
            timeoutId = setTimeout(applyBufferedUpdate, 500 - timeSinceLastUpdate);
          }
        }
      )
      .subscribe((status) => {
        console.log('Game tracker subscription status:', status);
      });

    return () => {
      console.log('Game tracker: Cleaning up smart subscription');
      if (timeoutId) clearTimeout(timeoutId as any);
      subscription.unsubscribe();
    };
  }, [liveSessionId, subscriptionEnabled, lastUpdateTime]); // Depend on smart subscription state

  // Helper to sanitize text inputs to prevent script injection or unwanted characters
  const sanitizeInput = (input: string): string => {
    return input.replace(/[^a-zA-Z0-9 \-_.,!]/g, '');
  };

  // Handles starting a new match (Quick Start)
  const handleStartMatch = async (forceStart: boolean = false) => {
    console.log('handleStartMatch (Quick Start) called with forceStart:', forceStart);

    // Allow unauthenticated users to start matches directly
    // No need for confirmation dialog

    if (isLoading) {
      console.log('Already starting match, ignoring duplicate call');
      return;
    }

    setIsLoading(true);
    try {
      const initialStats: { [key: number]: PlayerStats } = {};
      for (let i = 1; i <= 4; i++) {
        initialStats[i] = {
          ...getInitialPlayerStats(),
          name: matchSetup.playerNames[i - 1], // Use names from current setup state
        };
      }

      const initialUserSlotMap: { [key: string]: string | null } = {};
      for (let i = 1; i <= 4; i++) {
        initialUserSlotMap[i.toString()] = null;
      }

      const newMatch = {
        roomCode: roomCodeString, // Use current roomCodeString (generated if fresh)
        hostId: currentUser?.id || null,
        status: 'active',
        matchSetup: matchSetup, // Use current matchSetup state
        participants: currentUser ? [currentUser.id] : [],
        userSlotMap: initialUserSlotMap,
        livePlayerStats: initialStats,
        liveTeamPenalties: { 1: 0, 2: 0 },
        matchStartTime: new Date().toISOString(),
        winnerTeam: null,
      };

      console.log('Creating match with data:', { roomCode: newMatch.roomCode });

      const { data, error } = await supabase
        .from('live_matches')
        .insert([newMatch])
        .select()
        .single();

      if (error) throw error;

      console.log('Match created successfully:', data);
      setLiveSessionId(data.id);
      setPlayerStats(initialStats);
      setMatchStartTime(new Date());
      setUserSlotMap(initialUserSlotMap);
      setIsHost(true);
      setIsSetupVisible(false); // Hide setup after starting the match
      setShowConfirm(false);
      setErrorMessage('');
    } catch (error: any) {
      console.error('Error starting match:', error.message);
      setErrorMessage(`Failed to start match: ${error.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handles a player joining an active match via join interface
  const handleJoinMatch = async (playerSlot: number) => {
    if (!currentUser || !liveSessionId) {
      Alert.alert('Login Required', 'Please login to join the match.');
      return;
    }

    setIsLoading(true);
    try {
      const { data: currentMatch, error: fetchError } = await supabase
        .from('live_matches')
        .select('*')
        .eq('id', liveSessionId)
        .single();

      if (fetchError) throw fetchError;

      // Check if the selected slot is already taken by another user
      if (currentMatch.userSlotMap[playerSlot.toString()] && currentMatch.userSlotMap[playerSlot.toString()] !== currentUser.id) {
        Alert.alert('Slot Taken', `Player slot ${playerSlot} is already taken by another user.`);
        setIsLoading(false);
        return;
      }

      // Check if the current user is already in a different slot
      const existingSlot = Object.keys(currentMatch.userSlotMap).find(
        key => currentMatch.userSlotMap[key] === currentUser.id
      );
      if (existingSlot && existingSlot !== playerSlot.toString()) {
        Alert.alert('Already Joined', `You are already assigned to Player slot ${existingSlot}. You can only join one slot per match.`);
        setIsLoading(false);
        return;
      }
      
      // If the user is already in THIS specific slot, just confirm
      if (currentMatch.userSlotMap[playerSlot.toString()] === currentUser.id) {
        Alert.alert('Already Assigned', `You are already assigned to Player slot ${playerSlot}.`);
        setShowJoinDialog(false);
        setIsLoading(false);
        return;
      }


      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('nickname')
        .eq('id', currentUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
          console.error("Error fetching user profile:", profileError.message);
      }

      const nickname = profileData?.nickname || currentUser.email?.split('@')[0] || `Player ${playerSlot}`;

      const updatedUserSlotMap = { ...currentMatch.userSlotMap, [playerSlot.toString()]: currentUser.id };
      const updatedParticipants = currentMatch.participants.includes(currentUser.id)
        ? currentMatch.participants
        : [...currentMatch.participants, currentUser.id];

      const updatedPlayerNames = [...currentMatch.matchSetup.playerNames];
      updatedPlayerNames[playerSlot - 1] = nickname;

      const updatedPlayerStats = { ...currentMatch.livePlayerStats };
      if (updatedPlayerStats[playerSlot]) {
        updatedPlayerStats[playerSlot].name = nickname;
      }

      const { error: updateError } = await supabase
        .from('live_matches')
        .update({
          userSlotMap: updatedUserSlotMap,
          participants: updatedParticipants,
          matchSetup: {
            ...currentMatch.matchSetup,
            playerNames: updatedPlayerNames
          },
          livePlayerStats: updatedPlayerStats
        })
        .eq('id', liveSessionId);

      if (updateError) throw updateError;

      console.log('Successfully joined match as player', playerSlot);
      setUserSlotMap(updatedUserSlotMap);
      setMatchSetup(prev => ({ ...prev, playerNames: updatedPlayerNames }));
      setShowJoinDialog(false);
      Alert.alert('Success', `You have successfully joined Player slot ${playerSlot}!`);
      setErrorMessage('');
    } catch (error: any) {
      console.error('Error joining match:', error.message);
      setErrorMessage(`Failed to join match: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update live match data in Supabase
  const updateLiveMatchData = useCallback(async (updatedPlayerStats?: any, updatedTeamPenalties?: any, updatedManualAdjustments?: any, updatedAdjustmentHistory?: any) => {
    if (!liveSessionId) {
      return;
    }

    try {
      // Validate penalties before syncing
      const statsToSync = updatedPlayerStats || playerStats;
      const penaltiesToSync = updatedTeamPenalties || teamPenalties;
      const validatedPenalties = {
        1: Math.max(0, penaltiesToSync[1] || 0),
        2: Math.max(0, penaltiesToSync[2] || 0),
      };

      const { error } = await supabase
        .from('live_matches')
        .update({
          livePlayerStats: statsToSync,
          liveTeamPenalties: validatedPenalties,
          manual_adjustments: updatedManualAdjustments || manualAdjustments,
          adjustment_history: updatedAdjustmentHistory || adjustmentHistory,
          userSlotMap: userSlotMap,
        })
        .eq('id', liveSessionId);

      if (error) {
        console.error('Error syncing match data:', error.message);
        setErrorMessage('Failed to sync play data');
      } else {
        console.log('Match data synced immediately');
      }
    } catch (error) {
      console.error('Error syncing play:', error);
    }
  }, [liveSessionId, playerStats, teamPenalties, manualAdjustments, adjustmentHistory, userSlotMap]);

  // Helper function to check if in Match Point, Advantage, or Overtime
  const getGameState = () => {
    const team1Score = calculateTeamScore(1);
    const team2Score = calculateTeamScore(2);
    const limit = matchSetup.gameScoreLimit;
    
    if (!matchSetup.winByTwo) {
      return 'standard';
    }
    
    // Overtime: both teams at or above limit
    if (team1Score >= limit && team2Score >= limit) {
      return 'overtime';
    }
    
    // Advantage: one team has 1-point lead when score >= limit
     if ((team1Score >= limit && team2Score === team1Score - 1) || (team2Score >= limit && team1Score === team2Score - 1)) {
      return 'advantage';
    }

    // Match Point: one team at limit-1, other not
    if ((team1Score === limit - 1 && team2Score < limit - 1) || 
        (team2Score === limit - 1 && team1Score < limit - 1)) {
      return 'matchPoint';
    }
    
    return 'standard';
  };

  // Helper to get the team number for a player
  const getPlayerTeam = (playerId: number): number => {
    return playerId <= 2 ? 1 : 2;
  };

  // NEW: Beer Die handleSubmitPlay - synced with nesTracker.tsx logic
  const handleSubmitPlay = async () => {
    // Validation - matches nesTracker validation
    if (!throwingPlayer || !throwResult) {
      setErrorMessage('Please select a throwing player and result');
      return;
    }

    if (!matchStartTime) {
      setErrorMessage('Match has not started yet');
      return;
    }

    // Additional Beer Die validation
    if (throwResult === 'lineTable' && (!defendingPlayer || defendingPlayer === 0)) {
      setErrorMessage('Line/Table throws require a defending player');
      return;
    }

    if (fifaKicker !== null || fifaAction) {
      if (throwResult !== 'invalid') {
        setErrorMessage('FIFA can only be activated on invalid throws');
        return;
      }
    }

    console.log('Submitting Beer Die play...');
    const updatedStats = { ...playerStats };
    const updatedPenalties = { ...teamPenalties };

    // NEW: Beer Die throw result arrays
    const validThrows = ['lineTable', 'hit', 'goal', 'dink', 'sink'];
    const scoringThrows = ['hit', 'goal', 'dink', 'sink'];
    
    const isScoringThrow = scoringThrows.includes(throwResult);
    const isValidThrow = validThrows.includes(throwResult);

    // Track throw
    updatedStats[throwingPlayer].throws++;
    (updatedStats[throwingPlayer] as any)[throwResult] = 
      ((updatedStats[throwingPlayer] as any)[throwResult] || 0) + 1;

    // NEW: Track valid throws
    if (isValidThrow) {
      updatedStats[throwingPlayer].validThrows++;
    }

    // NEW: Update hit streak and on fire status (Beer Die logic)
    const wasOnFire = updatedStats[throwingPlayer].currentlyOnFire;
    
    if (isScoringThrow) {
      updatedStats[throwingPlayer].hits++;
      updatedStats[throwingPlayer].hitStreak++;

      // Track special throws (dink, sink)
      if (['dink', 'sink'].includes(throwResult)) {
        updatedStats[throwingPlayer].specialThrows++;
      }

      // Track goals
      if (throwResult === 'goal') {
        updatedStats[throwingPlayer].goals++;
      }
    } else {
      updatedStats[throwingPlayer].hitStreak = 0;
    }

    // Track line/table throws
    if (throwResult === 'lineTable') {
      updatedStats[throwingPlayer].lineThrows++;
      updatedStats[throwingPlayer].tableThrows++;
    }

    // Update on fire status
    updatedStats[throwingPlayer].currentlyOnFire = updatedStats[throwingPlayer].hitStreak >= 3;
    
    // Track throws made while on fire
    if (wasOnFire) {
      updatedStats[throwingPlayer].onFireCount++;
    }

    // NEW: Beer Die scoring system
    const scoreMap: { [key: string]: number } = {
      'lineTable': 0,
      'hit': 1,
      'goal': 2,
      'dink': 2,
      'sink': matchSetup.sinkPoints,
      'invalid': 0,
    };
    
    let pointsToAdd = scoreMap[throwResult] || 0;
    let isCaught = false;

    // NEW: Beer Die defense processing
    if (defendingPlayer && defendingPlayer > 0 && defendingResult) {
      updatedStats[defendingPlayer].catchAttempts++;

      if (defendingResult === 'catch') {
        updatedStats[defendingPlayer].catches++;
        updatedStats[defendingPlayer].successfulCatches++;
        isCaught = true;
      } else if (defendingResult === 'miss') {
        updatedStats[defendingPlayer].blunders++;
        (updatedStats[defendingPlayer] as any)[defendingResult] = 
          ((updatedStats[defendingPlayer] as any)[defendingResult] || 0) + 1;
      }
    }

    // NEW: Apply points with catch nullification
    if (isCaught) {
      // Caught throws score 0 points
      pointsToAdd = 0;
    }

    // Apply points to thrower
    updatedStats[throwingPlayer].score += pointsToAdd;

    // NEW: Beer Die FIFA logic
    if (fifaKicker && fifaAction && throwResult === 'invalid') {
      updatedStats[fifaKicker].fifaAttempts++;

      if (fifaAction === 'goodKick') {
        updatedStats[fifaKicker].fifaSuccess++;
        updatedStats[fifaKicker].goodKick++;
        
        // FIFA Good Kick: Kicker gets stat credit, catching player gets 1 point (always)
        if (defendingPlayer && defendingPlayer > 0) {
          const catchingPlayerId = defendingPlayer as keyof typeof updatedStats;
          updatedStats[catchingPlayerId].score += 1; // Always award 1 point for successful FIFA
          console.log(`Rule Applied: FIFA Good Kick - 1 point to catching player ${catchingPlayerId}`);
        }
      } else {
        updatedStats[fifaKicker].badKick++;
        console.log('Rule Applied: FIFA Bad Kick - 0 points');
      }
    }

    // Save updated data
    setPlayerStats(updatedStats);
    setTeamPenalties(updatedPenalties);
    await updateLiveMatchData(updatedStats, updatedPenalties);

    // NEW: Beer Die form reset logic
    const allowRetoss = throwResult === 'lineTable';
    
    if (allowRetoss) {
      // Only reset defense fields for line/table throws
      setDefendingPlayer(null);
      setDefendingResult('');
    } else {
      // Full reset for all other throws
      setThrowingPlayer(null);
      setThrowResult('');
      setDefendingPlayer(null);
      setDefendingResult('');
    }
    
    // Always reset FIFA and show states
    setFifaKicker(null);
    setFifaAction('');
    setShowFifa(false);
    // NEW: setShowRedemption removed - redemption is now a throw result
    setErrorMessage('');
  };

  // NEW: Self Sink removed - not part of Beer Die ruleset

  // Calculates the score for a given team
  const calculateTeamScore = (teamNumber: number): number => {
    const playerIndices = teamNumber === 1 ? [1, 2] : [3, 4];
    const teamScore = playerIndices.reduce((sum, playerId) => {
      return sum + (playerStats[playerId]?.score || 0);
    }, 0);
    return teamScore - (teamPenalties[teamNumber as 1 | 2] || 0) + (manualAdjustments[teamNumber as 1 | 2] || 0);
  };

  // Manual score adjustment functions
  const adjustTeamScore = (teamNumber: 1 | 2, amount: number) => {
    if (!isHost) return; // Only host can adjust scores
    
    const newAdjustments = {
      ...manualAdjustments,
      [teamNumber]: (manualAdjustments[teamNumber] || 0) + amount
    };
    
    const newHistory = [...adjustmentHistory, {
      team: teamNumber,
      amount: amount,
      timestamp: new Date()
    }];
    
    setManualAdjustments(newAdjustments);
    setAdjustmentHistory(newHistory);
    
    // Sync to database
    updateLiveMatchData(playerStats, teamPenalties, newAdjustments, newHistory);
  };

  const resetManualAdjustments = () => {
    if (!isHost) return; // Only host can reset adjustments
    
    const newAdjustments = { 1: 0, 2: 0 };
    const newHistory: { team: number; amount: number; timestamp: Date }[] = [];
    
    setManualAdjustments(newAdjustments);
    setAdjustmentHistory(newHistory);
    
    // Sync to database
    updateLiveMatchData(playerStats, teamPenalties, newAdjustments, newHistory);
  };

  // Calculates a player's rating: 45% throw + 45% catch + 15% FIFA (max 105%)
  const calculatePlayerRating = (playerId: number): number => {
    const player = playerStats[playerId];
    if (!player) return 0;

    const hitRate = player.throws > 0 ? player.hits / player.throws : 0;
    
    // Corrected Catch Rate calculation based on the rulebook
    // Denominator is total catches plus total blunders (defensive errors + 'height' throws)
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
    
    // Iron Dome: Catch rate >= 80% (using the corrected catch rate logic)
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

    return Math.min(105, baseScore + awards);
  };

  // Validates and sanitizes player stats to ensure no invalid values
  const validatePlayerStats = (stats: { [key: number]: PlayerStats }): { [key: number]: PlayerStats } => {
    const validatedStats: { [key: number]: PlayerStats } = {};
    
    Object.entries(stats).forEach(([key, player]) => {
      const playerId = parseInt(key);
      validatedStats[playerId] = {
        ...player,
        throws: Math.max(0, player.throws || 0),
        hits: Math.max(0, player.hits || 0),
        blunders: Math.max(0, player.blunders || 0),
        catches: Math.max(0, player.catches || 0),
        score: Math.max(0, player.score || 0),
        aura: Math.max(0, player.aura || 0),
        fifaAttempts: Math.max(0, player.fifaAttempts || 0),
        fifaSuccess: Math.max(0, player.fifaSuccess || 0),
        hitStreak: Math.max(0, player.hitStreak || 0),
        specialThrows: Math.max(0, player.specialThrows || 0),
        lineThrows: Math.max(0, player.lineThrows || 0),
        tableThrows: Math.max(0, player.tableThrows || 0),
        goals: Math.max(0, player.goals || 0),
        onFireCount: Math.max(0, player.onFireCount || 0),
        line: Math.max(0, player.line || 0),
        hit: Math.max(0, player.hit || 0),
        goal: Math.max(0, player.goal || 0),
        dink: Math.max(0, player.dink || 0),
        sink: Math.max(0, player.sink || 0),
        invalid: Math.max(0, player.invalid || 0),
        miss: Math.max(0, player.miss || 0),
        goodKick: Math.max(0, player.goodKick || 0),
        badKick: Math.max(0, player.badKick || 0),
        validThrows: Math.max(0, player.validThrows || 0),
        catchAttempts: Math.max(0, player.catchAttempts || 0),
        successfulCatches: Math.max(0, player.successfulCatches || 0),
        redemptionShots: Math.max(0, player.redemptionShots || 0),
      };
    });
    
    return validatedStats;
  };

  // Validates and sanitizes match setup to ensure valid game settings
  const validateMatchSetup = (setup: MatchSetup): MatchSetup => {
    return {
      ...setup,
      gameScoreLimit: Math.max(1, Math.min(99, setup.gameScoreLimit || 11)), // Min 1, Max 99
      sinkPoints: Math.max(1, Math.min(10, setup.sinkPoints || 3)), // Min 1, Max 10
    };
  };

  // Handles finishing the match, determining the winner and updating live session status
  const handleFinishMatch = () => {
    setShowFinishConfirmation(true);
  };

  const confirmFinishMatch = async () => {
    setShowFinishConfirmation(false);
    console.log('Attempting to finish match...');
    const team1Score = calculateTeamScore(1);
    const team2Score = calculateTeamScore(2);

    let winner = 0;
    if (team1Score > team2Score) {
      winner = 1;
    } else if (team2Score > team1Score) {
      winner = 2;
    }

    setWinnerTeam(winner);
    setMatchFinished(true);

    if (liveSessionId) {
      try {
        const { error } = await supabase
          .from('live_matches')
          .update({
            status: 'finished',
            winnerTeam: winner,
          })
          .eq('id', liveSessionId);

        if (error) {
          console.error('Error finishing live match record:', error);
        }
      } catch (error) {
        console.error('Error updating match status:', error);
      }
    }

    // Automatically save the match after finishing
    // Pass winner directly to avoid reading stale React state
    await handleSaveStats(winner);
  };

  const cancelFinishMatch = () => {
    setShowFinishConfirmation(false);
  };

  // Handles saving match statistics to the 'saved_matches' table
  const handleSaveStats = async (explicitWinner?: number) => {
    console.log('Attempting to save match stats...');
    let savingUserId: string | null | undefined = currentUser?.id;
  
    // If the current user is a guest, check if an authenticated user has joined
    if (!savingUserId) {
      const firstAuthenticatedUserId = Object.values(userSlotMap).find(id => id !== null);
  
      if (firstAuthenticatedUserId) {
        savingUserId = firstAuthenticatedUserId;
        Alert.alert(
          'Guest Save',
          'You are saving this match as a guest. The stats will be saved to the profile of the first authenticated user who joined.'
        );
      }
    }
  
    // If no user is available to save the match to, show an alert and exit
    if (!savingUserId) {
      Alert.alert(
        'Sign In Required',
        'An authenticated user must join the match to save statistics. Please have a player join or sign in to save.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ]
      );
      return;
    }
  
    setIsLoading(true);
    try {
      // Validate and sanitize all match data
      const validatedStats = validatePlayerStats(playerStats);
      const validatedSetup = validateMatchSetup(matchSetup);
      
      // Validate team penalties (no negative values)
      const validatedPenalties = {
        1: Math.max(0, teamPenalties[1] || 0),
        2: Math.max(0, teamPenalties[2] || 0),
      };

      // Validate match duration (no negative values)
      const matchDuration = matchStartTime
        ? Math.max(0, Math.floor((Date.now() - matchStartTime.getTime()) / 1000))
        : 0;

      // Validate winner team — use explicitWinner if provided (avoids stale React state)
      const resolvedWinner = explicitWinner !== undefined ? explicitWinner : winnerTeam;
      const validatedWinner = (resolvedWinner === 1 || resolvedWinner === 2 || resolvedWinner === 0) ? resolvedWinner : 0;

      const matchData = {
        userId: savingUserId, // Use the determined saving user's ID
        roomCode: roomCodeString,
        matchSetup: validatedSetup,
        playerStats: validatedStats,
        teamPenalties: validatedPenalties,
        manual_adjustments: manualAdjustments,
        adjustment_history: adjustmentHistory,
        matchStartTime: matchStartTime?.toISOString(),
        winnerTeam: validatedWinner,
        matchDuration: matchDuration,
        userSlotMap: userSlotMap,
      };
  
      const { error } = await supabase
        .from('saved_matches')
        .insert([matchData]);
  
      if (error) throw error;
  
      // Update user stats in user_profiles table for all players
      try {
        const { updateUserStatsAfterMatch } = await import('../../utils/profileSync');
        
        // Update stats for all players who participated
        const playerIds = Object.values(userSlotMap).filter(id => id !== null);
        const updatePromises = playerIds.map(async (playerId) => {
          if (playerId) {
            try {
              await updateUserStatsAfterMatch(playerId);
              console.log(`Updated stats for player ${playerId}`);
            } catch (updateError) {
              console.warn(`Failed to update stats for player ${playerId}:`, updateError);
            }
          }
        });
        
        // Wait for all stats updates to complete
        await Promise.allSettled(updatePromises);
        console.log('Completed stats updates for all players');
      } catch (statsError) {
        console.warn('Failed to update user stats after match:', statsError);
        // Don't fail the match save if stats update fails
      }
  
      // Clean up live session if it exists
      if (liveSessionId) {
        await supabase
          .from('live_matches')
          .delete()
          .eq('id', liveSessionId);
      }
  
      setLiveSessionId(null);

      // Show success message and navigate to home
      Alert.alert(
        'Success', 
        'Match statistics saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/' as any),
          }
        ]
      );
      
      // Auto-navigate after a brief delay if user doesn't dismiss the alert
      setTimeout(() => {
        router.push('/(tabs)/' as any);
      }, 1500);
    } catch (error: any) {
      console.error('Error saving match:', error.message);
      Alert.alert('Error', `Failed to save match statistics: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };



  // Handles going to home screen with confirmation
  const handleGoHome = () => {
    setShowHomeConfirmation(true);
  };

  const confirmGoHome = () => {
    setShowHomeConfirmation(false);
    router.push('/');
  };

  const cancelGoHome = () => {
    setShowHomeConfirmation(false);
  };

  // Handles copying the join link
  const handleCopyJoinLink = async () => {
    try {
      await Clipboard.setStringAsync(joinLink);
      Alert.alert('Link Copied', 'Join link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Copy Failed', 'Failed to copy join link.');
    }
  };

  const team1Score = calculateTeamScore(1);
  const team2Score = calculateTeamScore(2);
  const isOvertime =
    matchSetup.winByTwo &&
    team1Score >= matchSetup.gameScoreLimit &&
    team2Score >= matchSetup.gameScoreLimit &&
    Math.abs(team1Score - team2Score) < 2;

  const getQRValue = () => {
    return joinLink;
  };



  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
              {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{matchSetup.title}</Text>
              <Text style={styles.headerSubtitle}>{matchSetup.arena}</Text>
              <Text style={styles.roomCodeText}>Room: {roomCodeString}</Text>

              {matchStartTime && (
                <Text style={styles.elapsedTimeText}>
                  Elapsed:{' '}
                  {(() => {
                    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - matchStartTime.getTime()) / 1000));
                    const minutes = Math.floor(elapsedSeconds / 60);
                    const seconds = elapsedSeconds % 60;
                    return `${minutes}:${String(seconds).padStart(2, '0')}`;
                  })()}
                </Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.settingsIcon}
              onPress={() => setShowSettingsPanel(true)}
            >
              <View style={styles.settingsIconContainer}>
                <View style={styles.settingsIconCircle} />
                <View style={styles.settingsIconCircle} />
                <View style={styles.settingsIconCircle} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

      {/* Back Button at top of screen */}
      {isSetupVisible && (
        <HapticBackButton 
          onPress={() => router.back()} 
          style={styles.backButton}
        />
      )}

      {/* Match Setup Section (shown based on isSetupVisible state) */}
      {isSetupVisible && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match Setup</Text>

          {/* Basic Match Info Section */}
          <View style={[styles.setupSection, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.colors.textPrimary }]}>Basic Information</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
              placeholder="Match Title"
              placeholderTextColor={theme.colors.inputPlaceholder}
              value={matchSetup.title}
              onChangeText={(text) =>
                setMatchSetup((prev) => ({ ...prev, title: sanitizeInput(text) }))
              }
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
              placeholder="Arena"
              placeholderTextColor={theme.colors.inputPlaceholder}
              value={matchSetup.arena}
              onChangeText={(text) =>
                setMatchSetup((prev) => ({ ...prev, arena: sanitizeInput(text) }))
              }
            />
          </View>

          {/* Teams & Players Section */}
          <View style={styles.setupSection}>
            <Text style={styles.sectionHeader}>Teams & Players</Text>
            <View style={styles.twoColumnRow}>
              <View style={styles.halfCard}>
                <TextInput
                  style={styles.teamNameInput}
                  placeholder="Team 1 Name"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={matchSetup.teamNames[0]}
                  onChangeText={(text) => {
                    const newNames = [...matchSetup.teamNames];
                    newNames[0] = sanitizeInput(text);
                    setMatchSetup((prev) => ({ ...prev, teamNames: newNames }));
                  }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Player 1"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={matchSetup.playerNames[0]}
                  onChangeText={(text) => {
                    const newNames = [...matchSetup.playerNames];
                    newNames[0] = sanitizeInput(text);
                    setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
                  }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Player 2"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={matchSetup.playerNames[1]}
                  onChangeText={(text) => {
                    const newNames = [...matchSetup.playerNames];
                    newNames[1] = sanitizeInput(text);
                    setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
                  }}
                />
              </View>
              <View style={styles.halfCard}>
                <TextInput
                  style={styles.teamNameInput}
                  placeholder="Team 2 Name"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={matchSetup.teamNames[1]}
                  onChangeText={(text) => {
                    const newNames = [...matchSetup.teamNames];
                    newNames[1] = sanitizeInput(text);
                    setMatchSetup((prev) => ({ ...prev, teamNames: newNames }));
                  }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Player 3"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={matchSetup.playerNames[2]}
                  onChangeText={(text) => {
                    const newNames = [...matchSetup.playerNames];
                    newNames[2] = sanitizeInput(text);
                    setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
                  }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Player 4"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={matchSetup.playerNames[3]}
                  onChangeText={(text) => {
                    const newNames = [...matchSetup.playerNames];
                    newNames[3] = sanitizeInput(text);
                    setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
                  }}
                />
              </View>
            </View>
          </View>

          {/* Game Rules Section */}
          <View style={[styles.setupSection, { borderBottomWidth: 0 }]}>
            <Text style={styles.sectionHeader}>Game Rules</Text>
            
            {/* Score Limit Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Score to Win:</Text>
              <View style={styles.buttonRow}>
                {[7, 11, 15, 21].map((score) => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.dropdownButton,
                      matchSetup.gameScoreLimit === score && styles.dropdownButtonSelected,
                    ]}
                    onPress={() => setMatchSetup(prev => ({ ...prev, gameScoreLimit: score }))}
                  >
                    <Text style={[
                      styles.dropdownButtonText,
                      matchSetup.gameScoreLimit === score && styles.dropdownButtonTextSelected,
                    ]}>
                      {score}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sink Points Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sink Points:</Text>
              <View style={styles.buttonRow}>
                {[3, 5].map((points) => (
                  <TouchableOpacity
                    key={points}
                    style={[
                      styles.dropdownButton,
                      matchSetup.sinkPoints === points && styles.dropdownButtonSelected,
                    ]}
                    onPress={() => setMatchSetup(prev => ({ ...prev, sinkPoints: points }))}
                  >
                    <Text style={[
                      styles.dropdownButtonText,
                      matchSetup.sinkPoints === points && styles.dropdownButtonTextSelected,
                    ]}>
                      {points}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Win By Two Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Win By Two:</Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  matchSetup.winByTwo ? styles.toggleButtonActive : styles.toggleButtonInactive,
                ]}
                onPress={() => setMatchSetup((prev) => ({ ...prev, winByTwo: !prev.winByTwo }))}
              >
                <Text style={styles.toggleButtonText}>
                  {matchSetup.winByTwo ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Start Match Button */}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.disabledButton]}
            onPress={() => handleStartMatch()}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{isLoading ? 'Starting...' : 'Quick Start Match'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conditional rendering for main game sections */}
      {liveSessionId && (
        <>


          {/* Player Join Section */}
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.collapsibleHeader}
              onPress={() => setShowQRCode(!showQRCode)}
            >
              <Text style={styles.sectionHeader}>Player Join</Text>
              <Text style={styles.collapseIcon}>{showQRCode ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            
            {showQRCode && (
              <>
                <Text style={styles.joinInstructionText}>Players can join using:</Text>
                <View style={styles.qrCodeContainer}>
                  <QRCodeSVG value={getQRValue()} size={150} />
                </View>
                <Text style={styles.roomCodeText}>Room Code: {roomCodeString}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyJoinLink}>
                  <Text style={styles.secondaryButtonText}>Copy Join Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowJoinDialog(true)}>
                  <Text style={styles.secondaryButtonText}>Join as Player</Text>
                </TouchableOpacity>
                <Text style={styles.linkText}>{joinLink}</Text>
              </>
            )}
          </View>


          {/* Scoreboard Section */}
          <View style={styles.card}>
            <View style={styles.scoreboardContainer}>
              {/* Team 1 Scoreboard */}
              <View style={styles.teamScoreboard}>
                <Text
                  style={[
                    styles.teamName,
                    winnerTeam === 1 && styles.winnerTeamText,
                  ]}
                >
                  {matchSetup.teamNames[0]}
                </Text>
                <Text style={styles.teamScore}>{calculateTeamScore(1)}</Text>
                <Text style={styles.playerInfo}>
                  {matchSetup.playerNames[0]}: {playerStats[1]?.hits || 0}/{playerStats[1]?.throws || 0}
                  {playerStats[1]?.currentlyOnFire ? ' 🔥' : ''}
                </Text>
                <Text style={styles.playerInfo}>
                  {matchSetup.playerNames[1]}: {playerStats[2]?.hits || 0}/{playerStats[2]?.throws || 0}
                  {playerStats[2]?.currentlyOnFire ? ' 🔥' : ''}
                </Text>
              </View>

              {/* Scoreboard Center (score limit, overtime status) */}
              <View style={styles.scoreboardCenter}>
                <Text style={styles.scoreLimitText}>First to {matchSetup.gameScoreLimit}</Text>
                {isOvertime && <Text style={styles.overtimeText}>OVERTIME!</Text>}
                {!isOvertime && team1Score === team2Score && team1Score >= matchSetup.gameScoreLimit - 1 && (
                  <Text style={styles.tiedText}>Tied</Text>
                )}
              </View>

              {/* Team 2 Scoreboard */}
              <View style={styles.teamScoreboard}>
                <Text
                  style={[
                    styles.teamName,
                    winnerTeam === 2 && styles.winnerTeamText,
                  ]}
                >
                  {matchSetup.teamNames[1]}
                </Text>
                <Text style={styles.teamScore}>{calculateTeamScore(2)}</Text>
                <Text style={styles.playerInfo}>
                  {matchSetup.playerNames[2]}: {playerStats[3]?.hits || 0}/{playerStats[3]?.throws || 0}
                  {playerStats[3]?.currentlyOnFire ? ' 🔥' : ''}
                </Text>
                <Text style={styles.playerInfo}>
                  {matchSetup.playerNames[3]}: {playerStats[4]?.hits || 0}/{playerStats[4]?.throws || 0}
                  {playerStats[4]?.currentlyOnFire ? ' 🔥' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Play Input Section */}
          {!matchFinished && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current Play</Text>

              {/* Throwing Player Selection */}
              <Text style={styles.sectionHeader}>Throwing Player:</Text>
              <View style={styles.playerRow}>
                {[1, 2, 3, 4].map((playerId) => (
                  <TouchableOpacity
                    key={playerId}
                    style={[
                      styles.playerButton,
                      throwingPlayer === playerId && styles.playerButtonSelected,
                    ]}
                    onPress={() => setThrowingPlayer(playerId)}
                  >
                    <Text
                      style={[
                        styles.playerButtonText,
                        throwingPlayer === playerId && styles.selectedButtonText,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {matchSetup.playerNames[playerId - 1]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Throw Result Selection (Combined) */}
              <Text style={styles.sectionHeader}>Throw Result:</Text>
              
              {/* Row 1: Hit, Bad Throw */}
              <View style={styles.throwResultRow}>
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.goodResultOutline,
                    throwResult === 'hit' && styles.goodResultSelected,
                  ]}
                  onPress={() => setThrowResult('hit')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    throwResult === 'hit' && styles.selectedThrowText
                  ]}>
                    Hit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.badResultOutline,
                    throwResult === 'invalid' && styles.badResultSelected,
                  ]}
                  onPress={() => setThrowResult('invalid')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    throwResult === 'invalid' && styles.selectedThrowText
                  ]}>
                    Bad Throw
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: Line/Table, Dink */}
              <View style={styles.throwResultRow}>
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.goodResultOutline,
                    throwResult === 'lineTable' && styles.goodResultSelected,
                  ]}
                  onPress={() => setThrowResult('lineTable')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    throwResult === 'lineTable' && styles.selectedThrowText
                  ]}>
                    Line/Table
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.goodResultOutline,
                    throwResult === 'dink' && styles.goodResultSelected,
                  ]}
                  onPress={() => setThrowResult('dink')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    throwResult === 'dink' && styles.selectedThrowText
                  ]}>
                    Dink
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Row 3: Goal, Sink */}
              <View style={styles.throwResultRow}>
                {['goal', 'sink'].map((result) => (
                  <TouchableOpacity
                    key={result}
                    style={[
                      styles.throwResultButton,
                      styles.goodResultOutline,
                      throwResult === result && styles.goodResultSelected,
                    ]}
                    onPress={() => setThrowResult(result)}
                  >
                    <Text style={[
                      styles.throwResultButtonText,
                      throwResult === result && styles.selectedThrowText
                    ]}>
                      {result.charAt(0).toUpperCase() + result.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Defending Player Selection */}
              <Text style={styles.sectionHeader}>Defending Player:</Text>
              
              {/* Player Row */}
              <View style={styles.playerRow}>
                {[1, 2, 3, 4].map((playerId) => (
                  <TouchableOpacity
                    key={playerId}
                    style={[
                      styles.playerButton,
                      defendingPlayer === playerId && styles.playerButtonSelected,
                    ]}
                    onPress={() => setDefendingPlayer(playerId)}
                  >
                    <Text
                      style={[
                        styles.playerButtonText,
                        defendingPlayer === playerId && styles.selectedButtonText,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {matchSetup.playerNames[playerId - 1]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Team/N/A Row */}
              <View style={styles.teamNARow}>
                <TouchableOpacity
                  style={[
                    styles.playerButton,
                    defendingPlayer === -1 && styles.playerButtonSelected,
                  ]}
                  onPress={() => setDefendingPlayer(-1)}
                >
                  <Text
                    style={[
                      styles.playerButtonText,
                      defendingPlayer === -1 && styles.selectedButtonText,
                    ]}
                  >
                    TEAM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.playerButton,
                    defendingPlayer === 0 && styles.playerButtonSelected,
                  ]}
                  onPress={() => setDefendingPlayer(0)}
                >
                  <Text
                    style={[
                      styles.playerButtonText,
                      defendingPlayer === 0 && styles.selectedButtonText,
                    ]}
                  >
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Defense Result Selection (Combined) */}
              <Text style={styles.sectionHeader}>Defense Result:</Text>
              <View style={styles.buttonRow}>
                {/* NEW: Beer Die Defense Results - Catch (good) */}
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.goodResultOutline,
                    defendingResult === 'catch' && styles.goodResultSelected,
                  ]}
                  onPress={() => setDefendingResult('catch')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    defendingResult === 'catch' && styles.selectedThrowText
                  ]}>
                    Catch
                  </Text>
                </TouchableOpacity>
                {/* NEW: Beer Die Defense Results - Miss (bad) */}
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.badResultOutline,
                    defendingResult === 'miss' && styles.badResultSelected,
                  ]}
                  onPress={() => setDefendingResult('miss')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    defendingResult === 'miss' && styles.selectedThrowText
                  ]}>
                    Miss
                  </Text>
                </TouchableOpacity>
                {/* NEW: Beer Die Defense Results - N/A (neutral) */}
                <TouchableOpacity
                  style={[
                    styles.throwResultButton,
                    styles.neutralResultOutline,
                    defendingResult === 'none' && styles.neutralResultSelected,
                  ]}
                  onPress={() => setDefendingResult('none')}
                >
                  <Text style={[
                    styles.throwResultButtonText,
                    defendingResult === 'none' && styles.selectedThrowText
                  ]}>
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Special Actions Buttons */}
              <View style={styles.actionButtonRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowFifa(!showFifa)}
                >
                  <Text style={styles.actionButtonText}>
                    {showFifa ? 'Hide FIFA' : 'Show FIFA'}
                  </Text>
                </TouchableOpacity>
                {isHost && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowManualAdjust(!showManualAdjust)}
                  >
                    <Text style={styles.actionButtonText}>
                      {showManualAdjust ? 'Hide Manual' : 'Manual Score Adjust'}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* NEW: Show Redemption button removed - redemption is now a throw result */}
                {/* NEW: Self Sink button removed - not part of Beer Die ruleset */}
              </View>

              {/* FIFA Section (conditionally rendered) */}
              {showFifa && (
                <View style={styles.nestedCard}>
                  <Text style={styles.sectionHeader}>FIFA Kicker:</Text>
                  <View style={styles.buttonRow}>
                    {[1, 2, 3, 4].map((playerId) => (
                      <TouchableOpacity
                        key={playerId}
                        style={[
                          styles.playerButton,
                          fifaKicker === playerId && styles.playerButtonSelected,
                        ]}
                        onPress={() => setFifaKicker(playerId)}
                      >
                        <Text
                          style={[
                            styles.playerButtonText,
                            fifaKicker === playerId && styles.selectedButtonText,
                          ]}
                        >
                          {matchSetup.playerNames[playerId - 1]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sectionHeader}>FIFA Action:</Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.playerButton,
                        fifaAction === 'goodKick' && styles.goodResultSelected,
                      ]}
                      onPress={() => setFifaAction('goodKick')}
                    >
                      <Text style={styles.throwResultButtonText}>Good Kick</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.playerButton,
                        fifaAction === 'badKick' && styles.badResultSelected,
                      ]}
                      onPress={() => setFifaAction('badKick')}
                    >
                      <Text style={styles.throwResultButtonText}>Bad Kick</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Manual Score Adjustment Section (conditionally rendered) */}
              {showManualAdjust && isHost && (
                <View style={styles.manualAdjustCard}>
                  <Text style={styles.manualAdjustTitle}>Manual Score Adjustment</Text>
                  <Text style={styles.manualAdjustSubtitle}>
                    Quickly adjust scores for tracking errors or house rules
                  </Text>
                  
                  {/* Compact Team Adjustments */}
                  <View style={styles.compactAdjustmentContainer}>
                    {/* Team 1 */}
                    <View style={styles.compactAdjustmentRow}>
                      <View style={styles.teamNameContainer}>
                        <Text style={styles.compactTeamName}>{matchSetup.teamNames[0]}</Text>
                        {manualAdjustments[1] !== 0 && (
                          <Text style={[
                            styles.adjustmentBadge,
                            { color: manualAdjustments[1] > 0 ? theme.colors.success : theme.colors.error }
                          ]}>
                            {manualAdjustments[1] > 0 ? '+' : ''}{manualAdjustments[1]}
                          </Text>
                        )}
                      </View>
                      <View style={styles.compactControls}>
                        <TouchableOpacity
                          style={styles.compactButton}
                          onPress={() => adjustTeamScore(1, -1)}
                        >
                          <Text style={styles.compactButtonText}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.compactButton}
                          onPress={() => adjustTeamScore(1, 1)}
                        >
                          <Text style={styles.compactButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Team 2 */}
                    <View style={styles.compactAdjustmentRow}>
                      <View style={styles.teamNameContainer}>
                        <Text style={styles.compactTeamName}>{matchSetup.teamNames[1]}</Text>
                        {manualAdjustments[2] !== 0 && (
                          <Text style={[
                            styles.adjustmentBadge,
                            { color: manualAdjustments[2] > 0 ? theme.colors.success : theme.colors.error }
                          ]}>
                            {manualAdjustments[2] > 0 ? '+' : ''}{manualAdjustments[2]}
                          </Text>
                        )}
                      </View>
                      <View style={styles.compactControls}>
                        <TouchableOpacity
                          style={styles.compactButton}
                          onPress={() => adjustTeamScore(2, -1)}
                        >
                          <Text style={styles.compactButtonText}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.compactButton}
                          onPress={() => adjustTeamScore(2, 1)}
                        >
                          <Text style={styles.compactButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Reset Button */}
                  {(manualAdjustments[1] !== 0 || manualAdjustments[2] !== 0) && (
                    <TouchableOpacity
                      style={styles.compactResetButton}
                      onPress={() => {
                        Alert.alert(
                          'Reset Adjustments',
                          'Reset all manual score adjustments?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Reset', style: 'destructive', onPress: resetManualAdjustments }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.compactResetButtonText}>Reset Adjustments</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* NEW: Redemption Section removed - redemption is now a throw result (Successful Redemption) */}

              {/* Action Buttons Row */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity 
                  style={styles.clearSelectionButton} 
                  onPress={() => {
                    setThrowingPlayer(null);
                    setThrowResult('');
                    setDefendingPlayer(null);
                    setDefendingResult('');
                    setFifaKicker(null);
                    setFifaAction('');
                    // NEW: redemptionAction and showRedemption removed - redemption is now a throw result
                    setShowFifa(false);
                    setErrorMessage('');
                  }}
                >
                  <Text style={styles.clearSelectionButtonText}>Clear Selection</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmitPlay}>
                  <Text style={styles.buttonText}>Submit Play</Text>
                </TouchableOpacity>
              </View>

              {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
            </View>
          )}

          {/* Match Controls Section (Show/Hide Stats, Finish, New Game, Show/Hide Setup) */}
          <View style={styles.card}>
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={styles.greenButton}
                onPress={() => setShowStats(!showStats)}
              >
                <Text style={styles.greenButtonText}>
                  {showStats ? 'Hide Stats' : 'Show Stats'}
                </Text>
              </TouchableOpacity>
              {!matchFinished && !isLoading && (
                <TouchableOpacity style={styles.redButton} onPress={handleFinishMatch}>
                  <Text style={styles.redButtonText}>Finish Match</Text>
                </TouchableOpacity>
              )}
              {isLoading && (
                <View style={[styles.primaryButton, styles.disabledButton]}>
                  <Text style={styles.buttonText}>Saving...</Text>
                </View>
              )}

              
              {/* Home Button */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleGoHome}
              >
                <Ionicons name="home-outline" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              
              {/* Match Settings Button */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowSettingsPanel(true)}
              >
                <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Player Statistics Section */}
          {showStats && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Player Statistics</Text>
              
              {/* Debug Info - Team Scores and Penalties */}
              <View style={styles.debugContainer}>
                <View style={styles.debugTeam}>
                  <Text style={styles.debugTitle}>Team 1</Text>
                  <Text style={styles.debugText}>Player 1 Score: {playerStats[1]?.score || 0}</Text>
                  <Text style={styles.debugText}>Player 2 Score: {playerStats[2]?.score || 0}</Text>
                  <Text style={styles.debugText}>Team Penalty: {teamPenalties[1] || 0}</Text>
                  <Text style={styles.debugText}>Total Score: {calculateTeamScore(1)}</Text>
                </View>
                <View style={styles.debugTeam}>
                  <Text style={styles.debugTitle}>Team 2</Text>
                  <Text style={styles.debugText}>Player 3 Score: {playerStats[3]?.score || 0}</Text>
                  <Text style={styles.debugText}>Player 4 Score: {playerStats[4]?.score || 0}</Text>
                  <Text style={styles.debugText}>Team Penalty: {teamPenalties[2] || 0}</Text>
                  <Text style={styles.debugText}>Total Score: {calculateTeamScore(2)}</Text>
                </View>
              </View>
              
              <View style={styles.statsContainer}>
                {/* Team 1 Column (Players 1 & 2) */}
                <View style={styles.teamStatsColumn}>
                  {[1, 2].map((playerId) => {
                    const player = playerStats[playerId];
                    if (!player) return null;

                    const hitPct = player.throws > 0 ? ((player.hits / player.throws) * 100).toFixed(1) : '0.0';
                    
                    // Corrected catch percentage calculation per rulebook
                    const totalDefensivePlays = player.catches + player.blunders;
                    const catchPct = totalDefensivePlays > 0 ? ((player.catches / totalDefensivePlays) * 100).toFixed(1) : '0.0';

                    const rating = calculatePlayerRating(playerId).toFixed(1);

                    return (
                      <View key={playerId} style={styles.playerStatsCard}>
                        <Text style={styles.playerStatsName}>
                          {matchSetup.playerNames[playerId - 1]} {player.currentlyOnFire ? '🔥' : ''}
                        </Text>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>Throws: {player.throws}</Text>
                          <Text style={styles.statText}>Hits: {player.hits}</Text>
                          <Text style={styles.statText}>Hit%: {hitPct}%</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>Catches: {player.catches}</Text>
                          <Text style={styles.statText}>Catch%: {catchPct}%</Text>
                          <Text style={styles.statText}>Rating: {rating}%</Text>
                        </View>
                         <View style={styles.statsRow}>
                          <Text style={styles.statText}>Blunders: {player.blunders}</Text>
                          <Text style={styles.statText}>Score: {player.score}</Text>
                          <Text style={styles.statText}>Aura: {player.aura}</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>Goals: {player.goals}</Text>
                          <Text style={styles.statText}>Streak: {player.hitStreak}</Text>
                          <Text style={styles.statText}>On Fire Throws: {player.onFireCount}</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>
                            FIFA: {player.fifaSuccess}/{player.fifaAttempts}
                          </Text>
                          <Text style={styles.statText}>Special: {player.specialThrows}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Team 2 Column (Players 3 & 4) */}
                <View style={styles.teamStatsColumn}>
                  {[3, 4].map((playerId) => {
                    const player = playerStats[playerId];
                    if (!player) return null;

                    const hitPct = player.throws > 0 ? ((player.hits / player.throws) * 100).toFixed(1) : '0.0';
                    
                    // Corrected catch percentage calculation per rulebook
                    const totalDefensivePlays = player.catches + player.blunders;
                    const catchPct = totalDefensivePlays > 0 ? ((player.catches / totalDefensivePlays) * 100).toFixed(1) : '0.0';

                    const rating = calculatePlayerRating(playerId).toFixed(1);

                    return (
                      <View key={playerId} style={styles.playerStatsCard}>
                        <Text style={styles.playerStatsName}>
                          {matchSetup.playerNames[playerId - 1]} {player.currentlyOnFire ? '🔥' : ''}
                        </Text>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>Throws: {player.throws}</Text>
                          <Text style={styles.statText}>Hits: {player.hits}</Text>
                          <Text style={styles.statText}>Hit%: {hitPct}%</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>Catches: {player.catches}</Text>
                          <Text style={styles.statText}>Catch%: {catchPct}%</Text>
                          <Text style={styles.statText}>Rating: {rating}%</Text>
                        </View>
                         <View style={styles.statsRow}>
                          <Text style={styles.statText}>Blunders: {player.blunders}</Text>
                          <Text style={styles.statText}>Score: {player.score}</Text>
                          <Text style={styles.statText}>Aura: {player.aura}</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>Goals: {player.goals}</Text>
                          <Text style={styles.statText}>Streak: {player.hitStreak}</Text>
                          <Text style={styles.statText}>On Fire Throws: {player.onFireCount}</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>
                            FIFA: {player.fifaSuccess}/{player.fifaAttempts}
                          </Text>
                          <Text style={styles.statText}>Special: {player.specialThrows}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Join Dialog (Overlay) */}
      {showJoinDialog && (
        <View style={styles.overlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.cardTitle}>Select Player Slot</Text>
            <Text style={styles.dialogMessage}>Choose which player slot you want to control:</Text>

            {[1, 2, 3, 4].map((playerId) => (
              <TouchableOpacity
                key={playerId}
                style={[
                  styles.dialogButton,
                  // Disable button if slot is already taken by another user and not by current user
                  (userSlotMap[playerId.toString()] !== null && userSlotMap[playerId.toString()] !== currentUser?.id) && styles.disabledButton,
                ]}
                onPress={() => handleJoinMatch(playerId)}
                disabled={isLoading || (userSlotMap[playerId.toString()] !== null && userSlotMap[playerId.toString()] !== currentUser?.id)}
              >
                <Text style={styles.buttonText}>
                  {matchSetup.playerNames[playerId - 1]} (Player {playerId})
                  {userSlotMap[playerId.toString()] && ` - Taken`}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.dialogCancelButton}
              onPress={() => setShowJoinDialog(false)}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmation Dialog (Overlay for starting match as guest) */}
      {showConfirm && (
        <View style={styles.overlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.cardTitle}>Start Match?</Text>
            <Text style={styles.dialogMessage}>Ready to begin the match with current settings?</Text>

            {/* Warning if user is not logged in */}
            {!currentUser && (
              <Text style={styles.warningMessage}>
                ⚠️ Warning: You are not logged in. Match stats will not be saved to your profile if you proceed as a guest.
              </Text>
            )}

            <View style={styles.actionButtonRow}>
              {/* Option to login before starting if not logged in */}
              {!currentUser && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    setShowConfirm(false); // Close dialog before navigating
                    router.push('/(auth)/login');
                  }}
                >
                  <Text style={styles.buttonText}>Login to Save</Text>
                </TouchableOpacity>
              )}
              {/* Option to start anyway (as guest if not logged in) */}
              <TouchableOpacity
                style={currentUser ? styles.greenButton : styles.orangeButton}
                onPress={() => {
                  setMatchStartTime(new Date());
                  setShowConfirm(false); // Close dialog
                  handleStartMatch(true); // Force start as confirmed
                }}
              >
                <Text style={styles.buttonText}>Start Anyway</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogCancelButton}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
              )}
      </ScrollView>

      {/* Settings Bottom Panel */}
      {showSettingsPanel && (
        <View style={[styles.bottomPanelOverlay, { backgroundColor: theme.colors.overlay }]}>
          <TouchableOpacity 
            style={styles.bottomPanelBackdrop}
            onPress={() => setShowSettingsPanel(false)}
          />
          <View style={[styles.bottomPanel, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.panelTitle, { color: theme.colors.textPrimary }]}>Match Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsPanel(false)}>
                <Text style={[styles.panelCloseButton, { color: theme.colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.panelContent}>
              {/* Match Title */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Match Title:</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                  value={matchSetup.title}
                  onChangeText={(text) =>
                    setMatchSetup((prev) => ({ ...prev, title: sanitizeInput(text) }))
                  }
                  placeholder="Match Title"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                />
              </View>

              {/* Arena */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Arena:</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                  value={matchSetup.arena}
                  onChangeText={(text) =>
                    setMatchSetup((prev) => ({ ...prev, arena: sanitizeInput(text) }))
                  }
                  placeholder="Arena"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                />
              </View>

              {/* Team Setup */}
              <Text style={[styles.sectionHeader, { color: theme.colors.textPrimary }]}>Team Setup</Text>
              
              {/* Team 1 Group */}
              <View style={[styles.teamGroup, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
                <View style={styles.teamHeader}>
                  <Text style={styles.teamLabel}>Team 1</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Team Name:</Text>
                  <TextInput
                    style={styles.input}
                    value={matchSetup.teamNames[0]}
                    onChangeText={(text) => {
                      const newNames = [...matchSetup.teamNames];
                      newNames[0] = sanitizeInput(text);
                      setMatchSetup((prev) => ({ ...prev, teamNames: newNames }));
                    }}
                    placeholder="Team 1"
                    placeholderTextColor={theme.colors.inputPlaceholder}
                  />
                </View>
                
                {/* Team 1 Players */}
                <View style={styles.playersContainer}>
                  {[0, 1].map((index) => {
                    const playerId = index + 1;
                    const isJoinedUser = Object.values(userSlotMap).includes(currentUser?.id || null) && 
                                         userSlotMap[playerId] === currentUser?.id;
                    const isOtherJoinedUser = userSlotMap[playerId] && userSlotMap[playerId] !== currentUser?.id;
                    const isDisabled = isJoinedUser || isOtherJoinedUser;
                    
                    return (
                      <View key={index} style={styles.playerInputGroup}>
                        <Text style={styles.label}>Player {index + 1}:</Text>
                        <TextInput
                          style={[
                            styles.input,
                            isDisabled && styles.disabledInput
                          ]}
                          value={matchSetup.playerNames[index]}
                          onChangeText={(text) => {
                            if (!isDisabled) {
                              const newNames = [...matchSetup.playerNames];
                              newNames[index] = sanitizeInput(text);
                              setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
                            }
                          }}
                          placeholder={`Player ${index + 1}`}
                          placeholderTextColor={theme.colors.inputPlaceholder}
                          editable={!isDisabled}
                        />
                        {isDisabled && (
                          <Text style={styles.disabledText}>
                            {isJoinedUser ? "Your name (joined via code)" : "Player joined via code"}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Team 2 Group */}
              <View style={styles.teamGroup}>
                <View style={styles.teamHeader}>
                  <Text style={styles.teamLabel}>Team 2</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Team Name:</Text>
                  <TextInput
                    style={styles.input}
                    value={matchSetup.teamNames[1]}
                    onChangeText={(text) => {
                      const newNames = [...matchSetup.teamNames];
                      newNames[1] = sanitizeInput(text);
                      setMatchSetup((prev) => ({ ...prev, teamNames: newNames }));
                    }}
                    placeholder="Team 2"
                    placeholderTextColor={theme.colors.inputPlaceholder}
                  />
                </View>
                
                {/* Team 2 Players */}
                <View style={styles.playersContainer}>
                  {[2, 3].map((index) => {
                    const playerId = index + 1;
                    const isJoinedUser = Object.values(userSlotMap).includes(currentUser?.id || null) && 
                                         userSlotMap[playerId] === currentUser?.id;
                    const isOtherJoinedUser = userSlotMap[playerId] && userSlotMap[playerId] !== currentUser?.id;
                    const isDisabled = isJoinedUser || isOtherJoinedUser;
                    
                    return (
                      <View key={index} style={styles.playerInputGroup}>
                        <Text style={styles.label}>Player {index + 1}:</Text>
                        <TextInput
                          style={[
                            styles.input,
                            isDisabled && styles.disabledInput
                          ]}
                          value={matchSetup.playerNames[index]}
                          onChangeText={(text) => {
                            if (!isDisabled) {
                              const newNames = [...matchSetup.playerNames];
                              newNames[index] = sanitizeInput(text);
                              setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
                            }
                          }}
                          placeholder={`Player ${index + 1}`}
                          placeholderTextColor={theme.colors.inputPlaceholder}
                          editable={!isDisabled}
                        />
                        {isDisabled && (
                          <Text style={styles.disabledText}>
                            {isJoinedUser ? "Your name (joined via code)" : "Player joined via code"}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Score Rules */}
              <Text style={styles.sectionHeader}>Score Rules</Text>
              
              {/* Score to Win */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Score to Win:</Text>
                <View style={styles.buttonRow}>
                  {[11, 7, 15, 21].map((score) => (
                    <TouchableOpacity
                      key={score}
                      style={[
                        styles.dropdownButton,
                        matchSetup.gameScoreLimit === score && styles.dropdownButtonSelected,
                      ]}
                      onPress={() => setMatchSetup(prev => ({ ...prev, gameScoreLimit: score }))}
                    >
                      <Text style={[
                        styles.dropdownButtonText,
                        matchSetup.gameScoreLimit === score && styles.dropdownButtonTextSelected,
                      ]}>
                        {score}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sink Points */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sink Points:</Text>
                <View style={styles.buttonRow}>
                  {[3, 5].map((points) => (
                    <TouchableOpacity
                      key={points}
                      style={[
                        styles.dropdownButton,
                        matchSetup.sinkPoints === points && styles.dropdownButtonSelected,
                      ]}
                      onPress={() => setMatchSetup(prev => ({ ...prev, sinkPoints: points }))}
                    >
                      <Text style={[
                        styles.dropdownButtonText,
                        matchSetup.sinkPoints === points && styles.dropdownButtonTextSelected,
                      ]}>
                        {points}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Win By Two */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Win By Two:</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    matchSetup.winByTwo ? styles.toggleButtonActive : styles.toggleButtonInactive,
                  ]}
                  onPress={() => setMatchSetup((prev) => ({ ...prev, winByTwo: !prev.winByTwo }))}
                >
                  <Text style={styles.toggleButtonText}>
                    {matchSetup.winByTwo ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Home Confirmation Modal */}
      {showHomeConfirmation && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            onPress={cancelGoHome}
          />
          <View style={styles.confirmationModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave Match</Text>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                Are you sure you want to go to the home screen? Any unsaved progress will be lost.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={cancelGoHome}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={confirmGoHome}
              >
                <Text style={styles.modalConfirmText}>Go Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Finish Match Confirmation Modal */}
      {showFinishConfirmation && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            onPress={cancelFinishMatch}
          />
          <View style={styles.confirmationModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finish Match</Text>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                Are you sure you want to finish and save this match? The match will be automatically saved and this action cannot be undone.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={cancelFinishMatch}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={confirmFinishMatch}
              >
                <Text style={styles.modalConfirmText}>Finish Match</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
  };

// StyleSheet for component styling
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  headerCard: {
    marginTop: 100, // Increased space for the back button and safe area
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  roomCodeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  elapsedTimeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 24,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: theme.colors.textPrimary,
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 4,
    marginBottom: 12,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.inputBackground,
  },
  teamNameInput: {
    width: '100%',
    padding: 12,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 4,
    marginBottom: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.infoBackground,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: theme.colors.buttonDisabled,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: theme.colors.textPrimary,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collapseIcon: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCard: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: theme.colors.textSecondary,
  },
  setupSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    marginRight: 8,
  },
  dropdownButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  dropdownButtonTextSelected: {
    color: theme.colors.textOnPrimary,
  },
  joinInstructionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
  },
  settingsIcon: {
    padding: 8,
    marginLeft: 12,
  },
  settingsIconContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  settingsIconCircle: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.textSecondary,
    marginVertical: 1,
  },
  bottomPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  bottomPanelBackdrop: {
    flex: 1,
  },
  bottomPanel: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  panelCloseButton: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    padding: 4,
  },
  panelContent: {
    padding: 20,
  },
  disabledInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    color: theme.colors.textTertiary,
  },
  disabledText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  iconButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  teamGroup: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  teamHeader: {
    marginBottom: 12,
  },
  teamLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  playersContainer: {
    marginTop: 8,
  },
  playerInputGroup: {
    marginBottom: 12,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  confirmationModal: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.error,
    borderBottomRightRadius: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textOnPrimary,
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  placeholderText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  linkText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: theme.colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  scoreboardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  teamScoreboard: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  winnerTeamText: {
    color: theme.colors.gold, // A distinct color for the winning team
  },
  teamScore: {
    fontSize: 40,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  playerInfo: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  scoreboardCenter: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scoreLimitText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  overtimeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.error,
  },
  tiedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.warning,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // Spacing between buttons
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  teamNARow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  throwResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  playerButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
    minWidth: 0, // Allow flex to work properly
    alignItems: 'center',
  },
  playerButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  playerButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  selectedButtonText: {
    color: theme.colors.textOnPrimary,
  },
  throwResultGroup: {
    marginBottom: 8,
  },
  throwResultLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  throwResultButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.backgroundSecondary,
    minWidth: 0, // Allow flex to work properly
  },
  throwResultButtonText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  goodResultOutline: {
    borderWidth: 1,
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successBackground,
  },
  badResultOutline: {
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBackground,
  },
  goodResultSelected: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  badResultSelected: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
  },
  // NEW: Special result styling for Successful Redemption
  specialResultOutline: {
    borderWidth: 1,
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.infoBackground,
  },
  specialResultSelected: {
    backgroundColor: theme.colors.info,
    borderColor: theme.colors.info,
  },
  // NEW: Neutral result styling for N/A
  neutralResultOutline: {
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  neutralResultSelected: {
    backgroundColor: theme.colors.textSecondary,
    borderColor: theme.colors.textSecondary,
  },
  selectedThrowText: {
    color: theme.colors.textOnPrimary,
    fontWeight: 'bold',
  },
  actionButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center', // Center buttons in the row
  },
  actionButton: {
    backgroundColor: theme.colors.warningBackground,
    borderWidth: 2,
    borderColor: theme.colors.warning,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  redButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  redButtonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  nestedCard: {
    backgroundColor: theme.colors.infoBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  nestedCardYellow: {
    backgroundColor: theme.colors.warningBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.6, // 60% width
  },
  errorMessage: {
    color: theme.colors.error,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  orangeButton: {
    backgroundColor: theme.colors.warning,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  orangeButtonText: {
    color: theme.colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  greenButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  greenButtonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  playerStatsCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  playerStatsName: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    color: theme.colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  statText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginRight: 12,
    marginBottom: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50, // Ensure overlay is on top
  },
  dialogCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  dialogMessage: {
    marginBottom: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  dialogButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dialogCancelButton: {
    backgroundColor: theme.colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningMessage: {
    color: theme.colors.warning,
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.success,
  },
  toggleButtonInactive: {
    backgroundColor: theme.colors.error,
  },
  toggleButtonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: 'bold',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 20,
  },
  homeActionButton: {
    backgroundColor: theme.colors.success,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  homeActionButtonText: {
    color: theme.colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  clearSelectionButton: {
    backgroundColor: theme.colors.textSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.4, // 40% width
  },
  clearSelectionButtonText: {
    color: theme.colors.textOnPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  debugContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  debugTeam: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  teamStatsColumn: {
    flex: 1,
  },
  // Manual adjustment styles - Compact design
  manualAdjustCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  manualAdjustTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  manualAdjustSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  compactAdjustmentContainer: {
    gap: 8,
  },
  compactAdjustmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  teamNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  compactTeamName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  adjustmentBadge: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
  },
  compactControls: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    backgroundColor: theme.colors.warningBackground,
    borderWidth: 2,
    borderColor: theme.colors.warning,
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
  },
  compactResetButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 12,
  },
  compactResetButtonText: {
    color: theme.colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

});

export default DieStatsTracker;
// app/tracker/[roomCode]/page.tsx
'use client';

import { supabase } from '@/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Types for player statistics, consistent with your jsonb schema
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
  goals: number;
  onFireCount: number;
  currentlyOnFire: boolean;

  // Individual throw outcomes
  tableDie: number;
  line: number;
  hit: number;
  knicker: number;
  dink: number;
  sink: number;
  short: number;
  long: number;
  side: number;
  height: number;
  goal: number; // Added based on rulebook

  // Defense outcomes
  catchPlusAura: number;
  drop: number;
  miss: number;
  twoHands: number;
  body: number;

  // FIFA outcomes
  goodKick: number;
  badKick: number;
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
  status: 'waiting' | 'active' | 'finished';
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
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State for tracking current play actions
  const [throwingPlayer, setThrowingPlayer] = useState<number | null>(null);
  const [throwResult, setThrowResult] = useState<string>('');
  const [defendingPlayer, setDefendingPlayer] = useState<number | null>(null);
  const [defendingResult, setDefendingResult] = useState<string>('');
  const [fifaKicker, setFifaKicker] = useState<number | null>(null);
  const [fifaAction, setFifaAction] = useState<string>('');
  const [redemptionAction, setRedemptionAction] = useState<string>('');
  const [showFifa, setShowFifa] = useState(false);
  const [showRedemption, setShowRedemption] = useState(false);

  // Helper function to get initial empty player stats
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
    goals: 0,
    onFireCount: 0,
    currentlyOnFire: false,
    tableDie: 0,
    line: 0,
    hit: 0,
    knicker: 0,
    dink: 0,
    sink: 0,
    short: 0,
    long: 0,
    side: 0,
    height: 0,
    goal: 0, // Added
    catchPlusAura: 0,
    drop: 0,
    miss: 0,
    twoHands: 0,
    body: 0,
    goodKick: 0,
    badKick: 0,
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

    // Set the join link for sharing
    setJoinLink(`${process.env.EXPO_PUBLIC_APP_URL || 'https://yourapp.com'}/tracker/${roomCodeString}/join`);
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

  // Effect to load existing live match data when the component mounts or currentUser/roomCode changes
  useEffect(() => {
    // Only proceed if auth is not loading and we have a roomCode string
    if (loadingAuth || !roomCodeString) return;

    const loadExistingMatch = async () => {
      console.log(`DieStatsTracker: Checking for existing match with room code ${roomCodeString}`);

      try {
        const { data, error } = await supabase
          .from('live_matches')
          .select('*')
          .eq('roomCode', roomCodeString)
          .eq('status', 'active')
          .single();

        if (error) {
          // Ignore "no rows found" errors (PGRST116), log other errors
          if (error.code !== 'PGRST116') {
            console.log('Error checking for active match:', error);
          }
          // If no active match found, the setup section should remain visible
          setIsSetupVisible(true);
          return;
        }

        if (data) {
          console.log('Found existing match:', data);
          setLiveSessionId(data.id);
          setMatchSetup(data.matchSetup);
          setPlayerStats(data.livePlayerStats);
          setTeamPenalties(data.liveTeamPenalties as { 1: number; 2: number });
          setMatchStartTime(data.matchStartTime ? new Date(data.matchStartTime) : null);
          setUserSlotMap(data.userSlotMap || {});
          setIsSetupVisible(false); // Hide setup if an active match is loaded
          
          // Determine if the current user is the host
          if (currentUser && data.hostId === currentUser.id) {
            setIsHost(true);
          }
        }
      } catch (error) {
        console.error('Error loading existing match:', error);
      }
    };

    loadExistingMatch();
  }, [roomCodeString, currentUser, loadingAuth]); // Depend on roomCodeString, currentUser, and loadingAuth

  // Supabase Realtime listener for live match updates
  useEffect(() => {
    if (!liveSessionId) {
      console.log('Live session ID not available, skipping live match subscription.');
      return;
    }

    console.log(`DieStatsTracker: Setting up live match subscription for session ${liveSessionId}`);

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
          console.log('Live match update received:', payload);
          const updatedMatch = payload.new as LiveMatch;

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
        }
      )
      .subscribe();

    return () => {
      console.log('DieStatsTracker: Unsubscribing from live match updates.');
      subscription.unsubscribe();
    };
  }, [liveSessionId]); // Depend on liveSessionId to re-subscribe if it changes

  // Helper to sanitize text inputs to prevent script injection or unwanted characters
  const sanitizeInput = (input: string): string => {
    return input.replace(/[^a-zA-Z0-9 \-_.,!]/g, '');
  };

  // Handles starting a new match (Quick Start)
  const handleStartMatch = async (forceStart: boolean = false) => {
    console.log('handleStartMatch (Quick Start) called with forceStart:', forceStart);

    if (!currentUser && !forceStart) {
      setShowConfirm(true);
      return;
    }

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

  // Handles a player joining an active match
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
        .from('profiles')
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

  // Function to update live match data in Supabase (triggered after each play)
  const updateLiveMatchData = async () => {
    if (!liveSessionId) {
      console.log('No live session to update.');
      return;
    }

    try {
      const { error } = await supabase
        .from('live_matches')
        .update({
          livePlayerStats: playerStats,
          liveTeamPenalties: teamPenalties,
          userSlotMap: userSlotMap,
        })
        .eq('id', liveSessionId);

      if (error) {
        console.error('Error updating live match:', error);
        setErrorMessage('Failed to sync play data');
      }
    } catch (error) {
      console.error('Error syncing play:', error);
    }
  };

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

  // Handles the submission of a player's turn/play
  const handleSubmitPlay = async () => {
    if (!throwingPlayer || !throwResult) {
      setErrorMessage('Please select a throwing player and result');
      return;
    }

    if (!matchStartTime) {
      setErrorMessage('Match has not started yet');
      return;
    }

    console.log('Submitting play...');
    const updatedStats = { ...playerStats };
    const updatedPenalties = { ...teamPenalties };

    // Track throw
    updatedStats[throwingPlayer].throws++;
    (updatedStats[throwingPlayer] as any)[throwResult] =
      ((updatedStats[throwingPlayer] as any)[throwResult] || 0) + 1;

    const hitOutcomes = ['hit', 'knicker', 'goal', 'dink', 'sink'];
    const badThrowOutcomes = ['short', 'long', 'side', 'height'];
    const wasOnFire = updatedStats[throwingPlayer].currentlyOnFire;

    // Update hit streak and on fire status
    if (hitOutcomes.includes(throwResult)) {
      updatedStats[throwingPlayer].hits++;
      updatedStats[throwingPlayer].hitStreak++;

      if (['knicker', 'dink', 'sink'].includes(throwResult)) {
        updatedStats[throwingPlayer].specialThrows++;
      }

      if (throwResult === 'goal') {
        updatedStats[throwingPlayer].goals++;
      }
    } else {
      updatedStats[throwingPlayer].hitStreak = 0;
    }

    if (badThrowOutcomes.includes(throwResult)) {
      if (throwResult === 'height') {
        updatedStats[throwingPlayer].blunders++;
      }
    }

    if (throwResult === 'line') {
      updatedStats[throwingPlayer].lineThrows++;
    }

    // Update on fire status
    updatedStats[throwingPlayer].currentlyOnFire = updatedStats[throwingPlayer].hitStreak >= 3;
    
    // Track throws made while on fire
    if (wasOnFire) {
      updatedStats[throwingPlayer].onFireCount++;
    }

    // Calculate base points for the throw
    const scoreMap: { [key: string]: number } = {
      hit: 1,
      knicker: 1,
      goal: 2,
      dink: 2,
      sink: matchSetup.sinkPoints,
    };
    let pointsToAdd = scoreMap[throwResult] || 0;
    let preventScoring = false;

    // Handle defense
    if (defendingPlayer && defendingResult) {
      if (defendingPlayer === -1) {
        // Team defense - apply to both players on opposing team
        const throwingTeam = getPlayerTeam(throwingPlayer);
        const defendingTeam = throwingTeam === 1 ? 2 : 1;
        const defendingPlayers = defendingTeam === 1 ? [1, 2] : [3, 4];
        
        for (const playerId of defendingPlayers) {
          if (defendingResult === 'catch' || defendingResult === 'catchPlusAura') {
            updatedStats[playerId].catches++;
            if (defendingResult === 'catchPlusAura') {
              updatedStats[playerId].catchPlusAura++;
              updatedStats[playerId].aura++;
            }
          } else {
            updatedStats[playerId].blunders++;
            (updatedStats[playerId] as any)[defendingResult] =
              ((updatedStats[playerId] as any)[defendingResult] || 0) + 1;
          }
        }
        
        if (defendingResult === 'catch' || defendingResult === 'catchPlusAura') {
          preventScoring = true;
        }
      } else if (defendingPlayer !== null && defendingPlayer > 0) {
        // Individual player defense
        if (defendingResult === 'catch' || defendingResult === 'catchPlusAura') {
          updatedStats[defendingPlayer].catches++;
          preventScoring = true;
          if (defendingResult === 'catchPlusAura') {
            updatedStats[defendingPlayer].catchPlusAura++;
            updatedStats[defendingPlayer].aura++;
          }
        } else {
          updatedStats[defendingPlayer].blunders++;
          (updatedStats[defendingPlayer] as any)[defendingResult] =
            ((updatedStats[defendingPlayer] as any)[defendingResult] || 0) + 1;
        }
      }
    }

    // Handle FIFA
    if (fifaKicker && fifaAction) {
      updatedStats[fifaKicker].fifaAttempts++;
      const fifaTeam = getPlayerTeam(fifaKicker);
      const opposingTeam = fifaTeam === 1 ? 2 : 1;
      const gameState = getGameState();
      
      const fifaTeamScore = calculateTeamScore(fifaTeam);
      const opposingScore = calculateTeamScore(opposingTeam);
      
      const isFifaSave = 
        badThrowOutcomes.includes(throwResult) &&
        fifaAction === 'goodKick' &&
        (defendingResult === 'catch' || defendingResult === 'catchPlusAura');

      if (isFifaSave) {
        console.log("Rule Applied: FIFA Save");
        updatedStats[fifaKicker].fifaSuccess++;
        updatedStats[fifaKicker].goodKick++;

        if (defendingPlayer === -1) {
          const defendingTeamId = getPlayerTeam(throwingPlayer) === 1 ? 2 : 1;
          const defenders = defendingTeamId === 1 ? [1, 2] : [3, 4];
          for (const defender of defenders) {
            updatedStats[defender].score++;
          }
        } else if (defendingPlayer !== null && defendingPlayer > 0) {
          updatedStats[defendingPlayer].score++;
        }
      } else {
        if (fifaAction === 'goodKick') {
          updatedStats[fifaKicker].fifaSuccess++;
          updatedStats[fifaKicker].goodKick++;
          
          if (gameState === 'matchPoint' || gameState === 'advantage') {
            updatedPenalties[opposingTeam as 1 | 2]++;
          } else if (gameState === 'overtime') {
            if (fifaTeamScore <= opposingScore) {
              updatedStats[fifaKicker].score++;
            }
          } else {
            // Standard play: good kick scores 1 point
            updatedStats[fifaKicker].score++;
          }
        } else { // badKick
          updatedStats[fifaKicker].badKick++;
          
          if (gameState === 'overtime') {
            if (fifaTeamScore <= opposingScore) {
              updatedStats[fifaKicker].score++;
            }
          } else {
            // Standard play: bad kick also scores 1 point
            updatedStats[fifaKicker].score++;
          }
        }
      }
    }

    // Handle redemption
    if (redemptionAction === 'success') {
      const throwingPlayerTeam = getPlayerTeam(throwingPlayer);
      const opposingTeam = throwingPlayerTeam === 1 ? 2 : 1;
      updatedPenalties[opposingTeam as 1 | 2]++;
      preventScoring = true; // Redemption negates scoring
    }

    // Apply points from throw (if not prevented by catch or redemption)
    if (!preventScoring && pointsToAdd > 0) {
      updatedStats[throwingPlayer].score += pointsToAdd;
    }

    setPlayerStats(updatedStats);
    setTeamPenalties(updatedPenalties);

    await updateLiveMatchData();

    // Reset for next play
    setThrowingPlayer(null);
    setThrowResult('');
    setDefendingPlayer(null);
    setDefendingResult('');
    setFifaKicker(null);
    setFifaAction('');
    setRedemptionAction('');
    setShowFifa(false);
    setShowRedemption(false);
    setErrorMessage('');
  };

  // Handles the "Self Sink" action
  const handleSelfSink = () => {
    if (!throwingPlayer) {
      setErrorMessage('Please select a player for Self Sink');
      return;
    }

    Alert.alert(
      'Uh Oh!',
      `Uh Oh! ${matchSetup.playerNames[throwingPlayer - 1]} just sunk it in their own cup! ${
        matchSetup.playerNames[throwingPlayer - 1]
      } must run a naked lap or forfeit the match!!!`
    );

    setThrowingPlayer(null);
    setThrowResult('');
    setDefendingPlayer(null);
    setDefendingResult('');
  };

  // Calculates the score for a given team
  const calculateTeamScore = (teamNumber: number): number => {
    const playerIndices = teamNumber === 1 ? [1, 2] : [3, 4];
    const teamScore = playerIndices.reduce((sum, playerId) => {
      return sum + (playerStats[playerId]?.score || 0);
    }, 0);
    return teamScore - (teamPenalties[teamNumber as 1 | 2] || 0);
  };

  // Calculates a player's rating based on various stats
  const calculatePlayerRating = (playerId: number): number => {
    const player = playerStats[playerId];
    if (!player) return 0;

    const hitRate = player.throws > 0 ? player.hits / player.throws : 0;
    
    // Corrected Catch Rate calculation based on the rulebook
    // Denominator is total catches plus total blunders (defensive errors + 'height' throws)
    const totalDefensivePlays = player.catches + player.blunders;
    const catchRate = totalDefensivePlays > 0 ? player.catches / totalDefensivePlays : 0;
    
    const averageRate = (hitRate + catchRate) / 2;
    const fifaRate = player.fifaAttempts > 0 ? player.fifaSuccess / player.fifaAttempts : 0;

    // Calculate base score according to rulebook formula
    const baseScore = ((0.85 * averageRate) + (0.10 * fifaRate)) / 0.95 * 100;

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

    return Math.min(100, baseScore + awards);
  };

  // Handles finishing the match, determining the winner and updating live session status
  const handleFinishMatch = async () => {
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
  };

  // Handles saving match statistics to the 'saved_matches' table
  const handleSaveStats = async () => {
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
      const matchData = {
        userId: savingUserId, // Use the determined saving user's ID
        roomCode: roomCodeString,
        matchSetup: matchSetup,
        playerStats: playerStats,
        teamPenalties: teamPenalties,
        matchStartTime: matchStartTime?.toISOString(),
        winnerTeam: winnerTeam,
        matchDuration: matchStartTime
          ? Math.floor((Date.now() - matchStartTime.getTime()) / 1000)
          : 0,
        userSlotMap: userSlotMap,
      };
  
      const { error } = await supabase
        .from('saved_matches')
        .insert([matchData]);
  
      if (error) throw error;
  
      Alert.alert('Success', 'Match statistics saved successfully!');
  
      if (liveSessionId) {
        await supabase
          .from('live_matches')
          .delete()
          .eq('id', liveSessionId);
      }
  
      setLiveSessionId(null);
    } catch (error: any) {
      console.error('Error saving match:', error.message);
      Alert.alert('Error', `Failed to save match statistics: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handles starting a completely new game, prompting to save current first
  const handleNewGame = () => {
    Alert.alert(
      'Start New Game',
      'Are you sure you want to start a new game? Current match data will be lost if not saved.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            const newRoomCode = generateId(6);
            router.push(`/tracker/${newRoomCode}`);
          },
        },
      ]
    );
  };

  // Handles copying the join link
  const handleCopyJoinLink = () => {
    Alert.alert('Join Link', joinLink);
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
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{matchSetup.title}</Text>
        <Text style={styles.headerSubtitle}>{matchSetup.arena}</Text>
        <Text style={styles.roomCodeText}>Room: {roomCodeString}</Text>

        {matchStartTime && (
          <Text style={styles.elapsedTimeText}>
            Elapsed:{' '}
            {`${Math.floor((Date.now() - matchStartTime.getTime()) / 1000 / 60)}:${String(
              Math.floor(((Date.now() - matchStartTime.getTime()) / 1000) % 60)
            ).padStart(2, '0')}`}
          </Text>
        )}
      </View>

      {/* Match Setup Section (shown based on isSetupVisible state) */}
      {isSetupVisible && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match Setup</Text>

          <TextInput
            style={styles.input}
            placeholder="Match Title"
            value={matchSetup.title}
            onChangeText={(text) =>
              setMatchSetup((prev) => ({ ...prev, title: sanitizeInput(text) }))
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Arena"
            value={matchSetup.arena}
            onChangeText={(text) =>
              setMatchSetup((prev) => ({ ...prev, arena: sanitizeInput(text) }))
            }
          />

          {/* Player Names Inputs */}
          {matchSetup.playerNames.map((name, index) => (
            <TextInput
              key={index}
              style={styles.input}
              placeholder={`Player ${index + 1}`}
              value={name}
              onChangeText={(text) => {
                const newNames = [...matchSetup.playerNames];
                newNames[index] = sanitizeInput(text);
                setMatchSetup((prev) => ({ ...prev, playerNames: newNames }));
              }}
            />
          ))}

          {/* Team Names Inputs */}
          {matchSetup.teamNames.map((name, index) => (
            <TextInput
              key={index}
              style={styles.input}
              placeholder={`Team ${index + 1}`}
              value={name}
              onChangeText={(text) => {
                const newNames = [...matchSetup.teamNames];
                newNames[index] = sanitizeInput(text);
                setMatchSetup((prev) => ({ ...prev, teamNames: newNames }));
              }}
            />
          ))}
          {/* Game Score Limit Input */}
          <TextInput
            style={styles.input}
            placeholder="Game Score Limit"
            keyboardType="numeric"
            value={matchSetup.gameScoreLimit.toString()}
            onChangeText={(text) =>
              setMatchSetup((prev) => ({ ...prev, gameScoreLimit: parseInt(text) || 0 }))
            }
          />

          {/* Sink Points Input */}
          <TextInput
            style={styles.input}
            placeholder="Sink Points"
            keyboardType="numeric"
            value={matchSetup.sinkPoints.toString()}
            onChangeText={(text) =>
              setMatchSetup((prev) => ({ ...prev, sinkPoints: parseInt(text) || 0 }))
            }
          />

          {/* Win By Two Toggle (Simple example, can be improved) */}
          <View style={styles.toggleRow}>
            <Text style={styles.sectionHeader}>Win By Two:</Text>
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


          {/* Start Match / Quick Start Button */}
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
          {/* QR Code and Join Link Section */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Players can join using:</Text>
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
              <View style={styles.buttonRow}>
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
                        styles.buttonText,
                        throwingPlayer === playerId && styles.selectedButtonText,
                      ]}
                    >
                      {matchSetup.playerNames[playerId - 1]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Throw Result Selection (Good Outcomes) */}
              <Text style={styles.sectionHeader}>Throw Result:</Text>
              <View style={styles.throwResultGroup}>
                <Text style={styles.throwResultLabel}>Good:</Text>
                <View style={styles.buttonRow}>
                  {['tableDie', 'line', 'hit', 'knicker', 'goal', 'dink', 'sink'].map((result) => (
                    <TouchableOpacity
                      key={result}
                      style={[
                        styles.throwResultButton,
                        throwResult === result && styles.goodResultSelected,
                      ]}
                      onPress={() => setThrowResult(result)}
                    >
                      <Text style={styles.throwResultButtonText}>
                        {result === 'tableDie' ? 'Table Die' : result.charAt(0).toUpperCase() + result.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Throw Result Selection (Bad Outcomes) */}
              <View style={styles.throwResultGroup}>
                <Text style={styles.throwResultLabel}>Bad:</Text>
                <View style={styles.buttonRow}>
                  {['short', 'long', 'side', 'height'].map((result) => (
                    <TouchableOpacity
                      key={result}
                      style={[
                        styles.throwResultButton,
                        throwResult === result && styles.badResultSelected,
                      ]}
                      onPress={() => setThrowResult(result)}
                    >
                      <Text style={styles.throwResultButtonText}>{result.charAt(0).toUpperCase() + result.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Defending Player Selection */}
              <Text style={styles.sectionHeader}>Defending Player:</Text>
              <View style={styles.buttonRow}>
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
                        styles.buttonText,
                        defendingPlayer === playerId && styles.selectedButtonText,
                      ]}
                    >
                      {matchSetup.playerNames[playerId - 1]}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Options for Team or Not Applicable */}
                <TouchableOpacity
                  style={[
                    styles.playerButton,
                    defendingPlayer === -1 && styles.playerButtonSelected,
                  ]}
                  onPress={() => setDefendingPlayer(-1)}
                >
                  <Text
                    style={[
                      styles.buttonText,
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
                      styles.buttonText,
                      defendingPlayer === 0 && styles.selectedButtonText,
                    ]}
                  >
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Defense Result Selection (Good Outcomes) */}
              <Text style={styles.sectionHeader}>Defense Result:</Text>
              <View style={styles.throwResultGroup}>
                <Text style={styles.throwResultLabel}>Good:</Text>
                <View style={styles.buttonRow}>
                  {['catch', 'catchPlusAura'].map((result) => (
                    <TouchableOpacity
                      key={result}
                      style={[
                        styles.throwResultButton,
                        defendingResult === result && styles.goodResultSelected,
                      ]}
                      onPress={() => setDefendingResult(result)}
                    >
                      <Text style={styles.throwResultButtonText}>
                        {result === 'catchPlusAura' ? 'Catch + Aura' : 'Catch'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Defense Result Selection (Bad Outcomes) */}
              <View style={styles.throwResultGroup}>
                <Text style={styles.throwResultLabel}>Bad:</Text>
                <View style={styles.buttonRow}>
                  {['drop', 'miss', 'twoHands', 'body'].map((result) => (
                    <TouchableOpacity
                      key={result}
                      style={[
                        styles.throwResultButton,
                        defendingResult === result && styles.badResultSelected,
                      ]}
                      onPress={() => setDefendingResult(result)}
                    >
                      <Text style={styles.throwResultButtonText}>
                        {result === 'twoHands' ? '2 Hands' : result.charAt(0).toUpperCase() + result.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowRedemption(!showRedemption)}
                >
                  <Text style={styles.actionButtonText}>
                    {showRedemption ? 'Hide Redemption' : 'Show Redemption'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.redButton} onPress={handleSelfSink}>
                  <Text style={styles.buttonText}>Self Sink</Text>
                </TouchableOpacity>
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
                            styles.buttonText,
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

              {/* Redemption Section (conditionally rendered) */}
              {showRedemption && (
                <View style={styles.nestedCardYellow}>
                  <Text style={styles.sectionHeader}>Redemption:</Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.playerButton,
                        redemptionAction === 'success' && styles.goodResultSelected,
                      ]}
                      onPress={() => setRedemptionAction('success')}
                    >
                      <Text style={styles.throwResultButtonText}>Success</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.playerButton,
                        redemptionAction === 'failed' && styles.badResultSelected,
                      ]}
                      onPress={() => setRedemptionAction('failed')}
                    >
                      <Text style={styles.throwResultButtonText}>Failed</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Submit Play Button */}
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitPlay}>
                <Text style={styles.buttonText}>Submit Play</Text>
              </TouchableOpacity>

              {errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
            </View>
          )}

          {/* Match Controls Section (Show/Hide Stats, Finish, Save, New Game, Show/Hide Setup) */}
          <View style={styles.card}>
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowStats(!showStats)}
              >
                <Text style={styles.actionButtonText}>
                  {showStats ? 'Hide Stats' : 'Show Stats'}
                </Text>
              </TouchableOpacity>
              {!matchFinished && (
                <TouchableOpacity style={styles.orangeButton} onPress={handleFinishMatch}>
                  <Text style={styles.buttonText}>Finish Match</Text>
                </TouchableOpacity>
              )}
              {matchFinished && (
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.disabledButton]}
                  onPress={handleSaveStats}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>{isLoading ? 'Saving...' : 'Save Stats'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionButton} onPress={handleNewGame}>
                <Text style={styles.actionButtonText}>New Game</Text>
              </TouchableOpacity>
              {/* Toggle Setup Visibility Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsSetupVisible(!isSetupVisible)}
              >
                <Text style={styles.actionButtonText}>
                  {isSetupVisible ? 'Hide Setup' : 'Show Setup'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Player Statistics Section */}
          {showStats && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Player Statistics</Text>
              {[1, 2, 3, 4].map((playerId) => {
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
                      {userSlotMap[playerId.toString()] !== null && userSlotMap[playerId.toString()] !== undefined
                        ? ` (User: ${userSlotMap[playerId.toString()]!.substring(0, 8)}...)`
                        : ''}
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
  );
};

// StyleSheet for component styling
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 24,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 20,
    color: '#4b5563',
    marginBottom: 8,
  },
  roomCodeText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  elapsedTimeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  card: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginBottom: 12,
    color: '#1f2937',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#1f2937',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
  linkText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#374151',
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
    color: '#1f2937',
  },
  winnerTeamText: {
    color: '#f59e0b', // A distinct color for the winning team
  },
  teamScore: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  playerInfo: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  scoreboardCenter: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scoreLimitText: {
    fontSize: 14,
    color: '#6b7280',
  },
  overtimeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  tiedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f97316',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // Spacing between buttons
    marginBottom: 16,
  },
  playerButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  playerButtonSelected: {
    backgroundColor: '#3b82f6',
  },
  selectedButtonText: {
    color: '#ffffff',
  },
  throwResultGroup: {
    marginBottom: 8,
  },
  throwResultLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  throwResultButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  throwResultButtonText: {
    fontSize: 12,
    color: '#374151',
  },
  goodResultSelected: {
    backgroundColor: '#22c55e',
  },
  badResultSelected: {
    backgroundColor: '#ef4444',
  },
  actionButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center', // Center buttons in the row
  },
  actionButton: {
    backgroundColor: '#8b5cf6', // Purple color for general actions
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  redButton: {
    backgroundColor: '#ef4444', // Red color for critical actions like Self Sink
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  nestedCard: {
    backgroundColor: '#f5f3ff', // Light purple for nested sections (e.g., FIFA)
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  nestedCardYellow: {
    backgroundColor: '#fffbeb', // Light yellow for other nested sections (e.g., Redemption)
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#22c55e', // Green for submit/confirm actions
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    color: '#ef4444', // Red for error messages
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  orangeButton: {
    backgroundColor: '#f97316', // Orange for warning/secondary actions
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  greenButton: {
    backgroundColor: '#22c55e', // Green for positive actions
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  playerStatsCard: {
    backgroundColor: '#f9fafb', // Light background for individual player stats
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  playerStatsName: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    color: '#1f2937',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  statText: {
    fontSize: 14,
    color: '#374151',
    marginRight: 12,
    marginBottom: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black background
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50, // Ensure overlay is on top
  },
  dialogCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  dialogMessage: {
    marginBottom: 16,
    color: '#4b5563',
    textAlign: 'center',
  },
  dialogButton: {
    backgroundColor: '#3b82f6', // Blue for dialog actions
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dialogCancelButton: {
    backgroundColor: '#d1d5db', // Grey for cancel actions
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningMessage: {
    color: '#f97316', // Orange for warning text
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
    backgroundColor: '#22c55e',
  },
  toggleButtonInactive: {
    backgroundColor: '#ef4444',
  },
  toggleButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default DieStatsTracker;
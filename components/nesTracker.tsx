 import React, { useState, useEffect, useCallback, useMemo, ComponentProps } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, TextStyle, ViewStyle, ImageStyle } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Image } from 'expo-image';

// --- Mock Components ---
interface ThemedTextProps extends ComponentProps<typeof Text> {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle';
}
const ThemedText = ({ style, type, ...rest }: ThemedTextProps) => (
  <Text style={[styles.text_default, type && (styles as any)[`text_${type}`], style]} {...rest} />
);
const ThemedView = (props: View['props']) => <View {...props} />;
const HelloWave = () => <Text style={{ fontSize: 24 }}>👋</Text>;
const ParallaxScrollView = ({ headerBackgroundColor, headerImage, children }: any) => (
  <ScrollView style={styles.parallaxScroll}>
    <View style={[styles.parallaxHeader, { backgroundColor: headerBackgroundColor.light }]}>
      {headerImage}
    </View>
    <View style={styles.parallaxContent}>
      {children}
    </View>
  </ScrollView>
);

interface IconSymbolProps { size: number; name: string; color: string; }
const IconSymbol = ({ size, name, color }: IconSymbolProps) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: size * 0.7, color: color, fontWeight: 'bold' }}>
      {name.split('.')[0][0].toUpperCase()}
    </Text>
  </View>
);
// --- End Mock Components ---

// --- Helper Functions ---
const sanitizeInput = (input: string) => {
  return input.replace(/[^a-zA-Z0-9\s\-_.,!]/g, '');
};

// --- Type Definitions for better clarity and indexing ---
type PlayerId = 1 | 2 | 3 | 4;
type TeamId = 1 | 2;
type DefendingPlayerOption = PlayerId | 'TEAM' | 'N/A';

interface PlayerStats {
  name: string; throws: number; hits: number; blunders: number; catches: number; score: number; aura: number;
  fifaAttempts: number; fifaSuccess: number; hitStreak: number; specialThrows: number; lineThrows: number; goals: number;
  onFireCount: number; currentlyOnFire: boolean; tableDie: number; line: number; hit: number; knicker: number;
  dink: number; sink: number; short: number; long: number; side: number; height: number; catchPlusAura: number; drop: number;
  miss: number; twoHands: number; body: number; goodKick: number; badKick: number;
}
type AllPlayerStats = Record<PlayerId, PlayerStats>;
type TeamPenalties = Record<TeamId, number>;


const getInitialPlayerStats = (): AllPlayerStats => ({
  1: {
    name: 'Player1', throws: 0, hits: 0, blunders: 0, catches: 0, score: 0, aura: 0,
    fifaAttempts: 0, fifaSuccess: 0, hitStreak: 0, specialThrows: 0, lineThrows: 0, goals: 0,
    onFireCount: 0, currentlyOnFire: false, tableDie: 0, line: 0, hit: 0, knicker: 0,
    dink: 0, sink: 0, short: 0, long: 0, side: 0, height: 0, catchPlusAura: 0, drop: 0,
    miss: 0, twoHands: 0, body: 0, goodKick: 0, badKick: 0,
  },
  2: {
    name: 'Player2', throws: 0, hits: 0, blunders: 0, catches: 0, score: 0, aura: 0,
    fifaAttempts: 0, fifaSuccess: 0, hitStreak: 0, specialThrows: 0, lineThrows: 0, goals: 0,
    onFireCount: 0, currentlyOnFire: false, tableDie: 0, line: 0, hit: 0, knicker: 0,
    dink: 0, sink: 0, short: 0, long: 0, side: 0, height: 0, catchPlusAura: 0, drop: 0,
    miss: 0, twoHands: 0, body: 0, goodKick: 0, badKick: 0,
  },
  3: {
    name: 'Player3', throws: 0, hits: 0, blunders: 0, catches: 0, score: 0, aura: 0,
    fifaAttempts: 0, fifaSuccess: 0, hitStreak: 0, specialThrows: 0, lineThrows: 0, goals: 0,
    onFireCount: 0, currentlyOnFire: false, tableDie: 0, line: 0, hit: 0, knicker: 0,
    dink: 0, sink: 0, short: 0, long: 0, side: 0, height: 0, catchPlusAura: 0, drop: 0,
    miss: 0, twoHands: 0, body: 0, goodKick: 0, badKick: 0,
  },
  4: {
    name: 'Player4', throws: 0, hits: 0, blunders: 0, catches: 0, score: 0, aura: 0,
    fifaAttempts: 0, fifaSuccess: 0, hitStreak: 0, specialThrows: 0, lineThrows: 0, goals: 0,
    onFireCount: 0, currentlyOnFire: false, tableDie: 0, line: 0, hit: 0, knicker: 0,
    dink: 0, sink: 0, short: 0, long: 0, side: 0, height: 0, catchPlusAura: 0, drop: 0,
    miss: 0, twoHands: 0, body: 0, goodKick: 0, badKick: 0,
  },
});

const getInitialTeamPenalties = (): TeamPenalties => ({ 1: 0, 2: 0 });

const getScoreMap = (sinkPoints: number) => ({
  'Hit': 1, 'Knicker': 1, 'Goal': 2, 'Dink': 2, 'Sink': sinkPoints,
  'Table Die': 0, 'Line': 0, 'Short': 0, 'Long': 0, 'Side': 0, 'Height': 0, 'Self Sink': 0,
});

const hitOutcomes = ['Hit', 'Knicker', 'Goal', 'Dink', 'Sink'];
const badThrowOptions = ['Short', 'Long', 'Side', 'Height', 'Self Sink'];
const goodDefenseOptions = ['Catch + Aura', 'Catch'];

// --- Component Props ---
interface NesTrackerProps {
  roomCode: string;
}

// --- Main Component ---
export default function NesTracker({ roomCode }: NesTrackerProps) {
  // --- Game Setup State ---
  const [playerNames, setPlayerNames] = useState<Record<PlayerId, string>>({
    1: 'Player1', 2: 'Player2', 3: 'Player3', 4: 'Player4',
  });
  const [teamNames, setTeamNames] = useState<Record<TeamId, string>>({
    1: 'Team 1', 2: 'Team 2',
  });
  const [matchTitle, setMatchTitle] = useState('Finals');
  const [arena, setArena] = useState('The Grand Dome');
  const [gameScoreLimit, setGameScoreLimit] = useState(11);
  const [sinkPoints, setSinkPoints] = useState(3);
  const [winByTwo, setWinByTwo] = useState(true);

  // --- Gameplay State ---
  const [throwingPlayerId, setThrowingPlayerId] = useState<PlayerId | null>(null);
  const [throwResult, setThrowResult] = useState<string | null>(null);
  const [defendingPlayerId, setDefendingPlayerId] = useState<DefendingPlayerOption | null>(null);
  const [defenseResult, setDefenseResult] = useState<string | null>(null);
  const [fifaKickerId, setFifaKickerId] = useState<PlayerId | null>(null);
  const [fifaAction, setFifaAction] = useState<string | null>(null);
  const [redemptionAction, setRedemptionAction] = useState<string | null>(null);

  // --- Stats State ---
  const [playerStats, setPlayerStats] = useState<AllPlayerStats>(getInitialPlayerStats());
  const [teamPenalties, setTeamPenalties] = useState<TeamPenalties>(getInitialTeamPenalties());
  const [matchFinished, setMatchFinished] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState<TeamId | null>(null);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // --- UI Visibility State ---
  const [showMatchSetup, setShowMatchSetup] = useState(true);
  const [showGameOptions, setShowGameOptions] = useState(false);
  const [showFIFA, setShowFIFA] = useState(false);
  const [showRedemption, setShowRedemption] = useState(false);
  const [showMatchStats, setShowMatchStats] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showStartMatchPopup, setShowStartMatchPopup] = useState(false);
  const [startMatchMessage, setStartMatchMessage] = useState('');

  // --- Mapped Scores for Easy Access ---
  const currentScoreMap = useMemo(() => getScoreMap(sinkPoints), [sinkPoints]);

  // --- Derived State for Scoreboard ---
  const team1Score = useMemo(() => {
    const p1Score = playerStats[1].score;
    const p2Score = playerStats[2].score;
    return p1Score + p2Score + teamPenalties[1];
  }, [playerStats, teamPenalties]);

  const team2Score = useMemo(() => {
    const p3Score = playerStats[3].score;
    const p4Score = playerStats[4].score;
    return p3Score + p4Score + teamPenalties[2];
  }, [playerStats, teamPenalties]);

  const isOvertime = useMemo(() => {
    if (!winByTwo) return false;
    const team1GTE = team1Score >= gameScoreLimit;
    const team2GTE = team2Score >= gameScoreLimit;
    const scoreDiffLessTwo = Math.abs(team1Score - team2Score) < 2;
    return (team1GTE || team2GTE) && scoreDiffLessTwo;
  }, [team1Score, team2Score, gameScoreLimit, winByTwo]);

  const isTied = useMemo(() => {
    if (isOvertime) return false;
    return team1Score === team2Score;
  }, [team1Score, team2Score, isOvertime]);

  const team1MatchPoint = useMemo(() => {
    return !isOvertime && team1Score === (gameScoreLimit - 1) && team2Score < (gameScoreLimit - 1);
  }, [team1Score, team2Score, gameScoreLimit, isOvertime]);

  const team2MatchPoint = useMemo(() => {
    return !isOvertime && team2Score === (gameScoreLimit - 1) && team1Score < (gameScoreLimit - 1);
  }, [team1Score, team2Score, gameScoreLimit, isOvertime]);

  const team1Leading = team1Score > team2Score;
  const team2Leading = team2Score > team1Score;

  // --- Elapsed Time Effect ---
  useEffect(() => {
    let interval: number | undefined;
    if (matchStartTime && !matchFinished) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
      }
    };
  }, [matchStartTime, matchFinished]);

  const formatElapsedTime = useCallback(() => {
    if (!matchStartTime) return '00:00';
    const elapsedSeconds = Math.floor((currentTime - matchStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, [matchStartTime, currentTime]);

  // --- Player/Team Utils ---
  const getPlayerTeamId = useCallback((playerId: PlayerId): TeamId => (playerId === 1 || playerId === 2 ? 1 : 2), []);
  const getOpponentTeamId = useCallback((teamId: TeamId): TeamId => (teamId === 1 ? 2 : 1), []);
  const getPlayersOnTeam = useCallback((teamId: TeamId): PlayerId[] => (teamId === 1 ? [1, 2] : [3, 4]), []);

  // --- Win Condition Check ---
  const checkWinCondition = useCallback(() => {
    let winner: TeamId | null = null;
    if (winByTwo) {
      if (team1Score >= gameScoreLimit && (team1Score - team2Score) >= 2) {
        winner = 1;
      } else if (team2Score >= gameScoreLimit && (team2Score - team1Score) >= 2) {
        winner = 2;
      }
    } else {
      if (team1Score >= gameScoreLimit) {
        winner = 1;
      } else if (team2Score >= gameScoreLimit) {
        winner = 2;
      }
    }

    if (winner !== null && !matchFinished) {
      setWinnerTeam(winner);
      setMatchFinished(true);
      Alert.alert('Game Over!', `${teamNames[winner]} wins!`);
    }
  }, [team1Score, team2Score, gameScoreLimit, winByTwo, matchFinished, teamNames]);


  // --- Core Play Submission Logic ---
  const handleSubmitPlay = useCallback(() => {
    if (matchFinished) {
      setErrorMessage('Match is finished. Start a new game to continue.');
      return;
    }
    if (!matchStartTime) {
      setErrorMessage('Match has not started. Click "Start Match" first.');
      return;
    }

    if (throwResult === 'Self Sink') {
      if (throwingPlayerId === null) {
        setErrorMessage('Please select a player for Self Sink.');
        return;
      }
      Alert.alert(
        'Self Sink!',
        `Uh Oh! ${playerNames[throwingPlayerId]} just sunk it in their own cup! ${playerNames[throwingPlayerId]} must run a naked lap or forfeit the match!!!`
      );
      setThrowingPlayerId(null);
      setThrowResult(null);
      setDefendingPlayerId(null);
      setDefenseResult(null);
      setFifaKickerId(null);
      setFifaAction(null);
      setRedemptionAction(null);
      setErrorMessage('');
      return;
    }

    if (throwingPlayerId === null) {
      setErrorMessage('Please select a throwing player.');
      return;
    }
    if (throwResult === null) {
      setErrorMessage('Please select a throw result.');
      return;
    }
    if (defendingPlayerId === null || defenseResult === null) {
      setErrorMessage('Please select a defending player and defense result.');
      return;
    }


    setErrorMessage('');

    setPlayerStats(prevStats => {
      const newStats: AllPlayerStats = { ...prevStats };
      const currentThrowerId: PlayerId = throwingPlayerId!;
      const throwerTeamId = getPlayerTeamId(currentThrowerId);
      const opponentTeamId = getOpponentTeamId(throwerTeamId);

      newStats[currentThrowerId].throws++;

      const isScoringThrow = hitOutcomes.includes(throwResult);

      if (isScoringThrow) {
        newStats[currentThrowerId].hits++;
        newStats[currentThrowerId].hitStreak++;
        (newStats[currentThrowerId] as any)[throwResult.toLowerCase()]++;
        if (['Knicker', 'Dink', 'Sink'].includes(throwResult)) {
          newStats[currentThrowerId].specialThrows++;
        }
        if (throwResult === 'Goal') {
          newStats[currentThrowerId].goals++;
        }
        if (newStats[currentThrowerId].hitStreak >= 3) {
          newStats[currentThrowerId].currentlyOnFire = true;
          newStats[currentThrowerId].onFireCount++;
        }
      } else {
        newStats[currentThrowerId].hitStreak = 0;
        newStats[currentThrowerId].currentlyOnFire = false;
        (newStats[currentThrowerId] as any)[throwResult.toLowerCase()]++;
        if (throwResult === 'Height') {
          newStats[currentThrowerId].blunders++;
        }
      }
      if (throwResult === 'Line') {
        newStats[currentThrowerId].lineThrows++;
      }


      const defenders: PlayerId[] = [];
      if (defendingPlayerId === 'TEAM') {
        defenders.push(...getPlayersOnTeam(opponentTeamId));
      } else if (defendingPlayerId !== 'N/A' && defendingPlayerId !== null) {
        defenders.push(defendingPlayerId);
      }

      defenders.forEach(defenderId => {
        if (defenseResult === 'Catch' || defenseResult === 'Catch + Aura') {
          newStats[defenderId].catches++;
          if (defenseResult === 'Catch + Aura') {
            newStats[defenderId].catchPlusAura++;
            newStats[defenderId].aura++;
          }
        } else if (defenseResult !== 'N/A') {
          newStats[defenderId].blunders++;
          const propKey = defenseResult.toLowerCase().replace('+', 'Plus');
          if ((newStats[defenderId] as any)[propKey] !== undefined) {
              (newStats[defenderId] as any)[propKey]++;
          }
        }
      });

      let pointsAwarded = 0;
      if (isScoringThrow) {
        pointsAwarded = currentScoreMap[throwResult as keyof typeof currentScoreMap];
        const isCaught = goodDefenseOptions.includes(defenseResult!);
        if (isCaught) {
          pointsAwarded = 0;
        }
      }
      newStats[currentThrowerId].score += pointsAwarded;

      if (redemptionAction === 'Success') {
          if (isScoringThrow && !goodDefenseOptions.includes(defenseResult!)) {
              newStats[currentThrowerId].score -= pointsAwarded;
          }
          setTeamPenalties(prevPenalties => ({
              ...prevPenalties,
              [opponentTeamId]: prevPenalties[opponentTeamId] - 1,
          }));
      }

      if (fifaKickerId !== null && fifaAction !== null) {
          const currentFifaKickerId: PlayerId = fifaKickerId;
          newStats[currentFifaKickerId].fifaAttempts++;
          if (fifaAction === 'Good Kick') {
            newStats[currentFifaKickerId].goodKick++;
            newStats[currentFifaKickerId].fifaSuccess++;
          } else if (fifaAction === 'Bad Kick') {
            newStats[currentFifaKickerId].badKick++;
          }

          const isFifaSaveConditionMet =
            badThrowOptions.includes(throwResult) &&
            (fifaAction === 'Good Kick' || fifaAction === 'Bad Kick') &&
            goodDefenseOptions.includes(defenseResult!) &&
            (defendingPlayerId !== 'N/A');

          if (isFifaSaveConditionMet) {
              if (typeof defendingPlayerId === 'number') {
                  newStats[defendingPlayerId].score += 1;
              } else if (defendingPlayerId === 'TEAM') {
                  getPlayersOnTeam(opponentTeamId).forEach(pId => newStats[pId].score += 0.5);
              }
          }
      }

      return newStats;
    });

    if (throwResult !== 'Self Sink') {
        setThrowingPlayerId(null);
        setThrowResult(null);
        setDefendingPlayerId(null);
        setDefenseResult(null);
        setFifaKickerId(null);
        setFifaAction(null);
        setRedemptionAction(null);
    }

    setTimeout(() => checkWinCondition(), 0);

  }, [
    throwingPlayerId, throwResult, defendingPlayerId, defenseResult,
    fifaKickerId, fifaAction, redemptionAction, playerStats, teamPenalties,
    currentScoreMap, getPlayerTeamId, getOpponentTeamId, getPlayersOnTeam,
    matchFinished, matchStartTime, team1Score, team2Score, isOvertime,
    checkWinCondition, playerNames
  ]);


  // --- Match Management ---
  const handleStartMatch = () => {
    if (!matchStartTime) {
      setStartMatchMessage('Ready to start the match?');
      setShowStartMatchPopup(true);
    }
  };

  const proceedToStartMatch = () => {
    setMatchStartTime(Date.now());
    setPlayerStats(getInitialPlayerStats());
    setTeamPenalties(getInitialTeamPenalties());
    setMatchFinished(false);
    setWinnerTeam(null);
    setShowStartMatchPopup(false);
    setErrorMessage('');
  };

  const handleFinishMatch = () => {
    Alert.alert(
      'Finish Match',
      'Are you sure you want to finish the current match?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => {
            setMatchFinished(true);
            setErrorMessage('Match finished. Review stats or start a new game.');
            setTimeout(() => checkWinCondition(), 0);
          }
        },
      ]
    );
  };

  const handleNewGame = () => {
    Alert.alert(
      'New Game',
      'Are you sure you want to start a new game? This will reset all match statistics.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: () => {
            setMatchStartTime(null);
            setPlayerStats(getInitialPlayerStats());
            setTeamPenalties(getInitialTeamPenalties());
            setMatchFinished(false);
            setWinnerTeam(null);
            setThrowingPlayerId(null);
            setThrowResult(null);
            setDefendingPlayerId(null);
            setDefenseResult(null);
            setFifaKickerId(null);
            setFifaAction(null);
            setRedemptionAction(null);
            setErrorMessage('');
            Alert.alert('New Game Started', 'All stats have been reset.');
          }
        },
      ]
    );
  };

  const getPlayerRawRating = (player: PlayerStats) => {
    const hitRate = player.throws > 0 ? player.hits / player.throws : 0;
    const catchAttempts = player.catches + player.blunders;
    const catchRate = catchAttempts > 0 ? player.catches / catchAttempts : 0;
    const averageRate = (hitRate + catchRate) / 2;
    const fifaRate = player.fifaAttempts > 0 ? player.fifaSuccess / player.fifaAttempts : 0;

    return ((0.85 * averageRate) + (0.10 * fifaRate)) * 100 / (0.85 + 0.10);
  };

  const getAwards = (player: PlayerStats, allPlayersStats: AllPlayerStats) => {
    const awards = [];
    const playerRawRating = getPlayerRawRating(player);

    const allRawRatings = Object.values(allPlayersStats).map(p => getPlayerRawRating(p));
    const maxRawRating = Math.max(...allRawRatings);
    if (playerRawRating === maxRawRating && allRawRatings.filter(r => r === maxRawRating).length === 1) {
      awards.push('LeKing');
    }

    if (player.throws > 0 && (player.onFireCount / player.throws) > 0.70) {
      awards.push('Incineroar');
    }
    if (player.goals >= 2) {
      awards.push('Wayne Gretzky');
    }
    if (player.throws > 0 && (player.hits / player.throws) >= 0.80) {
      awards.push('Isaac Newton');
    }
    if (player.throws > 0 && (player.specialThrows / player.throws) > 0.15) {
      awards.push('Yusuf Dikeç');
    }
    if (player.fifaAttempts > 0 && (player.fifaSuccess / player.fifaAttempts) >= 0.70) {
      awards.push('Ronaldo');
    }
    if ((player.catches + player.blunders) > 0 && player.catches / (player.catches + player.blunders) >= 0.80) {
      awards.push('Iron Dome');
    }
    if (player.throws > 0 && (player.lineThrows / player.throws) > 0.15) {
      awards.push('Border Patrol');
    }
    if (player.aura >= 7.5) {
      awards.push('Dennis Rodman');
    }
    return awards;
  };

  // --- Render Functions ---
  const renderPlayerInputs = (
    playerIds: PlayerId[],
    selectedId: DefendingPlayerOption | null,
    onSelect: (id: PlayerId | 'TEAM' | 'N/A' | null) => void
  ) => (
    <View style={styles.playerButtonRow}>
      {playerIds.map(id => (
        <TouchableOpacity
          key={id}
          style={[
            styles.playerButton,
            selectedId === id && styles.playerButtonSelected,
            matchFinished && styles.buttonDisabled
          ]}
          onPress={() => onSelect(id)}
          disabled={matchFinished}
        >
          <ThemedText style={styles.playerButtonText}>{playerNames[id]}</ThemedText>
        </TouchableOpacity>
      ))}
      </View>
  );

  const renderOptionButtons = (
    options: string[],
    selectedOption: string | null,
    onSelect: (option: string) => void
  ) => (
    <View style={styles.optionButtonRow}>
      {options.map(option => (
        <TouchableOpacity
          key={option}
          style={[
            styles.optionButton,
            selectedOption === option && styles.optionButtonSelected,
            matchFinished && styles.buttonDisabled
          ]}
          onPress={() => onSelect(option)}
          disabled={matchFinished}
        >
          <ThemedText style={styles.optionButtonText}>{option}</ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTeamHitPercentages = (teamId: TeamId) => {
    const players = getPlayersOnTeam(teamId);
    const totalTeamThrows = players.reduce((sum, pId) => sum + playerStats[pId].throws, 0);
    const totalTeamHits = players.reduce((sum, pId) => sum + playerStats[pId].hits, 0);
    const hitPercentage = totalTeamThrows > 0 ? ((totalTeamHits / totalTeamThrows) * 100).toFixed(1) : '0.0';

    return (
      <ThemedView style={styles.teamStatsBox}>
        <ThemedText type="subtitle" style={styles.teamStatsTitle}>
          {teamNames[teamId]}
        </ThemedText>
        <ThemedText style={styles.teamScoreText}>
          {teamId === 1 ? team1Score : team2Score}
        </ThemedText>
        <ThemedText>Hits: {totalTeamHits}/{totalTeamThrows} ({hitPercentage}%)</ThemedText>
        {players.map(pId => (
          <ThemedText key={pId} style={styles.individualPlayerStats}>
            {playerNames[pId]}: {playerStats[pId].hits}/{playerStats[pId].throws} ({
              playerStats[pId].throws > 0 ? ((playerStats[pId].hits / playerStats[pId].throws) * 100).toFixed(0) : '0'
            }%)
            {playerStats[pId].currentlyOnFire && ' 🔥'}
          </ThemedText>
        ))}
        {matchFinished && winnerTeam === teamId && (
          <ThemedText style={styles.winnerOverlay}>Winner!</ThemedText>
        )}
      </ThemedView>
    );
  };

  const renderFormattedStats = () => (
    <ScrollView style={styles.formattedStatsScroll}>
      <View style={styles.formattedStatsTable}>
        <View style={styles.tableRow}>
          <ThemedText style={styles.tableHeader}>Player</ThemedText>
          <ThemedText style={styles.tableHeader}>Throws</ThemedText>
          <ThemedText style={styles.tableHeader}>Hits</ThemedText>
          <ThemedText style={styles.tableHeader}>Blunders</ThemedText>
          <ThemedText style={styles.tableHeader}>Catches</ThemedText>
          <ThemedText style={styles.tableHeader}>Score</ThemedText>
          <ThemedText style={styles.tableHeader}>Aura</ThemedText>
          <ThemedText style={styles.tableHeader}>FIFA Att</ThemedText>
          <ThemedText style={styles.tableHeader}>FIFA Suc</ThemedText>
          <ThemedText style={styles.tableHeader}>Hit %</ThemedText>
          <ThemedText style={styles.tableHeader}>Catch %</ThemedText>
          <ThemedText style={styles.tableHeader}>Rating</ThemedText>
          <ThemedText style={styles.tableHeader}>Awards</ThemedText>
        </View>
        {Object.keys(playerStats).map(playerId => {
          const id = Number(playerId) as PlayerId;
          const player = playerStats[id];
          if (!player.name || player.name.trim() === `Player${id}`) return null;

          const hitPct = player.throws > 0 ? ((player.hits / player.throws) * 100).toFixed(1) : '0.0';
          const catchAttempts = player.catches + player.blunders;
          const catchPct = catchAttempts > 0 ? ((player.catches / catchAttempts) * 100).toFixed(1) : '0.0';
          const rawRating = getPlayerRawRating(player);
          const awards = getAwards(player, playerStats);
          const finalRating = (rawRating + awards.length).toFixed(1);

          return (
            <View key={id} style={styles.tableRow}>
              <ThemedText style={styles.tableCell}>{player.name}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.throws}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.hits}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.blunders}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.catches}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.score}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.aura}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.fifaAttempts}</ThemedText>
              <ThemedText style={styles.tableCell}>{player.fifaSuccess}</ThemedText>
              <ThemedText style={styles.tableCell}>{hitPct}%</ThemedText>
              <ThemedText style={styles.tableCell}>{catchPct}%</ThemedText>
              <ThemedText style={styles.tableCell}>{finalRating}%</ThemedText>
              <ThemedText style={styles.tableCell}>{awards.join(', ')}</ThemedText>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#E9E9E9', dark: '#222' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.section}>
        <ThemedText type="title">Die Stats Tracker</ThemedText>
        <ThemedText type="subtitle">{matchTitle} at {arena}</ThemedText>
        <ThemedText>Room Code: <ThemedText type="defaultSemiBold">{roomCode}</ThemedText></ThemedText>
        <ThemedText>First to {gameScoreLimit} {winByTwo ? '(Win by Two)' : ''}</ThemedText>
        <ThemedText>Elapsed: {formatElapsedTime()}</ThemedText>
      </ThemedView>

      {/* Scoreboard Display */}
      <ThemedView style={styles.scoreboard}>
        <ThemedView style={[styles.teamScoreboard, team1Leading && styles.winningTeam, winnerTeam === 1 && styles.finalWinner]}>
          {renderTeamHitPercentages(1)}
        </ThemedView>
        <ThemedView style={styles.centerScoreboardInfo}>
          <ThemedText type="title" style={styles.scoreText}>
            {team1Score} - {team2Score}
          </ThemedText>
          {isOvertime && <ThemedText style={styles.overtimeText}>OVERTIME!</ThemedText>}
          {isTied && !isOvertime && <ThemedText style={styles.tiedText}>TIED</ThemedText>}
          {team1MatchPoint && <ThemedText style={styles.matchPointText}>Team 1 Match Point!</ThemedText>}
          {team2MatchPoint && <ThemedText style={styles.matchPointText}>Team 2 Match Point!</ThemedText>}
        </ThemedView>
        <ThemedView style={[styles.teamScoreboard, team2Leading && styles.winningTeam, winnerTeam === 2 && styles.finalWinner]}>
          {renderTeamHitPercentages(2)}
        </ThemedView>
      </ThemedView>

      {errorMessage ? (
        <ThemedText style={styles.errorMessage}>{errorMessage}</ThemedText>
      ) : null}

      {/* Play Input Section */}
      {!matchFinished && (
        <ThemedView style={styles.playInputContainer}>
          <ThemedText type="subtitle" style={styles.sectionHeading}>Attacking Player</ThemedText>
          {renderPlayerInputs([1, 2, 3, 4], throwingPlayerId, setThrowingPlayerId as (id: PlayerId | 'TEAM' | 'N/A' | null) => void)}

          <ThemedText type="subtitle" style={styles.sectionHeading}>Throw Result</ThemedText>
          {renderOptionButtons(
            ['Table Die', 'Line', 'Hit', 'Knicker', 'Goal', 'Dink', 'Sink'],
            throwResult,
            setThrowResult
          )}
          <ThemedView style={{marginTop: 10}}>
            {renderOptionButtons(
              ['Short', 'Long', 'Side', 'Height', 'Self Sink'],
              throwResult,
              setThrowResult
            )}
          </ThemedView>

          <ThemedText type="subtitle" style={styles.sectionHeading}>Defending Player</ThemedText>
          {renderPlayerInputs([1, 2, 3, 4], defendingPlayerId, setDefendingPlayerId as (id: PlayerId | 'TEAM' | 'N/A' | null) => void)}
          <ThemedView style={styles.playerButtonRow}>
            <TouchableOpacity
              style={[styles.playerButton, defendingPlayerId === 'TEAM' && styles.playerButtonSelected]}
              onPress={() => setDefendingPlayerId('TEAM')}
              disabled={matchFinished}
            ><ThemedText style={styles.playerButtonText}>TEAM</ThemedText></TouchableOpacity>
            <TouchableOpacity
              style={[styles.playerButton, defendingPlayerId === 'N/A' && styles.playerButtonSelected]}
              onPress={() => setDefendingPlayerId('N/A')}
              disabled={matchFinished}
            ><ThemedText style={styles.playerButtonText}>N/A</ThemedText></TouchableOpacity>
          </ThemedView>


          <ThemedText type="subtitle" style={styles.sectionHeading}>Defense Result</ThemedText>
          {renderOptionButtons(
            ['Catch + Aura', 'Catch', 'Drop', 'Miss', '2hands', 'Body', 'N/A'],
            defenseResult,
            setDefenseResult
          )}

          {/* FIFA Section */}
          <TouchableOpacity style={styles.toggleButton} onPress={() => setShowFIFA(!showFIFA)}>
            <ThemedText style={styles.toggleButtonText}>
              {showFIFA ? 'Hide' : 'Show'} FIFA Options
            </ThemedText>
          </TouchableOpacity>
          {showFIFA && (
            <ThemedView style={styles.subSection}>
              <ThemedText type="subtitle" style={styles.sectionHeading}>FIFA Kicker</ThemedText>
              {renderPlayerInputs([1, 2, 3, 4], fifaKickerId, setFifaKickerId as (id: PlayerId | 'TEAM' | 'N/A' | null) => void)}
              <ThemedText type="subtitle" style={styles.sectionHeading}>FIFA Action</ThemedText>
              {renderOptionButtons(['Good Kick', 'Bad Kick'], fifaAction, setFifaAction)}
            </ThemedView>
          )}

          {/* Redemption Section */}
          <TouchableOpacity style={styles.toggleButton} onPress={() => setShowRedemption(!showRedemption)}>
            <ThemedText style={styles.toggleButtonText}>
              {showRedemption ? 'Hide' : 'Show'} Redemption Options
            </ThemedText>
          </TouchableOpacity>
          {showRedemption && (
            <ThemedView style={styles.subSection}>
              <ThemedText type="subtitle" style={styles.sectionHeading}>Redemption Action</ThemedText>
              {renderOptionButtons(['Success', 'Failed'], redemptionAction, setRedemptionAction)}
            </ThemedView>
          )}

          <TouchableOpacity
            style={[styles.submitButton, matchFinished && styles.buttonDisabled]}
            onPress={handleSubmitPlay}
            disabled={matchFinished}
          >
            <ThemedText style={styles.buttonText}>Submit Play</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {/* Match Management Buttons */}
      <ThemedView style={styles.managementButtons}>
        {!matchStartTime && (
            <TouchableOpacity style={styles.actionButton} onPress={handleStartMatch}>
                <ThemedText style={styles.buttonText}>Start Match</ThemedText>
            </TouchableOpacity>
        )}
        {matchStartTime && !matchFinished && (
            <TouchableOpacity style={styles.actionButton} onPress={handleFinishMatch}>
                <ThemedText style={styles.buttonText}>Finish Match</ThemedText>
            </TouchableOpacity>
        )}
        {matchFinished && (
            <TouchableOpacity style={styles.actionButton} onPress={handleNewGame}>
                <ThemedText style={styles.buttonText}>New Game</ThemedText>
            </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowMatchStats(!showMatchStats)}>
          <ThemedText style={styles.buttonText}>{showMatchStats ? 'Hide' : 'Show'} Match Stats</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Match Stats Display */}
      {showMatchStats && (
        <ThemedView style={styles.section}>
          <ThemedText type="title">Match Statistics</ThemedText>
          {renderFormattedStats()}
        </ThemedView>
      )}

      {/* Setup Section Toggle */}
      <TouchableOpacity style={styles.toggleButton} onPress={() => setShowMatchSetup(!showMatchSetup)}>
        <ThemedText style={styles.toggleButtonText}>{showMatchSetup ? 'Hide' : 'Show'} Match Setup</ThemedText>
      </TouchableOpacity>

      {/* Match Setup Section */}
      {showMatchSetup && (
        <ThemedView style={styles.section}>
          <ThemedText type="title">Match Setup</ThemedText>

          <ThemedText type="subtitle" style={styles.sectionHeading}>Player and Team Names</ThemedText>
          {[1, 2, 3, 4].map(id => (
            <TextInput
              key={`player-${id}`}
              style={styles.textInput}
              onChangeText={(text) => setPlayerNames(p => ({ ...p, [id as PlayerId]: sanitizeInput(text) }))}
              value={playerNames[id as PlayerId]}
              placeholder={`Player ${id} Name`}
            />
          ))}
          {[1, 2].map(id => (
            <TextInput
              key={`team-${id}`}
              style={styles.textInput}
              onChangeText={(text) => setTeamNames(t => ({ ...t, [id as TeamId]: sanitizeInput(text) }))}
              value={teamNames[id as TeamId]}
              placeholder={`Team ${id} Name`}
            />
          ))}

          <ThemedText type="subtitle" style={styles.sectionHeading}>Match Title & Arena</ThemedText>
          <TextInput
            style={styles.textInput}
            onChangeText={(text) => setMatchTitle(sanitizeInput(text))}
            value={matchTitle}
            placeholder="Match Title"
          />
          <TextInput
            style={styles.textInput}
            onChangeText={(text) => setArena(sanitizeInput(text))}
            value={arena}
            placeholder="Arena Name"
          />

          <TouchableOpacity style={styles.toggleButton} onPress={() => setShowGameOptions(!showGameOptions)}>
            <ThemedText style={styles.toggleButtonText}>{showGameOptions ? 'Hide' : 'Show'} Game Rules</ThemedText>
          </TouchableOpacity>

          {showGameOptions && (
            <ThemedView style={styles.subSection}>
              <ThemedText type="subtitle" style={styles.sectionHeading}>Game Score Limit</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={gameScoreLimit}
                  onValueChange={(itemValue) => setGameScoreLimit(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="First to 7" value={7} />
                  <Picker.Item label="First to 11" value={11} />
                  <Picker.Item label="First to 15" value={15} />
                  <Picker.Item label="First to 21" value={21} />
                </Picker>
              </View>

              <ThemedText type="subtitle" style={styles.sectionHeading}>Points per Sink</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={sinkPoints}
                  onValueChange={(itemValue) => setSinkPoints(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="3 Points per Sink" value={3} />
                  <Picker.Item label="5 Points per Sink" value={5} />
                </Picker>
              </View>

              <ThemedText type="subtitle" style={styles.sectionHeading}>Win by Two</ThemedText>
              <View style={styles.optionButtonRow}>
                <TouchableOpacity
                  style={[styles.optionButton, winByTwo && styles.optionButtonSelected]}
                  onPress={() => setWinByTwo(true)}
                >
                  <ThemedText style={styles.optionButtonText}>ON</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, !winByTwo && styles.optionButtonSelected]}
                  onPress={() => setWinByTwo(false)}
                >
                  <ThemedText style={styles.optionButtonText}>OFF</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}
        </ThemedView>
      )}

      {/* Generic Popups (for Self Sink and Start Match Confirmation) */}
      {showStartMatchPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContent}>
            <ThemedText type="title" style={styles.popupTitle}>Start Match</ThemedText>
            <ThemedText style={styles.popupText}>{startMatchMessage}</ThemedText>
            <TouchableOpacity style={styles.popupConfirmButton} onPress={proceedToStartMatch}>
              <ThemedText style={styles.buttonText}>Confirm & Start Match</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupCancelButton} onPress={() => setShowStartMatchPopup(false)}>
              <ThemedText style={styles.popupCancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </ParallaxScrollView>
  );
}

// Define a comprehensive interface for the StyleSheet styles
interface ComponentStyles {
  text_default: TextStyle;
  text_title: TextStyle;
  text_defaultSemiBold: TextStyle;
  text_subtitle: TextStyle;
  parallaxScroll: ViewStyle;
  parallaxHeader: ViewStyle;
  parallaxContent: ViewStyle;
  headerImage: ImageStyle;
  section: ViewStyle;
  sectionHeading: TextStyle;
  scoreboard: ViewStyle;
  teamScoreboard: ViewStyle;
  winningTeam: ViewStyle;
  finalWinner: ViewStyle;
  centerScoreboardInfo: ViewStyle;
  scoreText: TextStyle;
  overtimeText: TextStyle;
  tiedText: TextStyle;
  matchPointText: TextStyle;
  teamStatsBox: ViewStyle;
  teamStatsTitle: TextStyle;
  teamScoreText: TextStyle;
  individualPlayerStats: TextStyle;
  errorMessage: TextStyle;
  playInputContainer: ViewStyle;
  playerButtonRow: ViewStyle;
  playerButton: ViewStyle;
  playerButtonSelected: ViewStyle;
  playerButtonText: TextStyle;
  optionButtonRow: ViewStyle;
  optionButton: ViewStyle;
  optionButtonSelected: ViewStyle;
  optionButtonText: TextStyle;
  submitButton: ViewStyle;
  buttonText: TextStyle;
  buttonDisabled: ViewStyle;
  toggleButton: ViewStyle;
  toggleButtonText: TextStyle;
  subSection: ViewStyle;
  textInput: TextStyle;
  pickerContainer: ViewStyle;
  picker: TextStyle; // Corrected: Picker style must be TextStyle
  managementButtons: ViewStyle;
  actionButton: ViewStyle;
  formattedStatsScroll: ViewStyle;
  formattedStatsTable: ViewStyle;
  tableRow: ViewStyle;
  tableHeader: TextStyle;
  tableCell: TextStyle;
  popupOverlay: ViewStyle;
  popupContent: ViewStyle;
  popupTitle: TextStyle;
  popupText: TextStyle;
  popupConfirmButton: ViewStyle;
  popupCancelButton: ViewStyle;
  popupCancelText: TextStyle;
  winnerOverlay: TextStyle;
}

const styles = StyleSheet.create<ComponentStyles>({
  text_default: { fontSize: 16, color: '#333' },
  text_title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  text_defaultSemiBold: { fontSize: 16, fontWeight: '600', color: '#333' },
  text_subtitle: { fontSize: 20, fontWeight: 'bold', color: '#555', marginBottom: 5, marginTop: 10 },

  parallaxScroll: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  parallaxHeader: {
    height: 250,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  parallaxContent: {
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  headerImage: {
    height: 250,
    width:  '100%' as unknown as number, // workaround for TS, but better to use a number
    resizeMode: 'contain' as 'contain',
  },

  section: {
    marginBottom: 30,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    alignSelf: 'center',
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  teamScoreboard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  winningTeam: {
    borderColor: '#007bff',
  },
  finalWinner: {
    backgroundColor: '#FFD700',
    borderColor: '#DAA520',
  },
  centerScoreboardInfo: {
    flex: 0.8,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  overtimeText: {
    color: 'tomato',
    fontWeight: 'bold',
    fontSize: 20,
  },
  tiedText: {
    color: 'orange',
    fontWeight: 'bold',
    fontSize: 20,
  },
  matchPointText: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 16,
  },
  teamStatsBox: {
    alignItems: 'center',
  },
  teamStatsTitle: {
    fontSize: 18,
    marginBottom: 5,
  },
  teamScoreText: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  individualPlayerStats: {
    fontSize: 14,
    color: '#666',
  },
  errorMessage: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 16,
  },
  playInputContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 20,
  },
  playerButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  playerButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    margin: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  playerButtonSelected: {
    backgroundColor: '#007bff',
  },
  playerButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  optionButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    margin: 4,
    minWidth: 90,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#28a745',
  },
  optionButtonText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  toggleButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subSection: {
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  textInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333',
    fontSize: 16,
  },
  managementButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#17a2b8',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  formattedStatsScroll: {
    maxHeight: 400,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  formattedStatsTable: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
  },
  tableHeader: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
    paddingHorizontal: 2,
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
    color: '#555',
    paddingHorizontal: 2,
  },
  popupOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  popupContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 25,
    alignItems: 'center',
    width: '80%',
    maxWidth: 400,
  },
  popupTitle: {
    marginBottom: 15,
    color: '#333',
  },
  popupText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  popupConfirmButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    width: '90%',
    alignItems: 'center',
    marginBottom: 10,
  },
  popupCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  popupCancelText: {
    color: '#666',
    fontSize: 14,
  },
  winnerOverlay: {
    color: 'gold',
    fontWeight: 'bold',
    fontSize: 20,
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5,
    borderRadius: 5,
  },
});
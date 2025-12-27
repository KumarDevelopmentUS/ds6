// utils/playerRelationshipStats.ts
// Utilities for calculating head-to-head and teammate statistics

import { supabase } from '../supabase';

export interface PlayerRelationship {
  odId: string; // odId might be a real user ID or a hash of the player name
  name: string;
  isRegisteredUser: boolean;
  avatarIcon?: string;
  avatarIconColor?: string;
  avatarBackgroundColor?: string;
}

export interface HeadToHeadStats {
  opponent: PlayerRelationship;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  // Detailed stats
  totalPointsScored: number;
  totalPointsConceded: number;
  avgPointsScored: number;
  avgPointsConceded: number;
  lastPlayedDate: string | null;
  currentStreak: number; // positive = win streak, negative = loss streak
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface TeammateStats {
  teammate: PlayerRelationship;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  // Synergy stats
  combinedScore: number;
  avgCombinedScore: number;
  lastPlayedDate: string | null;
  currentStreak: number;
  longestWinStreak: number;
}

export interface PerformanceTrend {
  date: string;
  matchId: string;
  result: 'W' | 'L' | 'D';
  cumulativeWins: number;
  cumulativeMatches: number;
  winRate: number;
  score: number;
  opponentScore: number;
}

export interface PersonalRecords {
  highestScore: { value: number; matchId: string; date: string } | null;
  longestWinStreak: { value: number; startDate: string; endDate: string } | null;
  mostSinksInMatch: { value: number; matchId: string; date: string } | null;
  mostGoalsInMatch: { value: number; matchId: string; date: string } | null;
  bestHitRateMatch: { value: number; matchId: string; date: string } | null;
  bestCatchRateMatch: { value: number; matchId: string; date: string } | null;
  fastestWin: { durationSeconds: number; matchId: string; date: string } | null;
}

export interface StreakInfo {
  currentStreak: number; // positive = wins, negative = losses
  currentStreakType: 'win' | 'loss' | 'none';
  longestWinStreak: number;
  longestLossStreak: number;
}

/**
 * Get the user's team number from a match
 */
const getUserTeam = (match: any, odId: string): number | null => {
  for (const [slot, id] of Object.entries(match.userSlotMap || {})) {
    if (id === odId) {
      const playerSlot = parseInt(slot);
      return playerSlot <= 2 ? 1 : 2;
    }
  }
  return null;
};

/**
 * Get the user's slot number from a match
 */
const getUserSlot = (match: any, odId: string): number | null => {
  for (const [slot, id] of Object.entries(match.userSlotMap || {})) {
    if (id === odId) {
      return parseInt(slot);
    }
  }
  return null;
};

/**
 * Generate a unique identifier for a player (registered user ID or hashed name)
 */
const getPlayerIdentifier = (slot: number, match: any): string => {
  // Check if this slot has a registered user
  const userId = match.userSlotMap?.[slot];
  if (userId) {
    return userId;
  }
  // For guest players, use a hash of their name
  const playerName = match.matchSetup?.playerNames?.[slot - 1] || `Player ${slot}`;
  return `guest_${playerName.toLowerCase().replace(/\s+/g, '_')}`;
};

/**
 * Calculate head-to-head statistics against all opponents
 */
export const calculateHeadToHeadStats = async (userId: string): Promise<HeadToHeadStats[]> => {
  try {
    // Get all matches where user was a player
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    // Filter to matches where user participated
    const matches = (allMatches || []).filter(match => {
      const userSlot = getUserSlot(match, userId);
      return userSlot !== null;
    });

    if (matches.length === 0) return [];

    // Track stats per opponent
    const opponentStats: Map<string, {
      name: string;
      isRegisteredUser: boolean;
      odId: string;
      matchHistory: Array<{ date: string; matchId: string; userWon: boolean; userScore: number; opponentScore: number }>;
    }> = new Map();

    matches.forEach(match => {
      const userTeam = getUserTeam(match, userId);
      const userSlot = getUserSlot(match, userId);
      if (!userTeam || userSlot === null) return;

      // Determine match result
      const userWon = match.winnerTeam === userTeam;
      const isDraw = match.winnerTeam === 0 || match.winnerTeam === null;

      // Calculate team scores
      let userTeamScore = 0;
      let opponentTeamScore = 0;
      
      for (let i = 1; i <= 4; i++) {
        const playerTeam = i <= 2 ? 1 : 2;
        const playerScore = match.playerStats?.[i]?.score || 0;
        if (playerTeam === userTeam) {
          userTeamScore += playerScore;
        } else {
          opponentTeamScore += playerScore;
        }
      }

      // Track each opponent
      for (let i = 1; i <= 4; i++) {
        const playerTeam = i <= 2 ? 1 : 2;
        if (playerTeam === userTeam) continue; // Skip teammates

        const opponentId = getPlayerIdentifier(i, match);
        const opponentName = match.matchSetup?.playerNames?.[i - 1] || `Player ${i}`;
        const isRegistered = !!match.userSlotMap?.[i];

        if (!opponentStats.has(opponentId)) {
          opponentStats.set(opponentId, {
            name: opponentName,
            isRegisteredUser: isRegistered,
            odId: opponentId,
            matchHistory: [],
          });
        }

        opponentStats.get(opponentId)!.matchHistory.push({
          date: match.createdAt || match.matchStartTime,
          matchId: match.id,
          userWon: !isDraw && userWon,
          userScore: userTeamScore,
          opponentScore: opponentTeamScore,
        });
      }
    });

    // Fetch user profiles for registered users
    const registeredIds = Array.from(opponentStats.values())
      .filter(o => o.isRegisteredUser)
      .map(o => o.odId);

    let userProfiles: Map<string, any> = new Map();
    if (registeredIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, nickname, display_name, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', registeredIds);

      profiles?.forEach(p => userProfiles.set(p.id, p));
    }

    // Calculate final stats
    const results: HeadToHeadStats[] = [];

    opponentStats.forEach((data, odId) => {
      const history = data.matchHistory;
      if (history.length === 0) return;

      let wins = 0, losses = 0, draws = 0;
      let totalPointsScored = 0, totalPointsConceded = 0;
      let currentStreak = 0, longestWinStreak = 0, longestLossStreak = 0;
      let tempWinStreak = 0, tempLossStreak = 0;

      // Sort by date for streak calculation
      history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      history.forEach((game, idx) => {
        totalPointsScored += game.userScore;
        totalPointsConceded += game.opponentScore;

        if (game.userWon) {
          wins++;
          tempWinStreak++;
          tempLossStreak = 0;
          if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
        } else if (game.userScore === game.opponentScore) {
          draws++;
          tempWinStreak = 0;
          tempLossStreak = 0;
        } else {
          losses++;
          tempLossStreak++;
          tempWinStreak = 0;
          if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
        }

        // Current streak (at the end of loop)
        if (idx === history.length - 1) {
          currentStreak = tempWinStreak > 0 ? tempWinStreak : -tempLossStreak;
        }
      });

      const profile = userProfiles.get(odId);
      const matchesPlayed = wins + losses + draws;

      results.push({
        opponent: {
          odId,
          name: profile?.nickname || profile?.display_name || profile?.username || data.name,
          isRegisteredUser: data.isRegisteredUser,
          avatarIcon: profile?.avatar_icon,
          avatarIconColor: profile?.avatar_icon_color,
          avatarBackgroundColor: profile?.avatar_background_color,
        },
        matchesPlayed,
        wins,
        losses,
        draws,
        winRate: matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0,
        totalPointsScored,
        totalPointsConceded,
        avgPointsScored: matchesPlayed > 0 ? totalPointsScored / matchesPlayed : 0,
        avgPointsConceded: matchesPlayed > 0 ? totalPointsConceded / matchesPlayed : 0,
        lastPlayedDate: history[history.length - 1]?.date || null,
        currentStreak,
        longestWinStreak,
        longestLossStreak,
      });
    });

    // Sort by matches played (most frequent opponents first)
    return results.sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  } catch (error) {
    console.error('Error calculating head-to-head stats:', error);
    return [];
  }
};

/**
 * Calculate teammate statistics
 */
export const calculateTeammateStats = async (userId: string): Promise<TeammateStats[]> => {
  try {
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    const matches = (allMatches || []).filter(match => {
      const userSlot = getUserSlot(match, userId);
      return userSlot !== null;
    });

    if (matches.length === 0) return [];

    // Track stats per teammate
    const teammateStats: Map<string, {
      name: string;
      isRegisteredUser: boolean;
      odId: string;
      matchHistory: Array<{ date: string; matchId: string; won: boolean; combinedScore: number }>;
    }> = new Map();

    matches.forEach(match => {
      const userTeam = getUserTeam(match, userId);
      const userSlot = getUserSlot(match, userId);
      if (!userTeam || userSlot === null) return;

      const won = match.winnerTeam === userTeam;
      const isDraw = match.winnerTeam === 0 || match.winnerTeam === null;

      // Find teammate
      for (let i = 1; i <= 4; i++) {
        if (i === userSlot) continue;
        const playerTeam = i <= 2 ? 1 : 2;
        if (playerTeam !== userTeam) continue; // Skip opponents

        const teammateId = getPlayerIdentifier(i, match);
        const teammateName = match.matchSetup?.playerNames?.[i - 1] || `Player ${i}`;
        const isRegistered = !!match.userSlotMap?.[i];

        // Calculate combined score
        const userScore = match.playerStats?.[userSlot]?.score || 0;
        const teammateScore = match.playerStats?.[i]?.score || 0;
        const combinedScore = userScore + teammateScore;

        if (!teammateStats.has(teammateId)) {
          teammateStats.set(teammateId, {
            name: teammateName,
            isRegisteredUser: isRegistered,
            odId: teammateId,
            matchHistory: [],
          });
        }

        teammateStats.get(teammateId)!.matchHistory.push({
          date: match.createdAt || match.matchStartTime,
          matchId: match.id,
          won: !isDraw && won,
          combinedScore,
        });
      }
    });

    // Fetch user profiles
    const registeredIds = Array.from(teammateStats.values())
      .filter(t => t.isRegisteredUser)
      .map(t => t.odId);

    let userProfiles: Map<string, any> = new Map();
    if (registeredIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, nickname, display_name, avatar_icon, avatar_icon_color, avatar_background_color')
        .in('id', registeredIds);

      profiles?.forEach(p => userProfiles.set(p.id, p));
    }

    // Calculate final stats
    const results: TeammateStats[] = [];

    teammateStats.forEach((data, odId) => {
      const history = data.matchHistory;
      if (history.length === 0) return;

      let wins = 0, losses = 0, draws = 0;
      let totalCombinedScore = 0;
      let currentStreak = 0, longestWinStreak = 0;
      let tempWinStreak = 0;

      history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      history.forEach((game, idx) => {
        totalCombinedScore += game.combinedScore;

        if (game.won) {
          wins++;
          tempWinStreak++;
          if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
        } else {
          losses++;
          tempWinStreak = 0;
        }

        if (idx === history.length - 1) {
          currentStreak = tempWinStreak;
        }
      });

      const profile = userProfiles.get(odId);
      const matchesPlayed = wins + losses + draws;

      results.push({
        teammate: {
          odId,
          name: profile?.nickname || profile?.display_name || profile?.username || data.name,
          isRegisteredUser: data.isRegisteredUser,
          avatarIcon: profile?.avatar_icon,
          avatarIconColor: profile?.avatar_icon_color,
          avatarBackgroundColor: profile?.avatar_background_color,
        },
        matchesPlayed,
        wins,
        losses,
        draws,
        winRate: matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0,
        combinedScore: totalCombinedScore,
        avgCombinedScore: matchesPlayed > 0 ? totalCombinedScore / matchesPlayed : 0,
        lastPlayedDate: history[history.length - 1]?.date || null,
        currentStreak,
        longestWinStreak,
      });
    });

    return results.sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  } catch (error) {
    console.error('Error calculating teammate stats:', error);
    return [];
  }
};

/**
 * Calculate performance trends over time
 */
export const calculatePerformanceTrends = async (userId: string): Promise<PerformanceTrend[]> => {
  try {
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    const matches = (allMatches || []).filter(match => {
      const userSlot = getUserSlot(match, userId);
      return userSlot !== null;
    });

    if (matches.length === 0) return [];

    const trends: PerformanceTrend[] = [];
    let cumulativeWins = 0;

    matches.forEach((match, index) => {
      const userTeam = getUserTeam(match, userId);
      const userSlot = getUserSlot(match, userId);
      if (!userTeam || userSlot === null) return;

      const won = match.winnerTeam === userTeam;
      const isDraw = match.winnerTeam === 0 || match.winnerTeam === null;
      
      let result: 'W' | 'L' | 'D' = 'D';
      if (!isDraw) {
        result = won ? 'W' : 'L';
        if (won) cumulativeWins++;
      }

      // Calculate scores
      let userTeamScore = 0, opponentTeamScore = 0;
      for (let i = 1; i <= 4; i++) {
        const playerTeam = i <= 2 ? 1 : 2;
        const playerScore = match.playerStats?.[i]?.score || 0;
        if (playerTeam === userTeam) {
          userTeamScore += playerScore;
        } else {
          opponentTeamScore += playerScore;
        }
      }

      const cumulativeMatches = index + 1;

      trends.push({
        date: match.createdAt || match.matchStartTime,
        matchId: match.id,
        result,
        cumulativeWins,
        cumulativeMatches,
        winRate: (cumulativeWins / cumulativeMatches) * 100,
        score: userTeamScore,
        opponentScore: opponentTeamScore,
      });
    });

    return trends;
  } catch (error) {
    console.error('Error calculating performance trends:', error);
    return [];
  }
};

/**
 * Calculate current streak and streak records
 */
export const calculateStreakInfo = async (userId: string): Promise<StreakInfo> => {
  try {
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*')
      .order('createdAt', { ascending: false }); // Most recent first

    if (error) throw error;

    const matches = (allMatches || []).filter(match => {
      const userSlot = getUserSlot(match, userId);
      return userSlot !== null;
    });

    if (matches.length === 0) {
      return { currentStreak: 0, currentStreakType: 'none', longestWinStreak: 0, longestLossStreak: 0 };
    }

    let currentStreak = 0;
    let currentStreakType: 'win' | 'loss' | 'none' = 'none';
    let longestWinStreak = 0, longestLossStreak = 0;
    let tempWinStreak = 0, tempLossStreak = 0;
    let foundCurrentStreak = false;

    // Reverse to process oldest first for longest streak calculation
    const chronologicalMatches = [...matches].reverse();

    chronologicalMatches.forEach(match => {
      const userTeam = getUserTeam(match, userId);
      if (!userTeam) return;

      const won = match.winnerTeam === userTeam;
      const isDraw = match.winnerTeam === 0 || match.winnerTeam === null;

      if (!isDraw) {
        if (won) {
          tempWinStreak++;
          tempLossStreak = 0;
          if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
        } else {
          tempLossStreak++;
          tempWinStreak = 0;
          if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
        }
      }
    });

    // Calculate current streak from most recent matches
    for (const match of matches) {
      const userTeam = getUserTeam(match, userId);
      if (!userTeam) continue;

      const won = match.winnerTeam === userTeam;
      const isDraw = match.winnerTeam === 0 || match.winnerTeam === null;

      if (isDraw) continue;

      if (!foundCurrentStreak) {
        currentStreakType = won ? 'win' : 'loss';
        foundCurrentStreak = true;
      }

      if ((won && currentStreakType === 'win') || (!won && currentStreakType === 'loss')) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      currentStreak: currentStreakType === 'loss' ? -currentStreak : currentStreak,
      currentStreakType,
      longestWinStreak,
      longestLossStreak,
    };
  } catch (error) {
    console.error('Error calculating streak info:', error);
    return { currentStreak: 0, currentStreakType: 'none', longestWinStreak: 0, longestLossStreak: 0 };
  }
};

/**
 * Calculate personal records
 */
export const calculatePersonalRecords = async (userId: string): Promise<PersonalRecords> => {
  try {
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    const matches = (allMatches || []).filter(match => {
      const userSlot = getUserSlot(match, userId);
      return userSlot !== null;
    });

    const records: PersonalRecords = {
      highestScore: null,
      longestWinStreak: null,
      mostSinksInMatch: null,
      mostGoalsInMatch: null,
      bestHitRateMatch: null,
      bestCatchRateMatch: null,
      fastestWin: null,
    };

    if (matches.length === 0) return records;

    // Track win streaks for longest win streak record
    let currentWinStreak = 0;
    let winStreakStart: string | null = null;
    let longestWinStreakValue = 0;
    let longestWinStreakStart = '';
    let longestWinStreakEnd = '';

    matches.forEach(match => {
      const userSlot = getUserSlot(match, userId);
      const userTeam = getUserTeam(match, userId);
      if (userSlot === null || !userTeam) return;

      const playerStats = match.playerStats?.[userSlot];
      if (!playerStats) return;

      const matchDate = match.createdAt || match.matchStartTime;

      // Highest score
      const score = playerStats.score || 0;
      if (!records.highestScore || score > records.highestScore.value) {
        records.highestScore = { value: score, matchId: match.id, date: matchDate };
      }

      // Most sinks
      const sinks = playerStats.sink || 0;
      if (!records.mostSinksInMatch || sinks > records.mostSinksInMatch.value) {
        records.mostSinksInMatch = { value: sinks, matchId: match.id, date: matchDate };
      }

      // Most goals
      const goals = playerStats.goal || playerStats.goals || 0;
      if (!records.mostGoalsInMatch || goals > records.mostGoalsInMatch.value) {
        records.mostGoalsInMatch = { value: goals, matchId: match.id, date: matchDate };
      }

      // Best hit rate (minimum 5 throws)
      const throws = playerStats.throws || 0;
      const hits = playerStats.hits || playerStats.hit || 0;
      if (throws >= 5) {
        const hitRate = (hits / throws) * 100;
        if (!records.bestHitRateMatch || hitRate > records.bestHitRateMatch.value) {
          records.bestHitRateMatch = { value: Math.round(hitRate * 10) / 10, matchId: match.id, date: matchDate };
        }
      }

      // Best catch rate (minimum 5 attempts)
      const catches = playerStats.catches || 0;
      const misses = playerStats.miss || 0;
      const catchAttempts = catches + misses;
      if (catchAttempts >= 5) {
        const catchRate = (catches / catchAttempts) * 100;
        if (!records.bestCatchRateMatch || catchRate > records.bestCatchRateMatch.value) {
          records.bestCatchRateMatch = { value: Math.round(catchRate * 10) / 10, matchId: match.id, date: matchDate };
        }
      }

      // Fastest win
      const won = match.winnerTeam === userTeam;
      const duration = match.matchDuration || 0;
      if (won && duration > 0) {
        if (!records.fastestWin || duration < records.fastestWin.durationSeconds) {
          records.fastestWin = { durationSeconds: duration, matchId: match.id, date: matchDate };
        }
      }

      // Track win streak
      if (won) {
        if (currentWinStreak === 0) {
          winStreakStart = matchDate;
        }
        currentWinStreak++;
        if (currentWinStreak > longestWinStreakValue) {
          longestWinStreakValue = currentWinStreak;
          longestWinStreakStart = winStreakStart || matchDate;
          longestWinStreakEnd = matchDate;
        }
      } else {
        currentWinStreak = 0;
        winStreakStart = null;
      }
    });

    if (longestWinStreakValue > 0) {
      records.longestWinStreak = {
        value: longestWinStreakValue,
        startDate: longestWinStreakStart,
        endDate: longestWinStreakEnd,
      };
    }

    return records;
  } catch (error) {
    console.error('Error calculating personal records:', error);
    return {
      highestScore: null,
      longestWinStreak: null,
      mostSinksInMatch: null,
      mostGoalsInMatch: null,
      bestHitRateMatch: null,
      bestCatchRateMatch: null,
      fastestWin: null,
    };
  }
};


// utils/achievements.ts
// Shared achievement calculation utilities

import { supabase } from '../supabase';
import { Ionicons } from '@expo/vector-icons';

export type AchievementTier = 'None' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Master';

export const MEDAL_COLORS: Record<AchievementTier, string> = {
  None: '#6b7280',
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Diamond: '#0ea5e9',
  Master: '#DC2626',
};

export interface Achievement {
  id: string;
  title: string;
  statName: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tier: AchievementTier;
  currentValue: number;
  unlocked: boolean;
}

interface UserMatchStats {
  totalMatches: number;
  totalWins: number;
  winRate: number;
  totalThrows: number;
  totalHits: number;
  hitRate: number;
  totalCatches: number;
  totalCatchAttempts: number;
  catchRate: number;
  totalSinks: number;
  totalGoals: number;
  totalScore: number;
  totalOnFireCount: number;
  totalFifaSuccess: number;
  totalFifaAttempts: number;
  fifaRate: number;
  totalMatchDuration: number;
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
 * Calculate stats from matches for achievement calculation
 */
const calculateStatsFromMatches = (matches: any[], userId: string): UserMatchStats => {
  const stats: UserMatchStats = {
    totalMatches: 0,
    totalWins: 0,
    winRate: 0,
    totalThrows: 0,
    totalHits: 0,
    hitRate: 0,
    totalCatches: 0,
    totalCatchAttempts: 0,
    catchRate: 0,
    totalSinks: 0,
    totalGoals: 0,
    totalScore: 0,
    totalOnFireCount: 0,
    totalFifaSuccess: 0,
    totalFifaAttempts: 0,
    fifaRate: 0,
    totalMatchDuration: 0,
  };

  matches.forEach(match => {
    const userTeam = getUserTeam(match, userId);
    const userSlot = Object.entries(match.userSlotMap || {}).find(([_, id]) => id === userId)?.[0];
    
    if (!userTeam || !userSlot) return;

    stats.totalMatches++;

    if (match.winnerTeam === userTeam) {
      stats.totalWins++;
    }

    const playerStats = match.playerStats?.[parseInt(userSlot)];
    if (playerStats) {
      stats.totalThrows += playerStats.throws || 0;
      stats.totalHits += playerStats.hits || 0;
      stats.totalCatches += playerStats.catches || 0;
      stats.totalCatchAttempts += (playerStats.catches || 0) + (playerStats.miss || 0);
      stats.totalSinks += playerStats.sink || 0;
      stats.totalGoals += playerStats.goal || playerStats.goals || 0;
      stats.totalScore += playerStats.score || 0;
      stats.totalOnFireCount += playerStats.onFireCount || 0;
      stats.totalFifaSuccess += playerStats.fifaSuccess || 0;
      stats.totalFifaAttempts += playerStats.fifaAttempts || 0;
    }

    stats.totalMatchDuration += match.matchDuration || 0;
  });

  stats.winRate = stats.totalMatches > 0 ? (stats.totalWins / stats.totalMatches) * 100 : 0;
  stats.hitRate = stats.totalThrows > 0 ? (stats.totalHits / stats.totalThrows) * 100 : 0;
  stats.catchRate = stats.totalCatchAttempts > 0 ? (stats.totalCatches / stats.totalCatchAttempts) * 100 : 0;
  stats.fifaRate = stats.totalFifaAttempts > 0 ? (stats.totalFifaSuccess / stats.totalFifaAttempts) * 100 : 0;

  return stats;
};

/**
 * Get tier based on thresholds
 */
const getTierFromValue = (value: number, thresholds: number[]): AchievementTier => {
  const tiers: AchievementTier[] = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Master'];
  
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (value >= thresholds[i]) {
      return tiers[Math.min(i, tiers.length - 1)];
    }
  }
  return 'None';
};

/**
 * Get tier for rate-based achievements
 */
const getTierFromRate = (rate: number): AchievementTier => {
  if (rate >= 93.1) return 'Master';
  if (rate >= 86.1) return 'Diamond';
  if (rate >= 78.1) return 'Gold';
  if (rate >= 60.1) return 'Silver';
  if (rate >= 50.1) return 'Bronze';
  return 'None';
};

/**
 * Calculate achievements for a user
 */
export const calculateUserAchievements = async (userId: string): Promise<Achievement[]> => {
  try {
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*');

    if (error) throw error;

    // Filter matches where user participated
    const matches = (allMatches || []).filter(match => {
      const userSlot = Object.entries(match.userSlotMap || {}).find(
        ([_, id]) => id === userId
      );
      return userSlot !== undefined;
    });

    if (matches.length === 0) return [];

    const stats = calculateStatsFromMatches(matches, userId);

    // Define achievement tiers
    const matchTiers = [5, 10, 20, 40, 80];
    const winTiers = [5, 10, 20, 40, 80];
    const sinkTiers = [5, 10, 20, 40, 80];
    const goalTiers = [5, 10, 20, 40, 80];
    const onFireTiers = [5, 10, 20, 40, 80];

    const achievements: Achievement[] = [
      // First Victory
      {
        id: 'first_win',
        title: 'First Victory',
        statName: 'Total Wins',
        icon: 'trophy',
        color: MEDAL_COLORS.Bronze,
        tier: stats.totalWins > 0 ? 'Bronze' : 'None',
        currentValue: stats.totalWins > 0 ? 1 : 0,
        unlocked: stats.totalWins > 0,
      },
      // Veteran (matches played)
      {
        id: 'veteran',
        title: 'Veteran',
        statName: 'Matches Played',
        icon: 'medal',
        color: '#8b5cf6',
        tier: getTierFromValue(stats.totalMatches, matchTiers),
        currentValue: stats.totalMatches,
        unlocked: stats.totalMatches >= matchTiers[0],
      },
      // Champion (wins)
      {
        id: 'champion',
        title: 'True Champion',
        statName: 'Total Wins',
        icon: 'trophy',
        color: '#fbbf24',
        tier: getTierFromValue(stats.totalWins, winTiers),
        currentValue: stats.totalWins,
        unlocked: stats.totalWins >= winTiers[0],
      },
      // Sharpshooter (hit rate)
      {
        id: 'sharpshooter',
        title: 'Sharpshooter',
        statName: 'Hit Rate',
        icon: 'locate',
        color: '#ef4444',
        tier: stats.totalThrows >= 10 ? getTierFromRate(stats.hitRate) : 'None',
        currentValue: Math.round(stats.hitRate * 10) / 10,
        unlocked: stats.totalThrows >= 10 && stats.hitRate >= 50.1,
      },
      // Goalkeeper (catch rate)
      {
        id: 'goalkeeper',
        title: 'Goalkeeper',
        statName: 'Catch Rate',
        icon: 'hand-left',
        color: '#22c55e',
        tier: stats.totalCatchAttempts >= 10 ? getTierFromRate(stats.catchRate) : 'None',
        currentValue: Math.round(stats.catchRate * 10) / 10,
        unlocked: stats.totalCatchAttempts >= 10 && stats.catchRate >= 50.1,
      },
      // Sink Master
      {
        id: 'sink_master',
        title: 'Sink Master',
        statName: 'Total Sinks',
        icon: 'water',
        color: '#06b6d4',
        tier: getTierFromValue(stats.totalSinks, sinkTiers),
        currentValue: stats.totalSinks,
        unlocked: stats.totalSinks >= sinkTiers[0],
      },
      // Goal Machine
      {
        id: 'goal_machine',
        title: 'Goal Machine',
        statName: 'Total Goals',
        icon: 'football',
        color: '#3b82f6',
        tier: getTierFromValue(stats.totalGoals, goalTiers),
        currentValue: stats.totalGoals,
        unlocked: stats.totalGoals >= goalTiers[0],
      },
      // Hot Streak
      {
        id: 'hot_streak',
        title: 'Hot Streak',
        statName: 'Times On Fire',
        icon: 'flame',
        color: '#dc2626',
        tier: getTierFromValue(stats.totalOnFireCount, onFireTiers),
        currentValue: stats.totalOnFireCount,
        unlocked: stats.totalOnFireCount >= onFireTiers[0],
      },
    ];

    return achievements;
  } catch (error) {
    console.error('Error calculating achievements:', error);
    return [];
  }
};

/**
 * Get top unlocked achievements for display on profile
 */
export const getTopAchievements = async (userId: string, limit: number = 4): Promise<Achievement[]> => {
  const achievements = await calculateUserAchievements(userId);
  
  // Filter to only unlocked achievements and sort by tier (Master > Diamond > Gold > Silver > Bronze)
  const tierOrder: Record<AchievementTier, number> = {
    Master: 5,
    Diamond: 4,
    Gold: 3,
    Silver: 2,
    Bronze: 1,
    None: 0,
  };
  
  return achievements
    .filter(a => a.unlocked)
    .sort((a, b) => tierOrder[b.tier] - tierOrder[a.tier])
    .slice(0, limit);
};


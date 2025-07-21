// app/stats.tsx
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedButton } from '../components/themed/ThemedButton';
import { ThemedText } from '../components/themed/ThemedText';
import { ThemedView } from '../components/themed/ThemedView';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from './_layout';

interface OverallStats {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalThrows: number;
  totalHits: number;
  hitRate: number;
  totalCatches: number;
  totalCatchAttempts: number;
  catchRate: number;
  totalScore: number;
  avgScore: number;
  totalGoals: number;
  totalSinks: number;
  totalSpecialThrows: number;
  totalFifaSuccess: number;
  totalFifaAttempts: number;
  fifaRate: number;
  totalAura: number;
  longestStreak: number;
  totalOnFireCount: number;
  totalMatchDuration: number;
  avgMatchDuration: number;
  favoriteArena: string;
  nemesisPlayer: string;
  bestPartner: string;

  // New granular counters
  totalTableDie: number;
  totalLine: number;
  totalKnicker: number;
  totalDink: number;
  totalDrop: number;
  totalMiss: number;
  totalLong: number;
  totalCatchPlusAura: number;
  totalBody: number; // Added for body catches
  totalTwoHands: number; // Added for two hands catches
  totalMissedCatches: number; // Sum of drop, miss, twoHands, body
}

// Define achievement tiers
type AchievementTier = 'None' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Master';

// Define medal colors
const MEDAL_COLORS = {
  None: '#6b7280',    // Gray for no medal
  Bronze: '#CD7F32',  // Standard Bronze
  Silver: '#C0C0C0',  // Standard Silver
  Gold: '#FFD700',    // Standard Gold
  Diamond: '#0ea5e9', // Blue for Diamond
  Master: '#DC2626',  // Red for Master
};

interface AchievementData {
  id: string;
  title: string;
  statName: string; // New field to show what stat is being tracked
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string; // Base color for the icon, also used for progress bar if not Master
  
  // Progress related fields
  tier: AchievementTier;
  currentValue: number;
  nextTarget: number | string; // Can be a number or a descriptive string (e.g., "N/A")
  nextTier: AchievementTier | 'N/A';
  progressPercentage: number;
  totalMasterCount?: number;
  unlocked: boolean; // Retained for explicit check if needed, but 'tier' is primary
}

const { width: screenWidth } = Dimensions.get('window');

export default function StatisticsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'week'>('all');
  const [recentForm, setRecentForm] = useState<('W' | 'L' | 'D')[]>([]);

  useEffect(() => {
    if (session?.user) {
      loadStatistics();
    } else {
      setLoading(false);
    }
  }, [session, selectedPeriod]);

  const loadStatistics = async () => {
    if (!session?.user) return;

    try {
      let query = supabase
        .from('saved_matches')
        .select('*')
        .eq('userId', session.user.id);

      // Apply time filter
      if (selectedPeriod !== 'all') {
        const date = new Date();
        if (selectedPeriod === 'week') {
          date.setDate(date.getDate() - 7);
        } else if (selectedPeriod === 'month') {
          date.setMonth(date.getMonth() - 1);
        }
        query = query.gte('createdAt', date.toISOString());
      }

      const { data: allMatches, error } = await query.order('createdAt', { ascending: false });

      if (error) throw error;

      // Filter to only include matches where user was a player
      const matches = (allMatches || []).filter(match => {
        const userSlot = Object.entries(match.userSlotMap || {}).find(
          ([_, userId]) => userId === session.user.id
        );
        return userSlot !== undefined;
      });

      if (!matches || matches.length === 0) {
        setStats(null);
        setAchievements([]);
        setRecentForm([]);
        setLoading(false);
        return;
      }

      // Calculate overall statistics
      const calculatedStats = calculateOverallStats(matches, session.user.id);
      setStats(calculatedStats);

      // Calculate achievements
      const achievementsList = calculateAchievements(calculatedStats, matches);
      setAchievements(achievementsList);

      // Get recent form (last 5 matches)
      const form = matches.slice(0, 5).map(match => {
        const userTeam = getUserTeam(match, session.user.id);
        if (!userTeam || !match.winnerTeam) return 'D';
        return match.winnerTeam === userTeam ? 'W' : 'L';
      });
      setRecentForm(form);

    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserTeam = (match: any, userId: string): number | null => {
    for (const [slot, id] of Object.entries(match.userSlotMap)) {
      if (id === userId) {
        const playerSlot = parseInt(slot);
        return playerSlot <= 2 ? 1 : 2;
      }
    }
    return null;
  };

  const calculateOverallStats = (matches: any[], userId: string): OverallStats => {
    let stats: OverallStats = {
      totalMatches: 0, // Will be set after filtering matches
      totalWins: 0,
      totalLosses: 0,
      winRate: 0,
      totalThrows: 0,
      totalHits: 0,
      hitRate: 0,
      totalCatches: 0,
      totalCatchAttempts: 0,
      catchRate: 0,
      totalScore: 0,
      avgScore: 0,
      totalGoals: 0,
      totalSinks: 0,
      totalSpecialThrows: 0,
      totalFifaSuccess: 0,
      totalFifaAttempts: 0,
      fifaRate: 0,
      totalAura: 0,
      longestStreak: 0,
      totalOnFireCount: 0,
      totalMatchDuration: 0,
      avgMatchDuration: 0,
      favoriteArena: '',
      nemesisPlayer: '',
      bestPartner: '',
      // Initialize new granular counters
      totalTableDie: 0,
      totalLine: 0,
      totalKnicker: 0,
      totalDink: 0,
      totalDrop: 0,
      totalMiss: 0,
      totalLong: 0,
      totalCatchPlusAura: 0,
      totalBody: 0,
      totalTwoHands: 0,
      totalMissedCatches: 0,
    };

    const arenaCount: { [key: string]: number } = {};
    const playerPerformance: { [key: string]: { wins: number; losses: number } } = {};
    const partnerPerformance: { [key: string]: { wins: number; losses: number } } = {};

    matches.forEach(match => {
      // Track arena frequency
      arenaCount[match.matchSetup.arena] = (arenaCount[match.matchSetup.arena] || 0) + 1;

      // Find user's team and slot
      const userTeam = getUserTeam(match, userId);
      const userSlot = Object.entries(match.userSlotMap).find(([_, id]) => id === userId)?.[0];
      
      if (userTeam && userSlot) {
        // Win/Loss tracking
        if (match.winnerTeam === userTeam) {
          stats.totalWins++;
        } else if (match.winnerTeam) {
          stats.totalLosses++;
        }

        // Get user's player stats
        const userPlayerStats = match.playerStats[parseInt(userSlot)];
        if (userPlayerStats) {
          stats.totalThrows += userPlayerStats.throws || 0;
          stats.totalHits += userPlayerStats.hits || 0;
          stats.totalCatches += userPlayerStats.catches || 0;
          stats.totalScore += userPlayerStats.score || 0;
          stats.totalGoals += userPlayerStats.goals || 0;
          stats.totalSinks += userPlayerStats.sink || 0;
          stats.totalSpecialThrows += userPlayerStats.specialThrows || 0;
          stats.totalFifaSuccess += userPlayerStats.fifaSuccess || 0;
          stats.totalFifaAttempts += userPlayerStats.fifaAttempts || 0;
          stats.totalAura += userPlayerStats.aura || 0;
          stats.totalOnFireCount += userPlayerStats.onFireCount || 0;
          
          // Granular Catch Attempts
          stats.totalDrop += userPlayerStats.drop || 0;
          stats.totalMiss += userPlayerStats.miss || 0;
          stats.totalTwoHands += userPlayerStats.twoHands || 0;
          stats.totalBody += userPlayerStats.body || 0;

          // Sum of all ways a catch attempt could fail or succeed (for catchRate)
          const catchAttempts = (userPlayerStats.catches || 0) + 
                                (userPlayerStats.drop || 0) + 
                                (userPlayerStats.miss || 0) + 
                                (userPlayerStats.twoHands || 0) + 
                                (userPlayerStats.body || 0);
          stats.totalCatchAttempts += catchAttempts;
          stats.totalMissedCatches += (userPlayerStats.drop || 0) + (userPlayerStats.miss || 0) + (userPlayerStats.twoHands || 0) + (userPlayerStats.body || 0);

          // Track longest streak
          if (userPlayerStats.hitStreak > stats.longestStreak) {
            stats.longestStreak = userPlayerStats.hitStreak;
          }

          // Granular counter tracking
          stats.totalTableDie += userPlayerStats.tableDie || 0;
          stats.totalLine += userPlayerStats.line || 0;
          stats.totalKnicker += userPlayerStats.knicker || 0;
          stats.totalDink += userPlayerStats.dink || 0;
          stats.totalLong += userPlayerStats.long || 0;
          stats.totalCatchPlusAura += (userPlayerStats.catches || 0) + (userPlayerStats.aura || 0);
        }

        // Track opponent and partner performance
        for (let i = 1; i <= 4; i++) {
          if (i === parseInt(userSlot)) continue;
          
          const playerName = match.matchSetup.playerNames[i - 1];
          const playerTeam = i <= 2 ? 1 : 2;
          
          if (playerTeam === userTeam) {
            // Partner
            if (!partnerPerformance[playerName]) {
              partnerPerformance[playerName] = { wins: 0, losses: 0 };
            }
            if (match.winnerTeam === userTeam) {
              partnerPerformance[playerName].wins++;
            } else if (match.winnerTeam) {
              partnerPerformance[playerName].losses++;
            }
          } else {
            // Opponent
            if (!playerPerformance[playerName]) {
              playerPerformance[playerName] = { wins: 0, losses: 0 };
            }
            if (match.winnerTeam !== userTeam && match.winnerTeam) {
              playerPerformance[playerName].wins++;
            } else if (match.winnerTeam === userTeam) {
              playerPerformance[playerName].losses++;
            }
          }
        }
      }

      stats.totalMatchDuration += match.matchDuration || 0;
    });

    // Set totalMatches here, after filtering and iterating
    stats.totalMatches = matches.length;

    // Calculate rates and averages
    stats.winRate = stats.totalMatches > 0 ? (stats.totalWins / stats.totalMatches) * 100 : 0;
    stats.hitRate = stats.totalThrows > 0 ? (stats.totalHits / stats.totalThrows) * 100 : 0;
    stats.catchRate = stats.totalCatchAttempts > 0 ? (stats.totalCatches / stats.totalCatchAttempts) * 100 : 0;
    stats.avgScore = stats.totalMatches > 0 ? stats.totalScore / stats.totalMatches : 0;
    stats.fifaRate = stats.totalFifaAttempts > 0 ? (stats.totalFifaSuccess / stats.totalFifaAttempts) * 100 : 0;
    stats.avgMatchDuration = stats.totalMatches > 0 ? stats.totalMatchDuration / stats.totalMatches : 0;

    // Find favorite arena
    let maxArenaCount = 0;
    for (const [arena, count] of Object.entries(arenaCount)) {
      if (count > maxArenaCount) {
        maxArenaCount = count;
        stats.favoriteArena = arena;
      }
    }

    // Find nemesis (opponent with best record against user)
    let worstRecord = -1; // Initialize with a value lower than any possible rate
    let foundNemesis = false;
    for (const [player, record] of Object.entries(playerPerformance)) {
      const total = record.wins + record.losses;
      if (total > 0) {
        // Nemesis is based on opponents win rate against YOU (your loss rate against them)
        const lossRateAgainstThisPlayer = record.wins / total; // opponent's wins are your losses
        if (lossRateAgainstThisPlayer > worstRecord) {
          worstRecord = lossRateAgainstThisPlayer;
          stats.nemesisPlayer = player;
          foundNemesis = true;
        }
      }
    }
    if (!foundNemesis) {
        stats.nemesisPlayer = 'N/A';
    }


    // Find best partner
    let bestWinRate = -1; // Initialize with a value lower than any possible rate
    let foundBestPartner = false;
    for (const [player, record] of Object.entries(partnerPerformance)) {
      const total = record.wins + record.losses;
      if (total > 0) {
        const winRate = record.wins / total;
        if (winRate > bestWinRate) {
          bestWinRate = winRate;
          stats.bestPartner = player;
          foundBestPartner = true;
        }
      }
    }
    if (!foundBestPartner) {
        stats.bestPartner = 'N/A';
    }


    return stats;
  };

  const getAchievementTierProgress = (currentValue: number, tiers: number[]) => {
    let tier: AchievementTier = 'None';
    let nextTarget: number | string = tiers[0];
    let nextTier: AchievementTier | 'N/A' = 'Bronze';
    let progressPercentage = 0;
    let totalMasterCount: number | undefined = undefined;
    let unlocked = false;

    const medalTiers: AchievementTier[] = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Master'];

    // Find the current tier and next target
    for (let i = 0; i < tiers.length; i++) {
      if (currentValue < tiers[i]) {
        tier = (i === 0) ? 'None' : medalTiers[i - 1]; // If below first tier, it's None. Otherwise, previous medal.
        nextTarget = tiers[i];
        nextTier = medalTiers[i];
        
        // Calculate percentage towards the next target
        const lowerBound = (i === 0) ? 0 : tiers[i - 1];
        progressPercentage = ((currentValue - lowerBound) / (tiers[i] - lowerBound)) * 100;
        break;
      } else if (i === tiers.length - 1) { // Current value is at or past the last defined tier (Diamond's target)
        tier = 'Master';
        unlocked = true;
        nextTarget = 'N/A'; // No further targets
        nextTier = 'N/A';
        totalMasterCount = currentValue; // Master shows total count
        progressPercentage = 100; // Always 100% for Master
      }
    }

    progressPercentage = Math.min(100, Math.max(0, progressPercentage || 0)); // Ensure valid percentage
    if (tier !== 'None' && tier !== 'Master') unlocked = true; // Set unlocked for achieved tiers
    else if (tier === 'Master') unlocked = true; // Master is also unlocked

    return { tier, nextTarget, nextTier, progressPercentage, totalMasterCount, unlocked };
  };

  const getRateAchievementTierProgress = (currentRate: number, totalAttempts: number) => { // Removed minAttempts
    // Thresholds for Bronze, Silver, Gold, Diamond, Master for rates
    const rateTiers = [50.1, 60.1, 78.1, 86.1, 93.1, 100]; // Note: Last one is 100 for Master
    const medalTiers: AchievementTier[] = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Master'];

    let tier: AchievementTier = 'None';
    let nextTarget: number | string = 'N/A';
    let nextTier: AchievementTier | 'N/A' = 'N/A';
    let progressPercentage = 0;
    let unlocked = false;
    let totalMasterCount: number | undefined = undefined;
    let currentValue = 0;

    // If there are no attempts, it's definitively "None" and 0% progress
    if (totalAttempts === 0) {
      tier = 'None';
      nextTarget = rateTiers[0]; // Next target is the first percentage threshold
      nextTier = 'Bronze';
      progressPercentage = 0;
      currentValue = 0;
    } else {
      // Attempts exist, evaluate based on rate
      for (let i = 0; i < rateTiers.length; i++) {
        if (currentRate < rateTiers[i]) {
          tier = (i === 0) ? 'None' : medalTiers[i - 1];
          nextTarget = rateTiers[i]; // Next target is the percentage for the next medal
          nextTier = medalTiers[i];
          
          const lowerBound = (i === 0) ? 0 : rateTiers[i-1];
          progressPercentage = ((currentRate - lowerBound) / (rateTiers[i] - lowerBound)) * 100;
          currentValue = currentRate;
          break;
        } else if (i === rateTiers.length - 1) { // Current rate is at or past the last defined tier (100%)
          tier = 'Master';
          unlocked = true;
          nextTarget = 'N/A';
          nextTier = 'N/A';
          progressPercentage = 100;
          currentValue = currentRate;
        }
      }
    }

    progressPercentage = Math.min(100, Math.max(0, progressPercentage || 0));
    if (tier !== 'None' && tier !== 'Master') unlocked = true;
    else if (tier === 'Master') unlocked = true;

    return { tier, nextTarget, nextTier, progressPercentage, unlocked, totalMasterCount, currentValue };
  };

  const getStreakAchievementProgress = (currentStreak: number, targetStreak: number) => {
    let tier: AchievementTier = 'None';
    let nextTarget: number | string = targetStreak;
    let nextTier: AchievementTier | 'N/A' = 'Bronze';
    let progressPercentage = 0;
    let unlocked = false;

    if (currentStreak >= targetStreak) {
      tier = 'Bronze'; // Once target is met, it's Bronze
      unlocked = true;
      nextTarget = 'N/A'; // No further targets for a simple streak achievement
      nextTier = 'N/A';
      progressPercentage = 100;
    } else {
      tier = 'None';
      progressPercentage = (currentStreak / targetStreak) * 100;
    }
    progressPercentage = Math.min(100, Math.max(0, progressPercentage || 0));

    return { tier, nextTarget, nextTier, progressPercentage, unlocked, currentValue: currentStreak };
  };

  const calculateAchievements = (stats: OverallStats, matches: any[]): AchievementData[] => {
    // Harder Tier Definitions (Adjust these values as needed for difficulty)
    const matchTiers = [5, 10, 20, 40, 80]; // Matches played
    const winTiers = [5, 10, 20, 40, 80]; // Wins
    const scoreTiers = [25, 50, 100, 200, 500]; // Score
    const goalTiers = [5, 10, 20, 40, 80]; // Goals
    const sinkTiers = [5, 10, 20, 40, 80]; // Sinks
    const onFireTiers = [5, 10, 20, 40, 80]; // Times on fire
    const durationTiers = [10, 30, 60, 120, 300]; // Minutes (10h, 40h, 100h, 200h, 400h converted to minutes)

    // Granular stat tiers (Adjust these values for difficulty)
    const tableDieTiers = [5, 10, 20, 40, 80];
    const lineTiers = [5, 10, 20, 40, 80];
    const knickerTiers = [5, 10, 20, 40, 80];
    const dinkTiers = [5, 10, 20, 40, 80];
    const dropTiers = [5, 10, 20, 40, 80]; // Negative stat
    const missTiers = [5, 10, 20, 40, 80]; // Negative stat
    const longTiers = [5, 10, 20, 40, 80];
    const catchPlusAuraTiers = [5, 10, 20, 40, 80];
    const bodyTiers = [5, 10, 20, 40, 80];
    const twoHandsTiers = [5, 10, 20, 40, 80];
    const missedCatchesTiers = [5, 10, 20, 40, 80];


    let achievements: AchievementData[] = [
      // Rate and Streak Achievements
      {
        id: 'sharpshooter',
        title: 'Sharpshooter',
        statName: 'Hit Rate',
        description: 'Achieve a high hit rate.',
        icon: 'locate',
        color: '#ef4444',
        ...getRateAchievementTierProgress(stats.hitRate, stats.totalThrows),
      },
      {
        id: 'goalkeeper',
        title: 'Goalkeeper',
        statName: 'Catch Rate',
        description: 'Achieve a high catch rate.',
        icon: 'hand-left',
        color: '#22c55e',
        ...getRateAchievementTierProgress(stats.catchRate, stats.totalCatchAttempts),
      },
      {
        id: 'fifa_pro',
        title: 'FIFA Pro',
        statName: 'FIFA Success Rate',
        description: 'Achieve a high FIFA success rate.',
        icon: 'footsteps',
        color: '#f59e0b',
        ...getRateAchievementTierProgress(stats.fifaRate, stats.totalFifaAttempts),
      },
      {
        id: 'winning_streak',
        title: 'Unstoppable',
        statName: 'Win Streak',
        description: 'Win 7 matches in a row.',
        icon: 'trending-up',
        color: '#10b981',
        ...getStreakAchievementProgress(stats.longestStreak, 7),
      },
      // Tiered Achievements (using getAchievementTierProgress)
      {
        id: 'total_matches',
        title: 'Veteran',
        statName: 'Matches Played',
        description: 'Total matches played.',
        icon: 'medal',
        color: '#8b5cf6',
        currentValue: stats.totalMatches,
        ...getAchievementTierProgress(stats.totalMatches, matchTiers),
      },
      {
        id: 'total_wins',
        title: 'True Champion',
        statName: 'Total Wins',
        description: 'Total wins achieved.',
        icon: 'trophy',
        color: '#fbbf24',
        currentValue: stats.totalWins,
        ...getAchievementTierProgress(stats.totalWins, winTiers),
      },
      {
        id: 'total_score',
        title: 'High Scorer',
        statName: 'Total Score',
        description: 'Total score accumulated.',
        icon: 'calculator',
        color: '#3b82f6',
        currentValue: stats.totalScore,
        ...getAchievementTierProgress(stats.totalScore, scoreTiers),
      },
      {
        id: 'total_goals',
        title: 'Goal Machine Gary',
        statName: 'Total Goals',
        description: 'Total goals scored.',
        icon: 'football',
        color: '#3b82f6',
        currentValue: stats.totalGoals,
        ...getAchievementTierProgress(stats.totalGoals, goalTiers),
      },
      {
        id: 'total_sinks',
        title: 'Wet Master',
        statName: 'Total Sinks',
        description: 'Total sinks achieved.',
        icon: 'water',
        color: '#06b6d4',
        currentValue: stats.totalSinks,
        ...getAchievementTierProgress(stats.totalSinks, sinkTiers),
      },
      {
        id: 'total_on_fire',
        title: 'Hot Streak',
        statName: 'Times On Fire',
        description: 'Times on fire achieved.',
        icon: 'flame',
        color: '#dc2626',
        currentValue: stats.totalOnFireCount,
        ...getAchievementTierProgress(stats.totalOnFireCount, onFireTiers),
      },
      {
        id: 'total_duration',
        title: 'Marathon Player',
        statName: 'Total Play Time (Minutes)', // Changed from Hours to Minutes
        description: 'Total time played (minutes).',
        icon: 'time',
        color: '#7c3aed',
        currentValue: Math.floor(stats.totalMatchDuration / 60), // Convert to minutes
        ...getAchievementTierProgress(Math.floor(stats.totalMatchDuration / 60), durationTiers), // Using durationTiers directly
      },
      // New granular achievements
      {
        id: 'total_table_die',
        title: 'Table Die Danny',
        statName: 'Table Dies',
        description: 'Total table dies.',
        icon: 'cube',
        color: '#d946b1',
        currentValue: stats.totalTableDie,
        ...getAchievementTierProgress(stats.totalTableDie, tableDieTiers),
      },
      {
        id: 'total_line',
        title: 'Line Larry',
        statName: 'Lines',
        description: 'Total line shots.',
        icon: 'create',
        color: '#14b8a6',
        currentValue: stats.totalLine,
        ...getAchievementTierProgress(stats.totalLine, lineTiers),
      },
      {
        id: 'total_knicker',
        title: 'Knicker Knight',
        statName: 'Knickers',
        description: 'Total knickers.',
        icon: 'bandage',
        color: '#a855f7',
        currentValue: stats.totalKnicker,
        ...getAchievementTierProgress(stats.totalKnicker, knickerTiers),
      },
      {
        id: 'total_dink',
        title: 'Dink Dynamo',
        statName: 'Dinks',
        description: 'Total dinks.',
        icon: 'pulse',
        color: '#f97316',
        currentValue: stats.totalDink,
        ...getAchievementTierProgress(stats.totalDink, dinkTiers),
      },
      {
        id: 'total_drop',
        title: 'Butterfingers',
        statName: 'Drops',
        description: 'Total drops.',
        icon: 'sad',
        color: '#6b7280',
        currentValue: stats.totalDrop,
        ...getAchievementTierProgress(stats.totalDrop, dropTiers),
      },
      {
        id: 'total_miss',
        title: 'Miss Maestro',
        statName: 'Misses',
        description: 'Total misses.',
        icon: 'walk',
        color: '#be185f',
        currentValue: stats.totalMiss,
        ...getAchievementTierProgress(stats.totalMiss, missTiers),
      },
      {
        id: 'total_long',
        title: 'Long Shot Larry',
        statName: 'Long Shots',
        description: 'Total long shots.',
        icon: 'chevron-forward-circle',
        color: '#0ea5e9',
        currentValue: stats.totalLong,
        ...getAchievementTierProgress(stats.totalLong, longTiers),
      },
      {
        id: 'total_catch_plus_aura',
        title: 'Aura Catcher',
        statName: 'Catches + Aura',
        description: 'Total catches + aura gained.',
        icon: 'sparkles',
        color: '#7e22ce',
        currentValue: stats.totalCatchPlusAura,
        ...getAchievementTierProgress(stats.totalCatchPlusAura, catchPlusAuraTiers),
      },
      {
        id: 'total_body_catch',
        title: 'Body Brody',
        statName: 'Body Catches',
        description: 'Total body catches.',
        icon: 'body',
        color: '#2563eb',
        currentValue: stats.totalBody,
        ...getAchievementTierProgress(stats.totalBody, bodyTiers),
      },
      {
        id: 'total_two_hands_catch',
        title: 'Two Hand Harold',
        statName: 'Two-Hand Catches',
        description: 'Total two-hand catches.',
        icon: 'hand-right',
        color: '#0d9488',
        currentValue: stats.totalTwoHands,
        ...getAchievementTierProgress(stats.totalTwoHands, twoHandsTiers),
      },
      {
        id: 'total_missed_catches',
        title: 'Needs Practice',
        statName: 'Missed Catches',
        description: 'Total missed catch attempts (drops, misses, etc.).',
        icon: 'sad-outline',
        color: '#dc2626',
        currentValue: stats.totalMissedCatches,
        ...getAchievementTierProgress(stats.totalMissedCatches, missedCatchesTiers),
      },
    ];

    // Conditionally add the "First Victory" achievement if the user has won at least one match
    if (stats.totalWins > 0) {
      achievements.unshift({
        id: 'first_win',
        title: 'First Victory',
        statName: 'Total Wins',
        description: 'Win your first match!',
        icon: 'trophy',
        color: MEDAL_COLORS.Bronze,
        tier: 'Bronze',
        unlocked: true,
        currentValue: 1,
        nextTarget: 'N/A',
        nextTier: 'N/A',
        progressPercentage: 100,
      });
    }

    return achievements;
  };

  const checkWinningStreak = (matches: any[], target: number): boolean => {
    if (!session?.user) return false;
    
    let currentStreak = 0;
    for (const match of matches) {
      const userTeam = getUserTeam(match, session.user.id);
      if (userTeam && match.winnerTeam === userTeam) {
        currentStreak++;
        if (currentStreak >= target) return true;
      } else {
        currentStreak = 0;
      }
    }
    return false;
  };

  const getCurrentWinStreak = (matches: any[]): number => {
    if (!session?.user) return 0;
    
    let currentStreak = 0;
    for (const match of matches) {
      const userTeam = getUserTeam(match, session.user.id);
      if (userTeam && match.winnerTeam === userTeam) {
        currentStreak++;
      } else {
        break;
      }
    }
    return currentStreak;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const BackButton = () => (
    <TouchableOpacity
      onPress={() => router.back()}
      style={styles.backButton}
    >
      <Ionicons name="arrow-back" size={24} color="#3b82f6" />
      <ThemedText style={styles.backText}>Back</ThemedText>
    </TouchableOpacity>
  );

  if (!session?.user) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedView style={styles.container}>
          <BackButton />
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart" size={64} color={theme.colors.text} />
            <ThemedText variant="subtitle" style={styles.emptyStateText}>
              Sign in to view your statistics
            </ThemedText>
            <ThemedButton
              title="Sign In"
              onPress={() => router.push('/(auth)/login')}
              size="medium"
              style={{ marginTop: 20 }}
            />
          </View>
        </ThemedView>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedView style={styles.container}>
          <BackButton />
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </ThemedView>
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedView style={styles.container}>
          <BackButton />
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart-outline" size={64} color={theme.colors.text} />
            <ThemedText variant="subtitle" style={styles.emptyStateText}>
              No statistics available yet
            </ThemedText>
            <ThemedText variant="caption" style={styles.emptyStateSubtext}>
              Join a match as a player to see your stats!
            </ThemedText>
          </View>
        </ThemedView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText variant="title">Statistics</ThemedText>
          <View style={styles.periodSelector}>
            {(['all', 'month', 'week'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodTab,
                  selectedPeriod === period && styles.periodTabActive,
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <ThemedText
                  variant="caption"
                  color={selectedPeriod === period ? 'primary' : undefined}
                >
                  {period === 'all' ? 'All Time' : period === 'month' ? 'Month' : 'Week'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>

        {/* Recent Form */}
        {recentForm.length > 0 && (
          <ThemedView variant="card" style={styles.formCard}>
            <ThemedText variant="subtitle">Recent Form</ThemedText>
            <View style={styles.formContainer}>
              {recentForm.map((result, index) => (
                <View
                  key={index}
                  style={[
                    styles.formBadge,
                    result === 'W' ? styles.winForm : result === 'L' ? styles.lossForm : styles.drawForm,
                  ]}
                >
                  <ThemedText variant="caption">
                    {result}
                  </ThemedText>
                </View>
              ))}
            </View>
          </ThemedView>
        )}

        {/* Main Stats Grid */}
        <View style={styles.statsGrid}>
          <ThemedView variant="card" style={styles.statCard}>
            <Ionicons name="trophy" size={24} color={theme.colors.warning} />
            <ThemedText variant="title" color="warning">
              {stats.winRate.toFixed(1)}%
            </ThemedText>
            <ThemedText variant="caption">Win Rate</ThemedText>
            <ThemedText variant="caption" style={styles.statDetail}>
              {stats.totalWins}W - {stats.totalLosses}L
            </ThemedText>
          </ThemedView>

          <ThemedView variant="card" style={styles.statCard}>
            <Ionicons name="locate" size={24} color={theme.colors.error} />
            <ThemedText variant="title" color="error">
              {stats.hitRate.toFixed(1)}%
            </ThemedText>
            <ThemedText variant="caption">Hit Rate</ThemedText>
            <ThemedText variant="caption" style={styles.statDetail}>
              {stats.totalHits}/{stats.totalThrows}
            </ThemedText>
          </ThemedView>

          <ThemedView variant="card" style={styles.statCard}>
            <Ionicons name="hand-left" size={24} color={theme.colors.success} />
            <ThemedText variant="title" color="success">
              {stats.catchRate.toFixed(1)}%
            </ThemedText>
            <ThemedText variant="caption">Catch Rate</ThemedText>
            <ThemedText variant="caption" style={styles.statDetail}>
              {stats.totalCatches}/{stats.totalCatchAttempts}
            </ThemedText>
          </ThemedView>

          <ThemedView variant="card" style={styles.statCard}>
            <Ionicons name="speedometer" size={24} color={theme.colors.info} />
            <ThemedText variant="title" color="primary">
              {stats.avgScore.toFixed(1)}
            </ThemedText>
            <ThemedText variant="caption">Avg Score</ThemedText>
            <ThemedText variant="caption" style={styles.statDetail}>
              per match
            </ThemedText>
          </ThemedView>
        </View>

        {/* Detailed Stats */}
        <ThemedView variant="card" style={styles.detailsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>
            Performance Details
          </ThemedText>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Matches</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalMatches}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Score</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalScore}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Goals</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalGoals}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Sinks</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalSinks}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Special Throws</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalSpecialThrows}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">FIFA Success Rate</ThemedText>
            <ThemedText variant="body" color="primary">
              {stats.fifaRate.toFixed(1)}% ({stats.totalFifaSuccess}/{stats.totalFifaAttempts})
            </ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Aura</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalAura}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Longest Hit Streak</ThemedText>
            <ThemedText variant="body" color="primary">{stats.longestStreak}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Times On Fire</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalOnFireCount} 🔥</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Play Time</ThemedText>
            <ThemedText variant="body" color="primary">{formatDuration(stats.totalMatchDuration)}</ThemedText>
          </View>
          
          {/* New Granular Counters */}
          <View style={styles.detailRow}>
            <ThemedText variant="body">Table Die</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalTableDie}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Line</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalLine}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Knicker</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalKnicker}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Dink</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalDink}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Drop</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalDrop}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Miss</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalMiss}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Long Shot</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalLong}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Catch + Aura</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalCatchPlusAura}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Body Catches</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalBody}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Two-Hand Catches</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalTwoHands}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText variant="body">Missed Catches</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalMissedCatches}</ThemedText>
          </View>
        </ThemedView>

        {/* Insights */}
        <ThemedView variant="card" style={styles.insightsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>
            Insights
          </ThemedText>
          
          {stats.favoriteArena && (
            <View style={styles.insightRow}>
              <Ionicons name="location" size={20} color={theme.colors.primary} />
              <View style={styles.insightText}>
                <ThemedText variant="caption">Favorite Arena</ThemedText>
                <ThemedText variant="body">{stats.favoriteArena || 'N/A'}</ThemedText>
              </View>
            </View>
          )}
          
          {stats.bestPartner && (
            <View style={styles.insightRow}>
              <Ionicons name="people" size={20} color={theme.colors.success} />
              <View style={styles.insightText}>
                <ThemedText variant="caption">Best Partner</ThemedText>
                <ThemedText variant="body">{stats.bestPartner || 'N/A'}</ThemedText>
              </View>
            </View>
          )}
          
          {stats.nemesisPlayer && (
            <View style={styles.insightRow}>
              <Ionicons name="skull" size={20} color={theme.colors.error} />
              <View style={styles.insightText}>
                <ThemedText variant="caption">Toughest Opponent</ThemedText>
                <ThemedText variant="body">{stats.nemesisPlayer || 'N/A'}</ThemedText>
              </View>
            </View>
          )}
        </ThemedView>

        {/* Achievements */}
        <ThemedView variant="card" style={styles.achievementsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>
            Achievements
          </ThemedText>
          
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement) => (
              <TouchableOpacity
                key={achievement.id}
                style={[
                  styles.achievementItem,
                  { backgroundColor: theme.colors.card },
                ]}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.achievementIcon,
                    { backgroundColor: MEDAL_COLORS[achievement.tier] || theme.colors.textSecondary }, // Dynamic background color
                  ]}
                >
                  <Ionicons
                    name={achievement.icon}
                    size={24}
                    color="#ffffff" // Icon color is always white for contrast
                  />
                </View>
                <ThemedText variant="caption" style={styles.achievementTitle}>
                  {achievement.title}
                </ThemedText>
                <ThemedText variant="caption" style={styles.achievementStatName}>
                  {achievement.statName}
                </ThemedText>
                
                {/* Special rendering for First Victory */}
                {achievement.id === 'first_win' ? (
                  <ThemedText variant="caption" style={[styles.achievementProgressText, {color: MEDAL_COLORS.Bronze}]}>
                    Unlocked
                  </ThemedText>
                ) : achievement.tier !== 'Master' ? (
                  <>
                    <ThemedText variant="caption" style={styles.achievementProgressText}>
                      {`${
                        achievement.statName.includes('Rate')
                          ? achievement.currentValue.toFixed(1) + '%'
                          : achievement.currentValue
                      } / ${
                        achievement.statName.includes('Rate')
                          ? (typeof achievement.nextTarget === 'number' ? achievement.nextTarget.toFixed(1) : achievement.nextTarget) + '%'
                          : achievement.nextTarget
                      }${
                        achievement.tier !== 'None' ? ` (${achievement.tier})` : ''
                      }`}
                    </ThemedText>
                    <View style={styles.progressBarBackground}>
                      <View style={[styles.progressBarFill, { width: `${achievement.progressPercentage}%`, backgroundColor: achievement.color }]} />
                    </View>
                  </>
                ) : (
                  <ThemedText variant="caption" style={styles.achievementProgressText}>
                    {achievement.statName.includes('Rate')
                      ? `${achievement.currentValue.toFixed(1)}% (Master)`
                      : `Total: ${achievement.totalMasterCount}`
                    }
                  </ThemedText>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>
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
  backText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  periodTab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  periodTabActive: {
    backgroundColor: '#3b82f6',
  },
  formCard: {
    marginBottom: 16,
  },
  formContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  formBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winForm: {
    backgroundColor: '#22c55e',
  },
  lossForm: {
    backgroundColor: '#ef4444',
  },
  drawForm: {
    backgroundColor: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: (screenWidth - 52) / 2,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statDetail: {
    marginTop: 4,
  },
  detailsCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  insightsCard: {
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  insightText: {
    flex: 1,
  },
  achievementsCard: {
    marginBottom: 20,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center', // Center the items in the grid
  },
  achievementItem: {
    width: '31%', // Use percentage to create a robust 3-column layout
    marginHorizontal: '1%', // Add small horizontal margin for spacing
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16, // Use margin for vertical spacing
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementTitle: {
    textAlign: 'center',
    marginBottom: 2,
    fontWeight: 'bold',
    fontSize: 12, // Reduced font size
  },
  achievementStatName: { // New style for stat name
    textAlign: 'center',
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  achievementTier: { // This style is no longer explicitly used to render text, but can be kept for historical or future use.
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  achievementProgressText: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: 4,
    height: 12, // Set a fixed height to prevent layout shifts
  },
  progressBarBackground: {
    width: '80%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,
  },
  emptyStateText: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    marginTop: 8,
    textAlign: 'center',
  },
});
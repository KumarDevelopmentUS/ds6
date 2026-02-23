// app/stats.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import {
    calculateHeadToHeadStats,
    calculatePersonalRecords,
    calculateStreakInfo,
    calculateTeammateStats,
    HeadToHeadStats,
    PersonalRecords,
    StreakInfo,
    TeammateStats,
} from '@/utils/playerRelationshipStats';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
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
  averageRanking: number;

  // Current Beer Die throw outcomes
  totalLine: number;
  totalTable: number;
  totalHit: number;
  totalGoal: number;
  totalDink: number;
  totalSink: number;
  totalInvalid: number;
  
  // Current Beer Die defense outcomes
  totalMiss: number;
  
  // Current FIFA outcomes
  totalGoodKick: number;
  totalBadKick: number;
  
  // Calculated stats
  totalValidThrows: number;
  totalSuccessfulCatches: number;
  totalRedemptionShots: number;
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

  const [recentForm, setRecentForm] = useState<('W' | 'L' | 'D')[]>([]);
  
  // New state for head-to-head, teammate stats, streaks, and records
  const [headToHeadStats, setHeadToHeadStats] = useState<HeadToHeadStats[]>([]);
  const [teammateStats, setTeammateStats] = useState<TeammateStats[]>([]);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecords | null>(null);
  const [loadingRelationshipStats, setLoadingRelationshipStats] = useState(true);
  
  // Collapsible section states
  const [showAllOpponents, setShowAllOpponents] = useState(false);
  const [showAllTeammates, setShowAllTeammates] = useState(false);

  useEffect(() => {
    if (session?.user) {
      loadStatistics();
      loadRelationshipStats();
    } else {
      setLoading(false);
      setLoadingRelationshipStats(false);
    }
  }, [session]);

  const loadRelationshipStats = async () => {
    if (!session?.user) return;
    
    setLoadingRelationshipStats(true);
    try {
      const [h2h, teammates, streaks, records] = await Promise.all([
        calculateHeadToHeadStats(session.user.id),
        calculateTeammateStats(session.user.id),
        calculateStreakInfo(session.user.id),
        calculatePersonalRecords(session.user.id),
      ]);
      
      setHeadToHeadStats(h2h);
      setTeammateStats(teammates);
      setStreakInfo(streaks);
      setPersonalRecords(records);
    } catch (error) {
      console.error('Error loading relationship stats:', error);
    } finally {
      setLoadingRelationshipStats(false);
    }
  };

  const loadStatistics = async () => {
    if (!session?.user) return;

    try {
      let query = supabase
        .from('saved_matches')
        .select('*')
        .eq('userId', session.user.id);

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
      totalMatches: 0,
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
      averageRanking: 0,
      
      // Current Beer Die throw outcomes
      totalLine: 0,
      totalTable: 0,
      totalHit: 0,
      totalGoal: 0,
      totalDink: 0,
      totalSink: 0,
      totalInvalid: 0,
      
      // Current Beer Die defense outcomes
      totalMiss: 0,
      
      // Current FIFA outcomes
      totalGoodKick: 0,
      totalBadKick: 0,
      
      // Calculated stats
      totalValidThrows: 0,
      totalSuccessfulCatches: 0,
      totalRedemptionShots: 0,
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
          stats.totalFifaSuccess += userPlayerStats.fifaSuccess || 0;
          stats.totalFifaAttempts += userPlayerStats.fifaAttempts || 0;
          stats.totalAura += userPlayerStats.aura || 0;
          stats.totalOnFireCount += userPlayerStats.onFireCount || 0;
          
          // Current Beer Die throw outcomes
          stats.totalLine += userPlayerStats.line || 0;
          stats.totalTable += userPlayerStats.table || 0;
          stats.totalHit += userPlayerStats.hit || 0;
          stats.totalGoal += userPlayerStats.goal || 0;
          stats.totalDink += userPlayerStats.dink || 0;
          stats.totalSink += userPlayerStats.sink || 0;
          stats.totalInvalid += userPlayerStats.invalid || 0;
          
          // Current Beer Die defense outcomes
          stats.totalMiss += userPlayerStats.miss || 0;
          
          // Current FIFA outcomes
          stats.totalGoodKick += userPlayerStats.goodKick || 0;
          stats.totalBadKick += userPlayerStats.badKick || 0;

          // Calculate catch attempts (catches + misses)
          const catchAttempts = (userPlayerStats.catches || 0) + (userPlayerStats.miss || 0);
          stats.totalCatchAttempts += catchAttempts;
          
          // Calculate valid throws (line + table + hit + goal + dink + sink)
          const validThrows = (userPlayerStats.line || 0) + (userPlayerStats.table || 0) + (userPlayerStats.hit || 0) + 
                             (userPlayerStats.goal || 0) + (userPlayerStats.dink || 0) + (userPlayerStats.sink || 0);
          stats.totalValidThrows += validThrows;
          
          // Track longest streak
          if (userPlayerStats.hitStreak > stats.longestStreak) {
            stats.longestStreak = userPlayerStats.hitStreak;
          }
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
    
    // Calculate additional stats
    stats.totalSuccessfulCatches = stats.totalCatches;
    stats.totalRedemptionShots = stats.totalInvalid; // Invalid throws become redemption shots

    // Calculate average ranking: 45% throw + 45% catch + 15% FIFA (max 105%)
    const hitRateDecimal = stats.hitRate / 100;
    const catchRateDecimal = stats.catchRate / 100;
    const fifaRateDecimal = stats.fifaRate / 100;
    const baseScore = (0.45 * hitRateDecimal + 0.45 * catchRateDecimal + 0.15 * fifaRateDecimal) * 100;
    stats.averageRanking = Math.round(Math.min(105, baseScore));

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
    // Core achievement tiers
    const matchTiers = [5, 10, 20, 40, 80]; // Matches played
    const winTiers = [5, 10, 20, 40, 80]; // Wins
    const scoreTiers = [25, 50, 100, 200, 500]; // Score
    const onFireTiers = [5, 10, 20, 40, 80]; // Times on fire
    const durationTiers = [10, 30, 60, 120, 300]; // Minutes (10h, 40h, 100h, 200h, 400h converted to minutes)

    // Current Beer Die stat tiers
    const lineTiers = [5, 10, 20, 40, 80];
    const tableTiers = [5, 10, 20, 40, 80];
    const hitTiers = [5, 10, 20, 40, 80];
    const goalTiers = [5, 10, 20, 40, 80];
    const dinkTiers = [5, 10, 20, 40, 80];
    const sinkTiers = [5, 10, 20, 40, 80];
    const missTiers = [5, 10, 20, 40, 80]; // Defense stat
    const goodKickTiers = [5, 10, 20, 40, 80]; // FIFA stat


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
      // Current Beer Die achievements
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
        id: 'total_table',
        title: 'Table Master',
        statName: 'Tables',
        description: 'Total table shots.',
        icon: 'grid',
        color: '#8b5cf6',
        currentValue: stats.totalTable,
        ...getAchievementTierProgress(stats.totalTable, tableTiers),
      },
      {
        id: 'total_hit',
        title: 'Hit Master',
        statName: 'Hits',
        description: 'Total hits.',
        icon: 'locate',
        color: '#ef4444',
        currentValue: stats.totalHit,
        ...getAchievementTierProgress(stats.totalHit, hitTiers),
      },
      {
        id: 'total_goal',
        title: 'Goal Machine',
        statName: 'Goals',
        description: 'Total goals.',
        icon: 'football',
        color: '#3b82f6',
        currentValue: stats.totalGoal,
        ...getAchievementTierProgress(stats.totalGoal, goalTiers),
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
        id: 'total_sink',
        title: 'Sink Master',
        statName: 'Sinks',
        description: 'Total sinks.',
        icon: 'water',
        color: '#06b6d4',
        currentValue: stats.totalSink,
        ...getAchievementTierProgress(stats.totalSink, sinkTiers),
      },
      {
        id: 'total_miss',
        title: 'Defensive Wall',
        statName: 'Misses',
        description: 'Total defensive misses.',
        icon: 'walk',
        color: '#be185f',
        currentValue: stats.totalMiss,
        ...getAchievementTierProgress(stats.totalMiss, missTiers),
      },
      {
        id: 'total_good_kick',
        title: 'FIFA Pro',
        statName: 'Good Kicks',
        description: 'Total successful FIFA kicks.',
        icon: 'footsteps',
        color: '#f59e0b',
        currentValue: stats.totalGoodKick,
        ...getAchievementTierProgress(stats.totalGoodKick, goodKickTiers),
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



  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const styles = createStyles(theme);
  
  const BackButton = () => (
    <HapticBackButton
      onPress={() => router.back()}
      style={styles.backButton}
      color={theme.colors.primary}
    />
  );

  if (!session?.user) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedView style={styles.container}>
          <BackButton />
          <EmptyState
            type="stats"
            title="Sign in to view your statistics"
            description="Track your performance across all your matches"
            actionLabel="Sign In"
            onAction={() => router.push('/(auth)/login')}
            />
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
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <ThemedText variant="title" style={{ marginTop: 60, marginBottom: 16 }}>Statistics</ThemedText>
            <View style={{ gap: 12 }}>
              <Skeleton height={120} borderRadius={12} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}><Skeleton height={80} borderRadius={12} /></View>
                <View style={{ flex: 1 }}><Skeleton height={80} borderRadius={12} /></View>
              </View>
              <Skeleton height={200} borderRadius={12} />
              <Skeleton height={150} borderRadius={12} />
            </View>
          </ScrollView>
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
          <EmptyState
            type="stats"
            title="No statistics available yet"
            description="Join a match as a player to start building your stats profile!"
            actionLabel="Start a Match"
            onAction={() => router.push('/tracker/join')}
          />
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
          <ThemedText variant="title">Player Statistics</ThemedText>
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
                  <ThemedText variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
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
            <Ionicons name="star" size={24} color={theme.colors.warning} />
            <ThemedText variant="title" color="warning">
              {stats.averageRanking}
            </ThemedText>
            <ThemedText variant="caption">Average Ranking</ThemedText>
            <ThemedText variant="caption" style={styles.statDetail}>
              Overall Performance
            </ThemedText>
          </ThemedView>

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

        {/* Player Overview */}
        {stats && (
          <ThemedView variant="card" style={styles.playerStatsSection}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              Player Overview
            </ThemedText>
            
            <View style={styles.playerStatsContainer}>
              <View style={styles.playerStatsList}>
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Average Ranking:</ThemedText>
                  <ThemedText variant="body" color="primary">{stats.averageRanking}</ThemedText>
                </View>
                
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Total Matches:</ThemedText>
                  <ThemedText variant="body" color="primary">{stats.totalMatches}</ThemedText>
                </View>
                
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Total Wins:</ThemedText>
                  <ThemedText variant="body" color="primary">{stats.totalWins}</ThemedText>
                </View>
                
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Total Score:</ThemedText>
                  <ThemedText variant="body" color="primary">{stats.totalScore}</ThemedText>
                </View>
                
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Total Aura:</ThemedText>
                  <ThemedText variant="body" color="primary">{stats.totalAura}</ThemedText>
                </View>
                
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Longest Streak:</ThemedText>
                  <ThemedText variant="body" color="primary">{stats.longestStreak}</ThemedText>
                </View>
                
                <View style={styles.playerStatRow}>
                  <ThemedText variant="body">Total Play Time:</ThemedText>
                  <ThemedText variant="body" color="primary">{formatDuration(stats.totalMatchDuration)}</ThemedText>
                </View>
              </View>
            </View>
          </ThemedView>
        )}

        {/* Throwing Statistics */}
        <ThemedView variant="card" style={styles.detailsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>
            Throwing Statistics
          </ThemedText>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Throws</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalThrows}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Hits</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalHits}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Hit Rate</ThemedText>
            <ThemedText variant="body" color="primary">{stats.hitRate.toFixed(1)}%</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Valid Throws</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalValidThrows}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Lines</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalLine}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Tables</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalTable}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Hits</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalHit}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Goals</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalGoal}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Dinks</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalDink}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Sinks</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalSinks}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Invalid Throws</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalInvalid}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Times On Fire</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalOnFireCount} 🔥</ThemedText>
          </View>
        </ThemedView>

        {/* Catching Statistics */}
        <ThemedView variant="card" style={styles.detailsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>
            Catching Statistics
          </ThemedText>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total Catch Attempts</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalCatchAttempts}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Successful Catches</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalCatches}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Catch Rate</ThemedText>
            <ThemedText variant="body" color="primary">{stats.catchRate.toFixed(1)}%</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Defensive Misses</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalMiss}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Redemption Shots</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalRedemptionShots}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Misses</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalMiss}</ThemedText>
          </View>
        </ThemedView>

        {/* FIFA Statistics */}
        <ThemedView variant="card" style={styles.detailsCard}>
          <ThemedText variant="subtitle" style={styles.sectionTitle}>
            FIFA Statistics
          </ThemedText>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">FIFA Success Rate</ThemedText>
            <ThemedText variant="body" color="primary">{stats.fifaRate.toFixed(1)}%</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Total FIFA Attempts</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalFifaAttempts}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Successful FIFA Kicks</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalFifaSuccess}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Good Kicks</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalGoodKick}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText variant="body">Bad Kicks</ThemedText>
            <ThemedText variant="body" color="primary">{stats.totalBadKick}</ThemedText>
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

        {/* Current Streak & Personal Records */}
        {!loadingRelationshipStats && streakInfo && (
          <ThemedView variant="card" style={styles.streakCard}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              Streaks & Records
            </ThemedText>
            
            {/* Current Streak */}
            <View style={styles.streakContainer}>
              <View style={[
                styles.streakBadge,
                streakInfo.currentStreakType === 'win' ? styles.winStreakBadge : 
                streakInfo.currentStreakType === 'loss' ? styles.lossStreakBadge : styles.neutralStreakBadge
              ]}>
                <Ionicons 
                  name={streakInfo.currentStreakType === 'win' ? 'flame' : streakInfo.currentStreakType === 'loss' ? 'trending-down' : 'remove'} 
                  size={24} 
                  color="#fff" 
                />
                <ThemedText variant="title" style={styles.streakNumber}>
                  {Math.abs(streakInfo.currentStreak)}
                </ThemedText>
                <ThemedText variant="caption" style={styles.streakLabel}>
                  {streakInfo.currentStreakType === 'win' ? 'Win Streak' : 
                   streakInfo.currentStreakType === 'loss' ? 'Loss Streak' : 'No Streak'}
                </ThemedText>
              </View>
              
              <View style={styles.streakStats}>
                <View style={styles.streakStatRow}>
                  <Ionicons name="trophy" size={16} color={theme.colors.success} />
                  <ThemedText variant="body"> Best Win Streak: </ThemedText>
                  <ThemedText variant="body" color="success">{streakInfo.longestWinStreak}</ThemedText>
                </View>
                <View style={styles.streakStatRow}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.error} />
                  <ThemedText variant="body"> Worst Loss Streak: </ThemedText>
                  <ThemedText variant="body" color="error">{streakInfo.longestLossStreak}</ThemedText>
                </View>
              </View>
            </View>

            {/* Personal Records */}
            {personalRecords && (
              <View style={styles.recordsGrid}>
                {personalRecords.highestScore && (
                  <View style={styles.recordItem}>
                    <Ionicons name="star" size={20} color={theme.colors.warning} />
                    <ThemedText variant="caption">Highest Score</ThemedText>
                    <ThemedText variant="body" color="warning">{personalRecords.highestScore.value}</ThemedText>
                  </View>
                )}
                {personalRecords.mostSinksInMatch && personalRecords.mostSinksInMatch.value > 0 && (
                  <View style={styles.recordItem}>
                    <Ionicons name="water" size={20} color={theme.colors.info} />
                    <ThemedText variant="caption">Most Sinks</ThemedText>
                    <ThemedText variant="body" color="info">{personalRecords.mostSinksInMatch.value}</ThemedText>
                  </View>
                )}
                {personalRecords.mostGoalsInMatch && personalRecords.mostGoalsInMatch.value > 0 && (
                  <View style={styles.recordItem}>
                    <Ionicons name="football" size={20} color={theme.colors.primary} />
                    <ThemedText variant="caption">Most Goals</ThemedText>
                    <ThemedText variant="body" color="primary">{personalRecords.mostGoalsInMatch.value}</ThemedText>
                  </View>
                )}
                {personalRecords.bestHitRateMatch && (
                  <View style={styles.recordItem}>
                    <Ionicons name="locate" size={20} color={theme.colors.error} />
                    <ThemedText variant="caption">Best Hit Rate</ThemedText>
                    <ThemedText variant="body" color="error">{personalRecords.bestHitRateMatch.value}%</ThemedText>
                  </View>
                )}
                {personalRecords.bestCatchRateMatch && (
                  <View style={styles.recordItem}>
                    <Ionicons name="hand-left" size={20} color={theme.colors.success} />
                    <ThemedText variant="caption">Best Catch Rate</ThemedText>
                    <ThemedText variant="body" color="success">{personalRecords.bestCatchRateMatch.value}%</ThemedText>
                  </View>
                )}
                {personalRecords.fastestWin && (
                  <View style={styles.recordItem}>
                    <Ionicons name="flash" size={20} color={theme.colors.warning} />
                    <ThemedText variant="caption">Fastest Win</ThemedText>
                    <ThemedText variant="body" color="warning">
                      {Math.floor(personalRecords.fastestWin.durationSeconds / 60)}:{String(personalRecords.fastestWin.durationSeconds % 60).padStart(2, '0')}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
          </ThemedView>
        )}

        {/* Head-to-Head Stats */}
        {!loadingRelationshipStats && headToHeadStats.length > 0 && (
          <ThemedView variant="card" style={styles.relationshipCard}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="subtitle" style={styles.sectionTitle}>
                Head-to-Head Records
              </ThemedText>
              <ThemedText variant="caption" style={{ marginBottom: 8 }}>
                Your record against opponents
              </ThemedText>
            </View>
            
            {(showAllOpponents ? headToHeadStats : headToHeadStats.slice(0, 3)).map((h2h, index) => (
              <TouchableOpacity 
                key={h2h.opponent.odId}
                style={styles.playerRelationshipRow}
                onPress={() => h2h.opponent.isRegisteredUser && router.push(`/user-profile/${h2h.opponent.odId}`)}
                activeOpacity={h2h.opponent.isRegisteredUser ? 0.7 : 1}
              >
                <View style={[
                  styles.playerAvatar,
                  { backgroundColor: h2h.opponent.avatarBackgroundColor || theme.colors.primary }
                ]}>
                  <Ionicons 
                    name={(h2h.opponent.avatarIcon as keyof typeof Ionicons.glyphMap) || 'person'} 
                    size={20} 
                    color={h2h.opponent.avatarIconColor || '#fff'} 
                  />
                </View>
                <View style={styles.playerInfo}>
                  <ThemedText variant="body" style={styles.playerName}>
                    {h2h.opponent.name}
                    {!h2h.opponent.isRegisteredUser && <ThemedText variant="caption"> (Guest)</ThemedText>}
                  </ThemedText>
                  <View style={styles.recordContainer}>
                    <ThemedText variant="caption" color="success">{h2h.wins}W</ThemedText>
                    <ThemedText variant="caption"> - </ThemedText>
                    <ThemedText variant="caption" color="error">{h2h.losses}L</ThemedText>
                    <ThemedText variant="caption" style={{ marginLeft: 8 }}>
                      ({h2h.winRate.toFixed(0)}%)
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.streakIndicator}>
                  {h2h.currentStreak !== 0 && (
                    <View style={[
                      styles.miniStreakBadge,
                      h2h.currentStreak > 0 ? styles.winStreakMini : styles.lossStreakMini
                    ]}>
                      <ThemedText variant="caption" style={styles.miniStreakText}>
                        {h2h.currentStreak > 0 ? `${h2h.currentStreak}🔥` : `${Math.abs(h2h.currentStreak)}❄️`}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            
            {headToHeadStats.length > 3 && (
              <TouchableOpacity 
                style={styles.showMoreButton}
                onPress={() => setShowAllOpponents(!showAllOpponents)}
              >
                <ThemedText variant="body" color="primary">
                  {showAllOpponents ? 'Show Less' : `Show All (${headToHeadStats.length})`}
                </ThemedText>
                <Ionicons 
                  name={showAllOpponents ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color={theme.colors.primary} 
                />
              </TouchableOpacity>
            )}
          </ThemedView>
        )}

        {/* Teammate Stats */}
        {!loadingRelationshipStats && teammateStats.length > 0 && (
          <ThemedView variant="card" style={styles.relationshipCard}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="subtitle" style={styles.sectionTitle}>
                Teammate Records
              </ThemedText>
              <ThemedText variant="caption" style={{ marginBottom: 8 }}>
                Your record with partners
              </ThemedText>
            </View>
            
            {(showAllTeammates ? teammateStats : teammateStats.slice(0, 3)).map((tm, index) => (
              <TouchableOpacity 
                key={tm.teammate.odId}
                style={styles.playerRelationshipRow}
                onPress={() => tm.teammate.isRegisteredUser && router.push(`/user-profile/${tm.teammate.odId}`)}
                activeOpacity={tm.teammate.isRegisteredUser ? 0.7 : 1}
              >
                <View style={[
                  styles.playerAvatar,
                  { backgroundColor: tm.teammate.avatarBackgroundColor || theme.colors.success }
                ]}>
                  <Ionicons 
                    name={(tm.teammate.avatarIcon as keyof typeof Ionicons.glyphMap) || 'person'} 
                    size={20} 
                    color={tm.teammate.avatarIconColor || '#fff'} 
                  />
                </View>
                <View style={styles.playerInfo}>
                  <ThemedText variant="body" style={styles.playerName}>
                    {tm.teammate.name}
                    {!tm.teammate.isRegisteredUser && <ThemedText variant="caption"> (Guest)</ThemedText>}
                  </ThemedText>
                  <View style={styles.recordContainer}>
                    <ThemedText variant="caption" color="success">{tm.wins}W</ThemedText>
                    <ThemedText variant="caption"> - </ThemedText>
                    <ThemedText variant="caption" color="error">{tm.losses}L</ThemedText>
                    <ThemedText variant="caption" style={{ marginLeft: 8 }}>
                      ({tm.winRate.toFixed(0)}% WR)
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.teammateExtra}>
                  <ThemedText variant="caption">Avg Score</ThemedText>
                  <ThemedText variant="body" color="primary">{tm.avgCombinedScore.toFixed(1)}</ThemedText>
                </View>
              </TouchableOpacity>
            ))}
            
            {teammateStats.length > 3 && (
              <TouchableOpacity 
                style={styles.showMoreButton}
                onPress={() => setShowAllTeammates(!showAllTeammates)}
              >
                <ThemedText variant="body" color="primary">
                  {showAllTeammates ? 'Show Less' : `Show All (${teammateStats.length})`}
                </ThemedText>
                <Ionicons 
                  name={showAllTeammates ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color={theme.colors.primary} 
                />
              </TouchableOpacity>
            )}
          </ThemedView>
        )}

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

        {/* Schlevins Button */}
        <ThemedView variant="card" style={styles.schlevinsCard}>
          <TouchableOpacity
            style={styles.schlevinsButton}
            onPress={() => router.push('/schlevins')}
            activeOpacity={0.8}
          >
            <Ionicons name="dice" size={24} color={theme.colors.primary} />
            <ThemedText variant="subtitle" style={styles.schlevinsTitle}>
              Schlevins
            </ThemedText>
            <ThemedText variant="caption" style={styles.schlevinsDescription}>
              Play the classic dice game
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 12,
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
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    marginBottom: 20,
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
    backgroundColor: theme.colors.success,
  },
  lossForm: {
    backgroundColor: theme.colors.error,
  },
  drawForm: {
    backgroundColor: theme.colors.warning,
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
    borderBottomColor: theme.colors.border,
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
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.border,
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
  playerStatsSection: {
    marginBottom: 16,
  },
  playerStatsContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.backgroundTertiary,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: theme.colors.text,
  },
  playerStatsList: {
    gap: 10,
  },
  playerStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  schlevinsCard: {
    marginBottom: 20,
  },
  schlevinsButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  schlevinsTitle: {
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
  },
  schlevinsDescription: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 12,
  },
  // Streak & Records styles
  streakCard: {
    marginBottom: 16,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  winStreakBadge: {
    backgroundColor: theme.colors.success,
  },
  lossStreakBadge: {
    backgroundColor: theme.colors.error,
  },
  neutralStreakBadge: {
    backgroundColor: theme.colors.textSecondary,
  },
  streakNumber: {
    color: theme.colors.textOnPrimary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  streakLabel: {
    color: theme.colors.textOnPrimary,
    fontSize: 10,
    textAlign: 'center',
  },
  streakStats: {
    flex: 1,
    gap: 8,
  },
  streakStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  recordItem: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: 12,
    gap: 4,
  },
  // Relationship stats styles
  relationshipCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  playerRelationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  recordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIndicator: {
    alignItems: 'flex-end',
  },
  miniStreakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winStreakMini: {
    backgroundColor: theme.colors.successBackground,
  },
  lossStreakMini: {
    backgroundColor: theme.colors.errorBackground,
  },
  miniStreakText: {
    fontSize: 12,
    fontWeight: '600',
  },
  teammateExtra: {
    alignItems: 'center',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
});
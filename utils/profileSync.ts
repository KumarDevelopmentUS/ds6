// utils/profileSync.ts
import { supabase } from '@/supabase';

export interface ProfileData {
  username?: string;
  nickname?: string;
  school?: string;
}

export interface UserStats {
  totalMatches: number;
  totalWins: number;
  winRate: number;
  totalThrows: number;
  totalHits: number;
  hitRate: number;
  totalCatches: number;
  totalCatchAttempts: number;
  catchRate: number;
  totalFifaSuccess: number;
  totalFifaAttempts: number;
  fifaRate: number;
  averageRanking: number;
}

/**
 * Calculate comprehensive user stats from saved_matches
 */
export const calculateUserStats = async (userId: string): Promise<UserStats> => {
  try {
    // Get all matches where user was a player
    const { data: allMatches, error } = await supabase
      .from('saved_matches')
      .select('*');

    if (error) throw error;

    // Filter matches where user was a player
    const matches = (allMatches || []).filter(match => {
      if (!match.userSlotMap) return false;
      
      const userSlot = Object.entries(match.userSlotMap).find(
        ([_, id]) => id === userId
      );
      
      return userSlot !== undefined;
    });

    if (matches.length === 0) {
      return {
        totalMatches: 0,
        totalWins: 0,
        winRate: 0,
        totalThrows: 0,
        totalHits: 0,
        hitRate: 0,
        totalCatches: 0,
        totalCatchAttempts: 0,
        catchRate: 0,
        totalFifaSuccess: 0,
        totalFifaAttempts: 0,
        fifaRate: 0,
        averageRanking: 0,
      };
    }

    // Calculate stats
    let totalMatches = 0;
    let totalWins = 0;
    let totalThrows = 0;
    let totalHits = 0;
    let totalCatches = 0;
    let totalCatchAttempts = 0;
    let totalFifaSuccess = 0;
    let totalFifaAttempts = 0;

    matches.forEach(match => {
      const userSlot = Object.entries(match.userSlotMap || {}).find(
        ([_, id]) => id === userId
      )?.[0];

      if (userSlot) {
        totalMatches++;
        const playerSlot = parseInt(userSlot);
        const userTeam = playerSlot <= 2 ? 1 : 2;

        // Check if user's team won
        if (match.winnerTeam === userTeam) {
          totalWins++;
        }

        // Get user's player stats
        const userPlayerStats = match.playerStats[playerSlot];
        if (userPlayerStats) {
          totalThrows += userPlayerStats.throws || 0;
          totalHits += userPlayerStats.hits || 0;
          totalCatches += userPlayerStats.catches || 0;
          totalFifaSuccess += userPlayerStats.fifaSuccess || 0;
          totalFifaAttempts += userPlayerStats.fifaAttempts || 0;

          // Calculate catch attempts
          const catchAttempts = (userPlayerStats.catches || 0) + 
                                (userPlayerStats.drop || 0) + 
                                (userPlayerStats.miss || 0) + 
                                (userPlayerStats.twoHands || 0) + 
                                (userPlayerStats.body || 0);
          totalCatchAttempts += catchAttempts;
        }
      }
    });

    // Calculate rates
    const hitRate = totalThrows > 0 ? (totalHits / totalThrows) * 100 : 0;
    const catchRate = totalCatchAttempts > 0 ? (totalCatches / totalCatchAttempts) * 100 : 0;
    const fifaRate = totalFifaAttempts > 0 ? (totalFifaSuccess / totalFifaAttempts) * 100 : 0;

    // Calculate average ranking (same formula as stats page)
    const hitRateDecimal = hitRate / 100;
    const catchRateDecimal = catchRate / 100;
    const fifaRateDecimal = fifaRate / 100;
    const averageRate = (hitRateDecimal + catchRateDecimal) / 2;
    const averageRanking = Math.round(((0.85 * averageRate) + (0.10 * fifaRateDecimal)) / 0.95 * 100);

    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

    return {
      totalMatches,
      totalWins,
      winRate,
      totalThrows,
      totalHits,
      hitRate,
      totalCatches,
      totalCatchAttempts,
      catchRate,
      totalFifaSuccess,
      totalFifaAttempts,
      fifaRate,
      averageRanking,
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    throw error;
  }
};

/**
 * Update a single user's stats in the user_profiles table
 */
export const updateUserStats = async (userId: string, stats: UserStats): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        total_matches_played: stats.totalMatches,
        total_wins: stats.totalWins,
        total_throws: stats.totalThrows,
        total_hits: stats.totalHits,
        average_rating: stats.averageRanking,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
    console.log(`Updated stats for user ${userId}:`, stats);
  } catch (error) {
    console.error(`Error updating stats for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Update all existing user profiles with their historical stats
 */
export const updateAllUserProfilesWithStats = async (): Promise<void> => {
  try {
    console.log('Starting bulk update of all user profiles with historical stats...');
    
    // Get all users from user_profiles table
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, username');

    if (usersError) throw usersError;

    console.log(`Found ${users.length} users to update`);

    let successCount = 0;
    let errorCount = 0;

    // Process users in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (user) => {
        try {
          const stats = await calculateUserStats(user.id);
          await updateUserStats(user.id, stats);
          return { success: true, userId: user.id, username: user.username };
        } catch (error) {
          console.error(`Failed to update user ${user.username} (${user.id}):`, error);
          return { success: false, userId: user.id, username: user.username, error };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      });

      // Small delay between batches to be nice to the database
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Bulk update completed!`);
    console.log(`✅ Successfully updated: ${successCount} users`);
    console.log(`❌ Failed to update: ${errorCount} users`);
    
    if (errorCount > 0) {
      console.warn(`${errorCount} users failed to update. Check the logs above for details.`);
    }
  } catch (error) {
    console.error('Error during bulk update:', error);
    throw error;
  }
};

/**
 * Update stats for a specific user (useful after match completion)
 */
export const updateUserStatsAfterMatch = async (userId: string): Promise<void> => {
  try {
    const stats = await calculateUserStats(userId);
    await updateUserStats(userId, stats);
  } catch (error) {
    console.error('Error updating user stats after match:', error);
    throw error;
  }
};

/**
 * Get user stats from user_profiles table (fast access)
 */
export const getUserStatsFromProfile = async (userId: string): Promise<Partial<UserStats> | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('total_matches_played, total_wins, total_throws, total_hits, average_rating')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const totalMatches = data.total_matches_played || 0;
    const totalWins = data.total_wins || 0;
    const totalThrows = data.total_throws || 0;
    const totalHits = data.total_hits || 0;
    
    // Calculate derived stats from stored data
    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;
    const hitRate = totalThrows > 0 ? (totalHits / totalThrows) * 100 : 0;

    return {
      totalMatches,
      totalWins,
      winRate,
      totalThrows,
      totalHits,
      hitRate,
      // These aren't stored in user_profiles yet, will be calculated if needed
      totalCatches: 0,
      totalCatchAttempts: 0,
      catchRate: 0,
      totalFifaSuccess: 0,
      totalFifaAttempts: 0,
      fifaRate: 0,
      averageRanking: data.average_rating || 0,
    };
  } catch (error) {
    console.error('Error getting user stats from profile:', error);
    return null;
  }
};

/**
 * Hybrid approach: Try to get stats from profile first, fallback to calculation
 */
export const getUserStatsHybrid = async (userId: string): Promise<UserStats> => {
  try {
    // First try to get stats from user_profiles table (fast)
    const profileStats = await getUserStatsFromProfile(userId);
    
    if (profileStats && profileStats.totalMatches && profileStats.totalMatches > 0) {
      // We have stored stats with the core data, use them for performance
      console.log(`✅ Using stored stats for user ${userId}: ${profileStats.totalMatches} matches`);
      
      // If we need more detailed stats (catch/fifa), calculate those separately
      // For now, return the stored stats with some calculated fields
      return {
        totalMatches: profileStats.totalMatches,
        totalWins: profileStats.totalWins!,
        winRate: profileStats.winRate!,
        totalThrows: profileStats.totalThrows!,
        totalHits: profileStats.totalHits!,
        hitRate: profileStats.hitRate!,
        // These will need to be calculated from matches for detailed view
        totalCatches: 0,
        totalCatchAttempts: 0,
        catchRate: 0,
        totalFifaSuccess: 0,
        totalFifaAttempts: 0,
        fifaRate: 0,
        averageRanking: profileStats.averageRanking!,
      } as UserStats;
    } else {
      // No stored stats, calculate them (slower but complete)
      console.log(`❌ No stored stats found for user ${userId}, calculating from matches...`);
      const calculatedStats = await calculateUserStats(userId);
      
      // Store the calculated stats for future use
      try {
        await updateUserStats(userId, calculatedStats);
        console.log(`✅ Stored calculated stats for user ${userId}`);
      } catch (storeError) {
        console.warn(`⚠️ Failed to store calculated stats for user ${userId}:`, storeError);
      }
      
      return calculatedStats;
    }
  } catch (error) {
    console.error('Error in hybrid stats approach:', error);
    // Fallback to calculation
    return await calculateUserStats(userId);
  }
};

// Debug function to check user's current community memberships
export async function debugUserCommunities() {
  console.log('🔍 COMMUNITY DEBUG: Checking user community memberships...');
  
  try {
    // Always get current user from auth
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.error('❌ No authenticated user found');
      return false;
    }
    
    console.log('👤 Checking communities for user:', user.id);
    
    // Check user_communities table
    const { data: userCommunities, error: ucError } = await supabase
      .from('user_communities')
      .select('*, communities(*)')
      .eq('user_id', user.id);
    
    console.log('📥 User communities query result:', {
      count: userCommunities?.length || 0,
      hasError: !!ucError,
      errorMessage: ucError?.message,
    });
    
    // Log each community individually for clarity
    if (userCommunities && userCommunities.length > 0) {
      console.log('🏘️ Your communities:');
      userCommunities.forEach((uc, index) => {
        console.log(`  ${index + 1}. ${uc.communities?.name} (ID: ${uc.community_id}, Type: ${uc.communities?.type})`);
      });
    } else {
      console.log('❌ No communities found for user');
    }
    
    // Check all communities
    const { data: allCommunities, error: allError } = await supabase
      .from('communities')
      .select('*')
      .order('name');
    
    console.log('📋 All available communities:', {
      count: allCommunities?.length || 0,
      hasError: !!allError,
      communities: allCommunities?.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      }))
    });
    
    return true;
  } catch (error) {
    console.error('❌ Community debug failed:', error);
    return false;
  }
}

// Debug function to test what FeedProvider sees
export async function debugFeedProvider() {
  console.log('🔍 FEED DEBUG: Testing what FeedProvider sees...');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ No authenticated user found');
      return false;
    }
    
    // This is the EXACT query that useUserCommunities uses
    const { data, error } = await supabase
      .from('user_communities')
      .select('*, communities(*)')
      .eq('user_id', user.id);
    
    console.log('📥 FeedProvider query result:', {
      hasError: !!error,
      errorMessage: error?.message,
      dataLength: data?.length || 0,
      rawData: data
    });
    
    if (data && data.length > 0) {
      console.log('🏘️ FeedProvider communities:');
      data.forEach((uc, index) => {
        console.log(`  ${index + 1}. ${uc.communities?.name} (ID: ${uc.communities?.id})`);
      });
    } else {
      console.log('❌ FeedProvider found no communities');
    }
    
    return true;
  } catch (error) {
    console.error('❌ FeedProvider debug failed:', error);
    return false;
  }
}

// Debug RLS policies and permissions
export async function debugRLSPolicies() {
  console.log('🔐 RLS DEBUG: Checking Row Level Security policies...');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ No authenticated user found');
      return false;
    }
    
    console.log('👤 Current user:', user.id);
    
    // Test 1: Try to read user_communities with detailed error info
    console.log('🔍 TEST 1: Reading user_communities...');
    const { data: ucData, error: ucError } = await supabase
      .from('user_communities')
      .select('*')
      .eq('user_id', user.id);
    
    console.log('📥 user_communities result:', {
      success: !ucError,
      dataCount: ucData?.length || 0,
      error: ucError,
      errorMessage: ucError?.message,
      errorCode: ucError?.code,
      errorDetails: ucError?.details,
      errorHint: ucError?.hint
    });
    
    // Test 2: Try to read user_communities without WHERE clause (should fail if RLS is enabled)
    console.log('🔍 TEST 2: Reading all user_communities (should fail with RLS)...');
    const { data: allUC, error: allUCError } = await supabase
      .from('user_communities')
      .select('*')
      .limit(1);
    
    console.log('📥 All user_communities result:', {
      success: !allUCError,
      dataCount: allUC?.length || 0,
      error: allUCError?.message,
      errorCode: allUCError?.code
    });
    
    // Test 3: Check if we can read communities table
    console.log('🔍 TEST 3: Reading communities table...');
    const { data: communities, error: commError } = await supabase
      .from('communities')
      .select('*')
      .limit(5);
    
    console.log('📥 Communities result:', {
      success: !commError,
      dataCount: communities?.length || 0,
      error: commError?.message
    });
    
    // Test 4: Try a direct INSERT to user_communities (to test INSERT policy)
    console.log('🔍 TEST 4: Testing INSERT policy...');
    const testCommunityId = communities?.[0]?.id;
    if (testCommunityId) {
      const { data: insertData, error: insertError } = await supabase
        .from('user_communities')
        .insert({
          user_id: user.id,
          community_id: testCommunityId
        })
        .select();
      
      console.log('📥 INSERT test result:', {
        success: !insertError,
        error: insertError?.message,
        errorCode: insertError?.code,
        insertedData: insertData
      });
      
      // Clean up test insert if it succeeded
      if (insertData && insertData.length > 0) {
        await supabase
          .from('user_communities')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Cleaned up test insert');
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ RLS debug failed:', error);
    return false;
  }
}

// Force refresh FeedProvider cache
export async function refreshFeedCache() {
  console.log('🔄 CACHE REFRESH: Forcing FeedProvider cache refresh...');
  
  try {
    // For web, trigger a page refresh to clear all React Query cache
    if (typeof window !== 'undefined') {
      console.log('🔄 Triggering page refresh to clear React Query cache...');
      window.location.reload();
      return true;
    }
    
    // For mobile, we could try to access the queryClient directly, but page refresh is simpler
    console.log('✅ Cache refresh initiated');
    return true;
  } catch (error) {
    console.error('❌ Cache refresh failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Force refetch FeedProvider data specifically
export async function forceFeedRefetch() {
  console.log('🔄 FEED REFETCH: Forcing FeedProvider to refetch data...');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ No authenticated user found');
      return false;
    }
    
    // Perform the exact same query as useUserCommunities
    console.log('🔍 FEED REFETCH: Performing fresh query...');
    const { data, error } = await supabase
      .from('user_communities')
      .select('*, communities(*)')
      .eq('user_id', user.id);
    
    console.log('📥 FEED REFETCH: Fresh query results:', {
      success: !error,
      error: error?.message,
      dataCount: data?.length || 0,
      rawData: data
    });
    
    if (data && data.length > 0) {
      console.log('🏘️ FEED REFETCH: Fresh communities found:');
      data.forEach((uc, index) => {
        console.log(`  ${index + 1}. ${uc.communities?.name} (Community ID: ${uc.communities?.id}, Membership ID: ${uc.id})`);
      });
    }
    
    return { success: true, data, count: data?.length || 0 };
  } catch (error) {
    console.error('❌ Feed refetch failed:', error);
    return { success: false, error };
  }
}

// Manual function to join a community for testing
export async function joinCommunityManually(communityName: string, communityType: 'school' | 'general' = 'general') {
  console.log('🏘️ MANUAL JOIN: Attempting to join community:', communityName);
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ No authenticated user found');
      return false;
    }
    
    console.log('👤 User ID:', user.id);
    
    // Find or create the community
    let { data: community, error: findError } = await supabase
      .from('communities')
      .select('*')
      .eq('name', communityName)
      .eq('type', communityType)
      .single();
    
    if (findError && findError.code === 'PGRST116') {
      // Community doesn't exist, create it
      console.log('📝 Creating new community:', communityName);
      const { data: newCommunity, error: createError } = await supabase
        .from('communities')
        .insert({
          name: communityName,
          type: communityType,
          description: `${communityType} community for ${communityName}`
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Failed to create community:', createError);
        return false;
      }
      
      community = newCommunity;
      console.log('✅ Community created:', community);
    } else if (findError) {
      console.error('❌ Error finding community:', findError);
      return false;
    } else {
      console.log('✅ Found existing community:', community);
    }
    
    // Check if user is already a member
    const { data: existingMembership, error: membershipError } = await supabase
      .from('user_communities')
      .select('*')
      .eq('user_id', user.id)
      .eq('community_id', community.id)
      .single();
    
    if (existingMembership) {
      console.log('✅ User is already a member of this community');
      return true;
    }
    
    // Join the community
    console.log('📝 Adding user to community...');
    const { data: membership, error: joinError } = await supabase
      .from('user_communities')
      .insert({
        user_id: user.id,
        community_id: community.id
      })
      .select()
      .single();
    
    if (joinError) {
      console.error('❌ Failed to join community:', joinError);
      return false;
    }
    
    console.log('✅ Successfully joined community:', membership);
    
    // Force refresh of community data by triggering a window reload
    console.log('🔄 Refreshing community data...');
    
    // For web, we can trigger a page refresh to clear all caches
    if (typeof window !== 'undefined') {
      console.log('🔄 Triggering page refresh to update cache...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Manual join failed:', error);
    return false;
  }
}

// Test function to verify database connection and operations
export async function testDatabaseConnection() {
  console.log('🧪 DATABASE TEST: Starting comprehensive database test...');
  
  // Check environment variables
  console.log('🔍 ENV CHECK: Verifying environment variables...');
  console.log('📊 Environment:', {
    hasSupabaseUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrlLength: process.env.EXPO_PUBLIC_SUPABASE_URL?.length,
    supabaseKeyLength: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length
  });
  
  try {
    // Test 1: Basic connection
    console.log('🔍 TEST 1: Testing basic connection...');
    const { data: connTest, error: connError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    console.log('📥 Connection test:', { success: !connError, error: connError?.message });
    
    // Test 2: Check auth user
    console.log('🔍 TEST 2: Testing current auth user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('📥 Current user:', { 
      hasUser: !!user, 
      userId: user?.id, 
      email: user?.email,
      error: userError?.message 
    });
    
    // Test 3: Count existing records
    console.log('🔍 TEST 3: Counting existing records...');
    const { count: profilesCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    const { count: userProfilesCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });
    
    const { count: communitiesCount } = await supabase
      .from('communities')
      .select('*', { count: 'exact', head: true });
    
    console.log('📊 Record counts:', {
      profiles: profilesCount,
      user_profiles: userProfilesCount,
      communities: communitiesCount
    });
    
    console.log('✅ Database test completed');
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

// Debug function to log profile sync status
export async function debugProfileStatus(userId: string) {
  console.log('🔍 Debug: Checking profile status for user:', userId);
  
  try {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log('📊 user_profiles exists:', !!userProfile);
    console.log('📊 profiles exists:', !!profile);
  } catch (error) {
    console.error('❌ Debug profile status error:', error);
  }
}

export async function ensureUserProfilesExist(userId: string, userData?: ProfileData) {
  console.log('🔄 PROFILE SYNC: Starting profile sync for user:', userId);
  console.log('📋 PROFILE SYNC: Profile data:', userData);

  try {
    // Step 1: Ensure profiles table record exists
    const { data: existingProfile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileFetchError && profileFetchError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log('🔄 PROFILE SYNC: Creating profiles record...');
      const { error: profileInsertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          user_id: userId,
          nickname: userData?.nickname || 'Player',
          school: userData?.school || null,
          avatar_icon: 'person',
          avatar_icon_color: '#FFFFFF',
          avatar_background_color: '#007AFF',
        });

      if (profileInsertError) {
        console.error('❌ PROFILE SYNC: Error creating profiles record:', profileInsertError);
        throw profileInsertError;
      }
      console.log('✅ PROFILE SYNC: Created profiles record');
    } else if (profileFetchError) {
      console.error('❌ PROFILE SYNC: Error fetching profiles record:', profileFetchError);
      throw profileFetchError;
    } else {
      console.log('✅ PROFILE SYNC: Profiles record already exists');
    }

    // Step 2: Ensure user_profiles table record exists
    const { data: existingUserProfile, error: userProfileFetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userProfileFetchError && userProfileFetchError.code === 'PGRST116') {
      // User profile doesn't exist, create it
      console.log('🔄 PROFILE SYNC: Creating user_profiles record...');
      const { error: userProfileInsertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          username: userData?.username || 'user' + Date.now(),
          display_name: userData?.nickname || 'Player',
        });

      if (userProfileInsertError) {
        console.error('❌ PROFILE SYNC: Error creating user_profiles record:', userProfileInsertError);
        throw userProfileInsertError;
      }
      console.log('✅ PROFILE SYNC: Created user_profiles record');
    } else if (userProfileFetchError) {
      console.error('❌ PROFILE SYNC: Error fetching user_profiles record:', userProfileFetchError);
      throw userProfileFetchError;
    } else {
      console.log('✅ PROFILE SYNC: User_profiles record already exists');
    }

    console.log('🎉 PROFILE SYNC: Profile sync completed successfully');
    return { success: true, message: 'Profile sync completed' };

  } catch (error) {
    console.error('💥 PROFILE SYNC: Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function joinDefaultCommunity(userId: string) {
  console.log('🏘️ COMMUNITY DEBUG: Starting joinDefaultCommunity for user:', userId);

  try {
    // First, check if user is already in any community
    const { data: existingMembership, error: membershipError } = await supabase
      .from('user_communities')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (membershipError) {
      console.error('❌ COMMUNITY DEBUG: Error checking existing membership:', membershipError);
    } else if (existingMembership && existingMembership.length > 0) {
      console.log('✅ COMMUNITY DEBUG: User already has community membership');
      return { success: true, message: 'User already in a community' };
    }

    // Use the specific General community (ID 1) instead of searching by name
    const defaultCommunityId = 1; // This is the original "General" community
    
    console.log('🔄 COMMUNITY DEBUG: Adding user to General community (ID 1)...');
    const { error: joinError } = await supabase
      .from('user_communities')
      .insert({
        user_id: userId,
        community_id: defaultCommunityId,
      });

    if (joinError) {
      // Check if it's a duplicate key error (user already joined)
      if (joinError.code === '23505') {
        console.log('✅ COMMUNITY DEBUG: User already in community (duplicate ignored)');
        return { success: true, message: 'User already in community' };
      }
      console.error('❌ COMMUNITY DEBUG: Error joining community:', joinError);
      throw joinError;
    }

    console.log('🎉 COMMUNITY DEBUG: Successfully joined General community (ID 1)!');
    return { success: true, message: 'Joined General community' };

  } catch (error) {
    console.error('💥 COMMUNITY DEBUG: Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Also add a function to manually fix existing users
export const fixUserCommunityMembership = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No authenticated user');
    return;
  }

  console.log('🔧 Fixing community membership for current user...');
  const result = await joinDefaultCommunity(user.id);
  console.log('Fix result:', result);
  return result;
};
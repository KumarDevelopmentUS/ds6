// utils/profileSync.ts
import { generateRandomAvatar } from '../constants/avatarIcons';
import { supabase } from '../supabase';

export interface ProfileData {
  username?: string;
  nickname?: string;
  firstName?: string;
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

    // Calculate average ranking: 45% throw + 45% catch + 15% FIFA (max 105%)
    const hitRateDecimal = hitRate / 100;
    const catchRateDecimal = catchRate / 100;
    const fifaRateDecimal = fifaRate / 100;
    const baseScore = (0.45 * hitRateDecimal + 0.45 * catchRateDecimal + 0.15 * fifaRateDecimal) * 100;
    const averageRanking = Math.round(Math.min(105, baseScore));

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
  } catch (error) {
    console.error('Error updating user stats:', error);
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
      
      const calculatedStats = await calculateUserStats(userId);
      
      // Store the calculated stats for future use
      try {
        await updateUserStats(userId, calculatedStats);

      } catch (storeError) {
        console.warn('⚠️ Failed to store calculated stats:', storeError);
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
  
  
  try {
    // Always get current user from auth
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.error('❌ No authenticated user found');
      return false;
    }
    
    // Get username for logging
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    
    const username = userProfile?.username || 'unknown';
    console.log('👤 Checking user communities...');
    
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
    
    // Check all communities
    const { data: allCommunities, error: allError } = await supabase
      .from('communities')
      .select('*')
      .order('name');
    
    return true;
  } catch (error) {
    console.error('❌ Community debug failed:', error);
    return false;
  }
}

// Debug function to test what FeedProvider sees
export async function debugFeedProvider() {

  
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
    
          if (data && data.length > 0) {
        // FeedProvider found communities
      } else {
        // FeedProvider found no communities
      }
    
    return true;
  } catch (error) {
    console.error('❌ FeedProvider debug failed:', error);
    return false;
  }
}

export async function ensureUserProfilesExist(userId: string, userData?: ProfileData) {
  console.log('🔄 PROFILE SYNC: Starting profile sync for user:', userId);
  console.log('📋 PROFILE SYNC: Processing profile data:', userData);

  try {
    // Check if user_profiles record exists
    const { data: existingUserProfile, error: userProfileFetchError } = await supabase
      .from('user_profiles')
      .select('id, username, nickname, first_name, school')
      .eq('id', userId)
      .single();

    if (userProfileFetchError && userProfileFetchError.code === 'PGRST116') {
      // User profile doesn't exist, create it with all fields
      console.log('🔄 PROFILE SYNC: Creating unified user_profiles record...');
      
      // Generate a unique username if needed
      let finalUsername = userData?.username;
      if (!finalUsername) {
        finalUsername = 'user' + Date.now();
      } else {
        // Check if the desired username is already taken
        const { data: existingUsernameProfile, error: usernameCheckError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', finalUsername.toLowerCase())
          .single();

        if (!usernameCheckError && existingUsernameProfile) {
          // Username is taken, generate a unique one
          console.log('⚠️ PROFILE SYNC: Username already taken, generating unique username...');
          finalUsername = finalUsername + '_' + Date.now();
        }
      }

      // Set first_name, display_name, and nickname all to the same value on signup
      // The firstName field from signup contains the user's actual first name
      const initialName = userData?.firstName || userData?.nickname || 'Player';
      
      const randomAvatar = generateRandomAvatar();
      const { error: userProfileInsertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          username: finalUsername.toLowerCase(),
          first_name: initialName,    // Never changes after signup
          nickname: initialName,      // Can be updated by user
          school: userData?.school || null,
          ...randomAvatar,
        });

      if (userProfileInsertError) {
        console.error('❌ PROFILE SYNC: Error creating user_profiles record:', userProfileInsertError);
        
        // If it's a unique constraint violation, try with a different username
        if (userProfileInsertError.code === '23505' && userProfileInsertError.message.includes('username')) {
          console.log('🔄 PROFILE SYNC: Username conflict detected, retrying with unique username...');
          const uniqueUsername = 'user' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          
          const { error: retryError } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              username: uniqueUsername,
              nickname: userData?.nickname || 'Player',
              first_name: userData?.firstName || userData?.nickname || 'Player',
              school: userData?.school || null,
              ...randomAvatar,
            });

          if (retryError) {
            console.error('❌ PROFILE SYNC: Retry failed:', retryError);
            throw retryError;
          }
          
          console.log('✅ PROFILE SYNC: Created unified user_profiles record with unique username:', uniqueUsername);
        } else {
          throw userProfileInsertError;
        }
      } else {
        console.log('✅ PROFILE SYNC: Created unified user_profiles record with username:', finalUsername);
      }
    } else if (userProfileFetchError) {
      console.error('❌ PROFILE SYNC: Error fetching user_profiles record:', userProfileFetchError);
      throw userProfileFetchError;
    } else {
      console.log('✅ PROFILE SYNC: User_profiles record already exists with username:', existingUserProfile.username);
      
      // If profile exists but has no username, update it
      if (!existingUserProfile.username && userData?.username) {
        console.log('🔄 PROFILE SYNC: Updating existing profile with username...');
        
        // Check if the desired username is available
        let finalUsername = userData.username;
        const { data: existingUsernameProfile, error: usernameCheckError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', finalUsername.toLowerCase())
          .neq('id', userId) // Exclude current user
          .single();

        if (!usernameCheckError && existingUsernameProfile) {
          // Username is taken, generate a unique one
          console.log('⚠️ PROFILE SYNC: Username already taken, generating unique username...');
          finalUsername = finalUsername + '_' + Date.now();
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            username: finalUsername.toLowerCase(),
            nickname: userData.nickname || existingUserProfile.nickname || 'Player',
            first_name: userData.firstName || userData.nickname || existingUserProfile.first_name || 'Player',
            school: userData.school || existingUserProfile.school,
          })
          .eq('id', userId);

        if (updateError) {
          console.error('❌ PROFILE SYNC: Error updating profile:', updateError);
          throw updateError;
        }
        
        console.log('✅ PROFILE SYNC: Updated profile with username:', finalUsername);
      }
    }

    console.log('🎉 PROFILE SYNC: Profile sync completed successfully');
    return { success: true, message: 'Profile sync completed' };

  } catch (error) {
    console.error('💥 PROFILE SYNC: Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function joinDefaultCommunity(userId: string) {

  try {
    // Check if user is already in the General community specifically (ID 1)
    const { data: generalMembership, error: membershipError } = await supabase
      .from('user_communities')
      .select('id')
      .eq('user_id', userId)
      .eq('community_id', 1); // Check specifically for General community

    if (membershipError) {
      console.error('Error checking General community membership:', membershipError);
    } else if (generalMembership && generalMembership.length > 0) {
      return { success: true, message: 'User already in General community' };
    }

    // Use the specific General community (ID 1) instead of searching by name
    const defaultCommunityId = 1; // This is the original "General" community
    const { error: joinError } = await supabase
      .from('user_communities')
      .insert({
        user_id: userId,
        community_id: defaultCommunityId,
      });

    if (joinError) {
      // Check if it's a duplicate key error (user already joined)
      if (joinError.code === '23505') {
        return { success: true, message: 'User already in community' };
      }
      console.error('Error joining community:', joinError);
      throw joinError;
    }

    return { success: true, message: 'Joined General community' };

  } catch (error) {
    console.error('Unexpected error joining community:', error);
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

// Check if user is in the General community
export const isUserInGeneralCommunity = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_communities')
      .select('id')
      .eq('user_id', userId)
      .eq('community_id', 1) // General community ID
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking General community membership:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('❌ Error checking General community membership:', error);
    return false;
  }
};

// Join General community function for manual use
export const joinGeneralCommunity = async (userId: string) => {
  return await joinDefaultCommunity(userId);
};

// Function to handle school community changes when profile is updated
export const handleSchoolCommunityChange = async (
  userId: string, 
  newSchool: string | null, 
  oldSchool?: string | null
): Promise<{ success: boolean; error?: string; addedCommunity?: string }> => {
  try {
    // If no new school is set, nothing to do
    if (!newSchool) {
      return { success: true };
    }

    console.log(`📚 Handling school community change: ${oldSchool} → ${newSchool}`);

    // Find or create the new school community
    let { data: community, error: findError } = await supabase
      .from('communities')
      .select('*')
      .eq('name', newSchool)
      .eq('type', 'school')
      .single();
    
    if (findError && findError.code === 'PGRST116') {
      // Community doesn't exist, create it
      console.log(`📝 Creating new school community: ${newSchool}`);
      const { data: newCommunity, error: createError } = await supabase
        .from('communities')
        .insert({
          name: newSchool,
          type: 'school',
          description: `School community for ${newSchool}`
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Failed to create school community:', createError);
        return { success: false, error: `Failed to create school community: ${createError.message}` };
      }
      
      community = newCommunity;
      console.log('✅ School community created:', community);
    } else if (findError) {
      console.error('❌ Error finding school community:', findError);
      return { success: false, error: `Failed to find school community: ${findError.message}` };
    } else {
      console.log('✅ Found existing school community:', community);
    }
    
    // Check if user is already a member of the new school community
    const { data: existingMembership, error: membershipError } = await supabase
      .from('user_communities')
      .select('*')
      .eq('user_id', userId)
      .eq('community_id', community.id)
      .single();
    
    if (existingMembership) {
      console.log(`✅ User is already a member of ${newSchool} community`);
      return { success: true, addedCommunity: newSchool };
    }
    
    // Add user to the new school community
    console.log(`📝 Adding user to ${newSchool} community...`);
    const { error: joinError } = await supabase
      .from('user_communities')
      .insert({
        user_id: userId,
        community_id: community.id
      });
    
    if (joinError) {
      // Check if it's a duplicate key error (user already joined)
      if (joinError.code === '23505') {
        console.log(`✅ User already in ${newSchool} community`);
        return { success: true, addedCommunity: newSchool };
      }
      console.error('❌ Failed to join school community:', joinError);
      return { success: false, error: `Failed to join school community: ${joinError.message}` };
    }
    
    console.log(`✅ Successfully added user to ${newSchool} community`);
    
    // Note: We intentionally do NOT remove the user from their old school community
    // This allows users to remain connected to multiple schools if they transfer
    
    return { success: true, addedCommunity: newSchool };
    
  } catch (error) {
    console.error('❌ School community change failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during school community change' 
    };
  }
};


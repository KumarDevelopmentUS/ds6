// utils/profileSync.ts
import { supabase } from '@/supabase';

export interface ProfileData {
  username?: string;
  nickname?: string;
  school?: string;
}

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

    // Check if default general community exists
    let { data: defaultCommunity, error: findError } = await supabase
      .from('communities')
      .select('id')
      .eq('name', 'general')
      .eq('type', 'general')
      .single();

    if (findError && findError.code === 'PGRST116') {
      // Community doesn't exist, create it
      console.log('🔄 COMMUNITY DEBUG: Creating default general community...');
      const { data: newCommunity, error: createError } = await supabase
        .from('communities')
        .insert({
          name: 'general',
          description: 'General community for all users',
          type: 'general',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('❌ COMMUNITY DEBUG: Error creating default community:', createError);
        throw createError;
      }

      defaultCommunity = newCommunity;
      console.log('✅ COMMUNITY DEBUG: Created default community:', defaultCommunity.id);
    } else if (findError) {
      console.error('❌ COMMUNITY DEBUG: Error finding default community:', findError);
      throw findError;
    }

    if (!defaultCommunity) {
      throw new Error('Could not find or create default community');
    }

    // Add user to the default community
    console.log('🔄 COMMUNITY DEBUG: Adding user to default community...');
    const { error: joinError } = await supabase
      .from('user_communities')
      .insert({
        user_id: userId,
        community_id: defaultCommunity.id,
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

    console.log('🎉 COMMUNITY DEBUG: Successfully joined default community!');
    return { success: true, message: 'Joined default community' };

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
// utils/profileSync.ts - Utility to sync profile tables
import { supabase } from '@/supabase';

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

export async function ensureUserProfilesExist(userId: string, userData?: {
  username?: string;
  nickname?: string;
  school?: string;
}) {
  console.log('🔄 Ensuring profiles exist for user:', userId);
  
  // Test Supabase connection first
  console.log('🔍 CONNECTION DEBUG: Testing Supabase connection...');
  try {
    const { data: connectionTest, error: connectionError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    console.log('📥 CONNECTION DEBUG: Connection test result:', {
      hasData: !!connectionTest,
      hasError: !!connectionError,
      errorMessage: connectionError?.message
    });
    
    if (connectionError) {
      console.error('❌ CONNECTION DEBUG: Supabase connection failed:', connectionError);
      return false;
    }
  } catch (connError) {
    console.error('❌ CONNECTION DEBUG: Connection test failed:', connError);
    return false;
  }
  
  // Add timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Profile sync timeout')), 10000); // 10 second timeout
  });
  
  try {
    return await Promise.race([
      performProfileSync(userId, userData),
      timeoutPromise
    ]);
  } catch (error) {
    console.error('💥 Profile sync error:', error);
    return false;
  }
}

async function performProfileSync(userId: string, userData?: {
  username?: string;
  nickname?: string;
  school?: string;
}) {
  try {
    console.log('🔍 PROFILE DEBUG: Starting profile sync for user:', userId);
    console.log('📊 PROFILE DEBUG: User data provided:', userData);

    // Check and create user_profiles record
    console.log('🔍 PROFILE DEBUG: Checking user_profiles table...');
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('📥 PROFILE DEBUG: user_profiles query result:', {
      hasData: !!userProfile,
      userData: userProfile,
      hasError: !!userProfileError,
      errorCode: userProfileError?.code,
      errorMessage: userProfileError?.message
    });

    if (userProfileError && userProfileError.code === 'PGRST116') {
      console.log('📝 PROFILE DEBUG: user_profiles not found, creating new record...');
      
      const userProfileData = {
        id: userId,
        username: userData?.username || `user_${userId.slice(0, 8)}`,
        display_name: userData?.nickname || 'Player',
      };
      
      console.log('📤 PROFILE DEBUG: Inserting user_profiles with data:', userProfileData);
      
      const { data: newUserProfile, error: createUserProfileError } = await supabase
        .from('user_profiles')
        .insert(userProfileData)
        .select()
        .single();

      console.log('📥 PROFILE DEBUG: user_profiles insert result:', {
        hasData: !!newUserProfile,
        insertedData: newUserProfile,
        hasError: !!createUserProfileError,
        errorCode: createUserProfileError?.code,
        errorMessage: createUserProfileError?.message,
        errorDetails: createUserProfileError?.details
      });

      if (createUserProfileError) {
        console.error('❌ PROFILE DEBUG: Failed to create user_profiles:', createUserProfileError);
      } else {
        console.log('✅ PROFILE DEBUG: user_profiles created successfully');
      }
    } else if (userProfile) {
      console.log('✅ PROFILE DEBUG: user_profiles already exists');
    }

    // Check and create profiles record
    console.log('🔍 PROFILE DEBUG: Checking profiles table...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('📥 PROFILE DEBUG: profiles query result:', {
      hasData: !!profile,
      profileData: profile,
      hasError: !!profileError,
      errorCode: profileError?.code,
      errorMessage: profileError?.message
    });

    if (profileError && profileError.code === 'PGRST116') {
      console.log('📝 PROFILE DEBUG: profiles not found, creating new record...');
      
      const profileData = {
        id: userId,
        user_id: userId,
        nickname: userData?.nickname || 'Player',
        school: userData?.school || null,
        avatar_icon: 'person',
        avatar_icon_color: '#FFFFFF',
        avatar_background_color: '#007AFF',
      };
      
      console.log('📤 PROFILE DEBUG: Inserting profiles with data:', profileData);
      
      const { data: newProfile, error: createProfileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      console.log('📥 PROFILE DEBUG: profiles insert result:', {
        hasData: !!newProfile,
        insertedData: newProfile,
        hasError: !!createProfileError,
        errorCode: createProfileError?.code,
        errorMessage: createProfileError?.message,
        errorDetails: createProfileError?.details
      });

      if (createProfileError) {
        console.error('❌ PROFILE DEBUG: Failed to create profiles:', createProfileError);
      } else {
        console.log('✅ PROFILE DEBUG: profiles created successfully');
      }
    } else if (profile) {
      console.log('✅ PROFILE DEBUG: profiles already exists');
    }

    console.log('🎉 PROFILE DEBUG: Profile sync completed successfully');
    return true;
  } catch (error) {
    console.error('💥 PROFILE DEBUG: performProfileSync error:', {
      error: error,
      message: error?.message,
      stack: error?.stack
    });
    return false;
  }
}

export async function joinDefaultCommunity(userId: string) {
  console.log('🏘️ COMMUNITY DEBUG: Adding user to default community for user:', userId);
  
  try {
    // Get or create general community
    console.log('🔍 COMMUNITY DEBUG: Looking for general community...');
    let { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('name', 'general')
      .eq('type', 'general')
      .single();

    console.log('📥 COMMUNITY DEBUG: Community query result:', {
      hasData: !!community,
      communityData: community,
      hasError: !!communityError,
      errorCode: communityError?.code,
      errorMessage: communityError?.message
    });

    if (communityError && communityError.code === 'PGRST116') {
      // Create general community if it doesn't exist
      console.log('📝 COMMUNITY DEBUG: General community not found, creating...');
      
      const communityData = {
        name: 'general',
        description: 'General community for all users',
        type: 'general',
      };
      
      console.log('📤 COMMUNITY DEBUG: Creating community with data:', communityData);
      
      const { data: newCommunity, error: createCommunityError } = await supabase
        .from('communities')
        .insert(communityData)
        .select()
        .single();

      console.log('📥 COMMUNITY DEBUG: Community creation result:', {
        hasData: !!newCommunity,
        createdData: newCommunity,
        hasError: !!createCommunityError,
        errorCode: createCommunityError?.code,
        errorMessage: createCommunityError?.message,
        errorDetails: createCommunityError?.details
      });

      if (createCommunityError) {
        console.error('❌ COMMUNITY DEBUG: Failed to create general community:', createCommunityError);
        return false;
      }
      
      community = newCommunity;
    }

    if (!community) {
      console.error('❌ COMMUNITY DEBUG: No general community available after creation attempt');
      return false;
    }

    console.log('✅ COMMUNITY DEBUG: General community available:', {
      id: community.id,
      name: community.name,
      type: community.type
    });

    // Add user to community
    console.log('🔍 COMMUNITY DEBUG: Checking if user is already in community...');
    const { data: existingMembership } = await supabase
      .from('user_communities')
      .select('*')
      .eq('user_id', userId)
      .eq('community_id', community.id)
      .single();

    if (existingMembership) {
      console.log('✅ COMMUNITY DEBUG: User already in community');
      return true;
    }

    console.log('📝 COMMUNITY DEBUG: Adding user to community...');
    const membershipData = {
      user_id: userId,
      community_id: community.id,
    };

    console.log('📤 COMMUNITY DEBUG: Inserting membership with data:', membershipData);

    const { data: newMembership, error: joinError } = await supabase
      .from('user_communities')
      .insert(membershipData)
      .select()
      .single();

    console.log('📥 COMMUNITY DEBUG: Membership insert result:', {
      hasData: !!newMembership,
      membershipData: newMembership,
      hasError: !!joinError,
      errorCode: joinError?.code,
      errorMessage: joinError?.message,
      errorDetails: joinError?.details
    });

    if (joinError) {
      console.error('❌ COMMUNITY DEBUG: Failed to join general community:', joinError);
      return false;
    }

    console.log('✅ COMMUNITY DEBUG: User successfully joined general community');
    return true;
  } catch (error) {
    console.error('💥 COMMUNITY DEBUG: Community join error:', {
      error: error,
      message: error?.message,
      stack: error?.stack
    });
    return false;
  }
} 
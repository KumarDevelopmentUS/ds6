// utils/profileSync.ts - Utility to sync profile tables
import { supabase } from '@/supabase';

export async function ensureUserProfilesExist(userId: string, userData?: {
  username?: string;
  nickname?: string;
  school?: string;
}) {
  console.log('🔄 Ensuring profiles exist for user:', userId);
  
  try {
    // Check and create user_profiles record
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userProfileError && userProfileError.code === 'PGRST116') {
      console.log('📝 Creating user_profiles record...');
      
      const { error: createUserProfileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          username: userData?.username || `user_${userId.slice(0, 8)}`,
          display_name: userData?.nickname || 'Player',
        });

      if (createUserProfileError) {
        console.error('❌ Failed to create user_profiles:', createUserProfileError);
      } else {
        console.log('✅ user_profiles created');
      }
    }

    // Check and create profiles record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      console.log('📝 Creating profiles record...');
      
      const { error: createProfileError } = await supabase
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

      if (createProfileError) {
        console.error('❌ Failed to create profiles:', createProfileError);
      } else {
        console.log('✅ profiles created');
      }
    }

    return true;
  } catch (error) {
    console.error('💥 Profile sync error:', error);
    return false;
  }
}

export async function joinDefaultCommunity(userId: string) {
  console.log('🏘️ Adding user to default community...');
  
  try {
    // Get or create general community
    let { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('name', 'general')
      .eq('type', 'general')
      .single();

    if (communityError && communityError.code === 'PGRST116') {
      // Create general community if it doesn't exist
      const { data: newCommunity, error: createCommunityError } = await supabase
        .from('communities')
        .insert({
          name: 'general',
          description: 'General community for all users',
          type: 'general',
        })
        .select()
        .single();

      if (createCommunityError) {
        console.error('❌ Failed to create general community:', createCommunityError);
        return false;
      }
      
      community = newCommunity;
    }

    if (!community) {
      console.error('❌ No general community available');
      return false;
    }

    // Add user to community
    const { error: joinError } = await supabase
      .from('user_communities')
      .insert({
        user_id: userId,
        community_id: community.id,
      });

    if (joinError) {
      console.error('❌ Failed to join general community:', joinError);
      return false;
    }

    console.log('✅ User joined general community');
    return true;
  } catch (error) {
    console.error('💥 Community join error:', error);
    return false;
  }
} 
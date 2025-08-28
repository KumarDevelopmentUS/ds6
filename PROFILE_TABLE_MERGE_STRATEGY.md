# Profile Table Merge Strategy

## Overview

This document outlines the strategy to merge the `profiles` and `user_profiles` tables in Supabase into a single, unified table. Currently, the application maintains two separate profile tables with overlapping functionality, which creates complexity and potential data inconsistencies.

## Current Table Structures

### `profiles` Table
```sql
profiles: {
  avatar_background_color: string | null
  avatar_icon: string | null
  avatar_icon_color: string | null
  created_at: string
  first_name: string | null
  id: string
  nickname: string | null
  school: string | null
  user_id: string | null
}
```

### `user_profiles` Table
```sql
user_profiles: {
  achievements: string[] | null
  avatar_url: string | null
  average_rating: number | null
  best_rating: number | null
  created_at: string | null
  display_name: string | null
  id: string
  notification_settings: Json | null
  preferred_theme: string | null
  total_hits: number | null
  total_matches_played: number | null
  total_throws: number | null
  total_wins: number | null
  updated_at: string | null
  username: string | null
}
```

## Analysis of Current Usage

### Functions that rely on `profiles` table:
1. **`ensureUserProfilesExist`** - Creates basic profile records during user signup
2. **`edit-profile.tsx`** - Updates avatar and basic profile information
3. **`tracker/[roomCode].tsx`** - Fetches player information during games
4. **`tracker/join.tsx`** - Fetches player information when joining games
5. **`DebugPanel.tsx`** - Debug functionality
6. **`_settings.tsx`** - Settings page profile display
7. **`community-members.tsx`** - Community member profile display
8. **`friends.tsx`** - Friend profile information
9. **`user-profile/[userId].tsx`** - User profile display

### Functions that rely on `user_profiles` table:
1. **`ensureUserProfilesExist`** - Creates user profile records during signup
2. **`updateUserStats`** - Updates game statistics after matches
3. **`getUserStatsFromProfile`** - Retrieves stored user statistics
4. **`getUserStatsHybrid`** - Hybrid approach for getting user stats
5. **`updateAllUserProfilesWithStats`** - Bulk update of user statistics
6. **`edit-profile.tsx`** - Updates user profile information
7. **`_settings.tsx`** - Settings page user profile display
8. **`community-members.tsx`** - Community member user profile display
9. **`friends.tsx`** - Friend user profile information
10. **`user-profile/[userId].tsx`** - User profile statistics display

### Functions that interact with both tables:
1. **`ensureUserProfilesExist`** - Creates records in both tables
2. **`edit-profile.tsx`** - Updates both tables for consistency
3. **`friends.tsx`** - Combines data from both tables (`fetchFullProfiles`)
4. **`community-members.tsx`** - Combines data from both tables
5. **`user-profile/[userId].tsx`** - Combines data from both tables

## Merge Strategy

### 1. Update Existing user_profiles Table Structure

We will modify the existing `user_profiles` table to include all fields from the `profiles` table:

```sql
-- Add new columns to existing user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS avatar_icon TEXT DEFAULT 'person',
ADD COLUMN IF NOT EXISTS avatar_icon_color TEXT DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS avatar_background_color TEXT DEFAULT '#007AFF';

-- Create indexes for performance on new columns
CREATE INDEX IF NOT EXISTS idx_user_profiles_school ON user_profiles(school);
CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_icon ON user_profiles(avatar_icon);
```

### 2. Data Migration Process

#### Step 1: Create Migration Script
```sql
-- Migration script to merge data into existing user_profiles table
BEGIN;

-- Update existing user_profiles records with data from profiles table
UPDATE user_profiles up
SET 
  nickname = COALESCE(up.nickname, p.nickname),
  first_name = COALESCE(up.first_name, p.first_name),
  school = COALESCE(up.school, p.school),
  avatar_icon = COALESCE(up.avatar_icon, p.avatar_icon, 'person'),
  avatar_icon_color = COALESCE(up.avatar_icon_color, p.avatar_icon_color, '#FFFFFF'),
  avatar_background_color = COALESCE(up.avatar_background_color, p.avatar_background_color, '#007AFF')
FROM profiles p
WHERE up.id = p.id;

-- Insert any profiles that don't have corresponding user_profiles records
INSERT INTO user_profiles (
  id, nickname, first_name, school, avatar_icon, avatar_icon_color, 
  avatar_background_color, username, display_name
)
SELECT 
  p.id,
  p.nickname,
  p.first_name,
  p.school,
  COALESCE(p.avatar_icon, 'person'),
  COALESCE(p.avatar_icon_color, '#FFFFFF'),
  COALESCE(p.avatar_background_color, '#007AFF'),
  'user_' || p.id,
  COALESCE(p.nickname, 'Player')
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = p.id
);

-- Set default values for missing fields in existing records
UPDATE user_profiles
SET 
  username = COALESCE(username, 'user_' || id),
  display_name = COALESCE(display_name, nickname, 'Player'),
  avatar_icon = COALESCE(avatar_icon, 'person'),
  avatar_icon_color = COALESCE(avatar_icon_color, '#FFFFFF'),
  avatar_background_color = COALESCE(avatar_background_color, '#007AFF')
WHERE username IS NULL OR display_name IS NULL OR avatar_icon IS NULL;

COMMIT;
```

#### Step 2: Verify Data Integrity
```sql
-- Verify all users have complete profiles
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as users_with_username,
  COUNT(CASE WHEN display_name IS NOT NULL THEN 1 END) as users_with_display_name,
  COUNT(CASE WHEN avatar_icon IS NOT NULL THEN 1 END) as users_with_avatar_icon
FROM user_profiles;

-- Check for any orphaned records
SELECT COUNT(*) as orphaned_profiles
FROM profiles p
LEFT JOIN user_profiles up ON p.id = up.id
WHERE up.id IS NULL;

-- Verify data was properly merged
SELECT 
  COUNT(*) as total_merged_records,
  COUNT(CASE WHEN nickname IS NOT NULL THEN 1 END) as records_with_nickname,
  COUNT(CASE WHEN school IS NOT NULL THEN 1 END) as records_with_school,
  COUNT(CASE WHEN avatar_icon IS NOT NULL THEN 1 END) as records_with_avatar_icon
FROM user_profiles;
```

### 3. Code Updates Required

#### Update 1: Modify `ensureUserProfilesExist` function
```typescript
// utils/profileSync.ts - Update ensureUserProfilesExist
export async function ensureUserProfilesExist(userId: string, userData?: ProfileData) {
  try {
    // Only check/create in user_profiles table now
    const { data: existingUserProfile, error: userProfileFetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userProfileFetchError && userProfileFetchError.code === 'PGRST116') {
      // Create unified profile record
      const { error: userProfileInsertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          username: userData?.username || 'user' + Date.now(),
          display_name: userData?.nickname || 'Player',
          nickname: userData?.nickname || 'Player',
          school: userData?.school || null,
          avatar_icon: 'person',
          avatar_icon_color: '#FFFFFF',
          avatar_background_color: '#007AFF',
        });

      if (userProfileInsertError) {
        console.error('❌ PROFILE SYNC: Error creating user profile:', userProfileInsertError);
        throw userProfileInsertError;
      }
    }
    
    return { success: true, message: 'Profile sync completed' };
  } catch (error) {
    console.error('💥 PROFILE SYNC: Unexpected error:', error);
    throw error;
  }
}
```

#### Update 2: Update all profile fetching functions
```typescript
// Example: Update fetchFullProfiles in friends.tsx
const fetchFullProfiles = async (ids: string[]): Promise<Map<string, UserProfile>> => {
  const { data: userProfiles, error } = await supabase
    .from('user_profiles')
    .select('*')
    .in('id', ids);

  if (error) {
    console.error("Profile loading error:", error);
    return new Map();
  }

  // No need to combine with profiles table anymore
  const profileMap = new Map(userProfiles.map(p => [p.id, p]));
  return profileMap;
};
```

#### Update 3: Update edit-profile.tsx
```typescript
// app/edit-profile.tsx - Update profile update logic
const updateProfile = async () => {
  try {
    // Update only user_profiles table now
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        nickname: nickname,
        school: school,
        avatar_icon: selectedIcon,
        avatar_icon_color: selectedIconColor,
        avatar_background_color: selectedBackgroundColor,
        display_name: nickname, // Keep display_name in sync
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;
    
    // Invalidate queries for the new table
    await queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
    
  } catch (error) {
    console.error('Error updating profile:', error);
  }
};
```

### 4. Database Schema Updates

#### Step 1: Update Supabase Types
After running the migration, update the generated types:

```bash
# Update Supabase types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database_generated.ts
```

#### Step 2: Update RLS Policies
```sql
-- Ensure RLS is enabled on the existing user_profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Update or create policies for the enhanced user_profiles table
-- Policy for users to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy for users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy for users to insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy for public read access (for friend lists, etc.)
DROP POLICY IF EXISTS "Public read access for profiles" ON user_profiles;
CREATE POLICY "Public read access for profiles" ON user_profiles
  FOR SELECT USING (true);
```

### 5. Rollback Plan

If issues arise during migration, we can rollback:

```sql
-- Rollback script
BEGIN;

-- Remove the added columns from user_profiles table
ALTER TABLE user_profiles 
DROP COLUMN IF EXISTS nickname,
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS school,
DROP COLUMN IF EXISTS avatar_icon,
DROP COLUMN IF EXISTS avatar_icon_color,
DROP COLUMN IF EXISTS avatar_background_color;

-- Drop the indexes we created
DROP INDEX IF EXISTS idx_user_profiles_school;
DROP INDEX IF EXISTS idx_user_profiles_avatar_icon;

-- Revert any RLS policy changes to original state
-- (Keep original policies on existing tables)

COMMIT;
```

### 6. Testing Strategy

#### Phase 1: Development Testing
1. Test migration script on development database
2. Verify all existing functionality works with new table
3. Test data integrity and performance

#### Phase 2: Staging Testing
1. Deploy to staging environment
2. Run full integration tests
3. Verify all user flows work correctly

#### Phase 3: Production Deployment
1. Schedule maintenance window
2. Run migration during low-traffic period
3. Monitor for any issues
4. Keep old tables for 24-48 hours before cleanup

### 7. Cleanup Steps

After successful migration and verification:

```sql
-- Drop the old profiles table (only after confirming everything works)
DROP TABLE IF EXISTS profiles;

-- Update any remaining references in the codebase
-- Remove old table imports and queries
-- All profile data is now consolidated in the user_profiles table
```

### 8. Performance Considerations

#### Indexes to Add
```sql
-- Performance indexes for the enhanced user_profiles table
CREATE INDEX IF NOT EXISTS idx_user_profiles_username_lower ON user_profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_user_profiles_school_lower ON user_profiles(LOWER(school));
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_total_wins ON user_profiles(total_wins DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname_lower ON user_profiles(LOWER(nickname));
```

#### Query Optimization
- Use `SELECT` with specific columns instead of `SELECT *`
- Implement pagination for large result sets
- Use appropriate WHERE clauses with indexed columns

### 9. Monitoring and Maintenance

#### Post-Migration Monitoring
1. Monitor query performance
2. Check for any data inconsistencies
3. Verify all user flows work correctly
4. Monitor error logs for any issues

#### Regular Maintenance
1. Regular cleanup of unused avatar files
2. Monitor table size and performance
3. Update statistics regularly
4. Backup strategy for user data

## Timeline

- **Week 1**: Development and testing of migration script
- **Week 2**: Staging deployment and testing
- **Week 3**: Production migration
- **Week 4**: Monitoring and cleanup

## Risk Assessment

### High Risk
- Data loss during migration
- Application downtime
- Data integrity issues

### Medium Risk
- Performance degradation
- User experience disruption
- Rollback complexity

### Low Risk
- Minor UI inconsistencies
- Temporary feature unavailability

## Success Criteria

1. All existing functionality works with unified table
2. No data loss during migration
3. Performance maintained or improved
4. All user flows work correctly
5. No critical errors in production

## Conclusion

This merge will significantly simplify the application architecture, reduce data duplication, and improve maintainability. The unified table structure will provide a single source of truth for user profile information while maintaining all existing functionality.

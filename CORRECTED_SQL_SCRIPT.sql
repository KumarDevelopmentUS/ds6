-- ========================================
-- COMPLETE USER STATS UPDATE SCRIPT - CORRECTED WITH EXACT SCHEMA
-- ========================================
-- Based on updated types from: npm run generate-types
-- Column names verified from database.ts schema

-- 1. Create missing user_profiles entries for users with saved matches
INSERT INTO public.user_profiles (
    id, created_at, updated_at, preferred_theme, total_matches_played,
    total_wins, total_throws, total_hits, average_rating, achievements
)
SELECT DISTINCT 
    sm."userId" as id, 
    NOW() as created_at, 
    NOW() as updated_at, 
    'light' as preferred_theme, 
    0 as total_matches_played,
    0 as total_wins,
    0 as total_throws,
    0 as total_hits,
    0.0 as average_rating,
    ARRAY[]::text[] as achievements
FROM saved_matches sm
LEFT JOIN user_profiles up ON sm."userId" = up.id
WHERE up.id IS NULL;

-- 2. Fix theme preferences for all existing users
UPDATE public.user_profiles 
SET preferred_theme = 'light'
WHERE preferred_theme = 'dark' OR preferred_theme IS NULL;

-- 3. Create comprehensive stats calculation function
CREATE OR REPLACE FUNCTION update_user_stats_from_matches()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    user_record RECORD;
    match_record RECORD;
    player_slot INTEGER;
    user_team INTEGER;
    player_stats JSONB;
    calc_total_matches INTEGER := 0;
    calc_total_wins INTEGER := 0;
    calc_total_throws INTEGER := 0;
    calc_total_hits INTEGER := 0;
    calc_total_catches INTEGER := 0;
    calc_total_catch_attempts INTEGER := 0;
    calc_total_fifa_success INTEGER := 0;
    calc_total_fifa_attempts INTEGER := 0;
    calc_hit_rate DECIMAL := 0;
    calc_catch_rate DECIMAL := 0;
    calc_fifa_rate DECIMAL := 0;
    calc_average_ranking INTEGER := 0;
BEGIN
    FOR user_record IN SELECT id FROM user_profiles LOOP
        calc_total_matches := 0; calc_total_wins := 0; calc_total_throws := 0; calc_total_hits := 0;
        calc_total_catches := 0; calc_total_catch_attempts := 0; calc_total_fifa_success := 0; calc_total_fifa_attempts := 0;
        
        -- Find all matches where this user participated (using exact column names from schema)
        FOR match_record IN 
            SELECT * FROM saved_matches sm
            WHERE sm."userSlotMap"->>'1' = user_record.id::text
               OR sm."userSlotMap"->>'2' = user_record.id::text  
               OR sm."userSlotMap"->>'3' = user_record.id::text
               OR sm."userSlotMap"->>'4' = user_record.id::text
        LOOP
            player_slot := NULL;
            
            -- Determine which player slot this user occupied
            IF match_record."userSlotMap"->>'1' = user_record.id::text THEN 
                player_slot := 1;
            ELSIF match_record."userSlotMap"->>'2' = user_record.id::text THEN 
                player_slot := 2;
            ELSIF match_record."userSlotMap"->>'3' = user_record.id::text THEN 
                player_slot := 3;
            ELSIF match_record."userSlotMap"->>'4' = user_record.id::text THEN 
                player_slot := 4;
            END IF;
            
            IF player_slot IS NOT NULL THEN
                calc_total_matches := calc_total_matches + 1;
                
                -- Determine team (slots 1,2 = team 1; slots 3,4 = team 2)
                user_team := CASE WHEN player_slot <= 2 THEN 1 ELSE 2 END;
                
                -- Check if user's team won (using exact column name: "winnerTeam")
                IF match_record."winnerTeam" = user_team THEN 
                    calc_total_wins := calc_total_wins + 1; 
                END IF;
                
                -- Extract player stats from match data (using exact column name: "playerStats")
                player_stats := match_record."playerStats"->player_slot::text;
                
                IF player_stats IS NOT NULL THEN
                    calc_total_throws := calc_total_throws + COALESCE((player_stats->>'throws')::INTEGER, 0);
                    calc_total_hits := calc_total_hits + COALESCE((player_stats->>'hits')::INTEGER, 0);
                    calc_total_catches := calc_total_catches + COALESCE((player_stats->>'catches')::INTEGER, 0);
                    calc_total_fifa_success := calc_total_fifa_success + COALESCE((player_stats->>'fifaSuccess')::INTEGER, 0);
                    calc_total_fifa_attempts := calc_total_fifa_attempts + COALESCE((player_stats->>'fifaAttempts')::INTEGER, 0);
                    
                    -- Calculate total catch attempts (catches + all miss types)
                    calc_total_catch_attempts := calc_total_catch_attempts + 
                        COALESCE((player_stats->>'catches')::INTEGER, 0) +
                        COALESCE((player_stats->>'drop')::INTEGER, 0) +
                        COALESCE((player_stats->>'miss')::INTEGER, 0) +
                        COALESCE((player_stats->>'twoHands')::INTEGER, 0) +
                        COALESCE((player_stats->>'body')::INTEGER, 0);
                END IF;
            END IF;
        END LOOP;
        
        -- Calculate percentages
        calc_hit_rate := CASE WHEN calc_total_throws > 0 THEN (calc_total_hits::DECIMAL / calc_total_throws) * 100 ELSE 0 END;
        calc_catch_rate := CASE WHEN calc_total_catch_attempts > 0 THEN (calc_total_catches::DECIMAL / calc_total_catch_attempts) * 100 ELSE 0 END;
        calc_fifa_rate := CASE WHEN calc_total_fifa_attempts > 0 THEN (calc_total_fifa_success::DECIMAL / calc_total_fifa_attempts) * 100 ELSE 0 END;
        
        -- Calculate average ranking using your app's formula
        calc_average_ranking := ROUND(((0.85 * ((calc_hit_rate/100 + calc_catch_rate/100) / 2)) + (0.10 * (calc_fifa_rate/100))) / 0.95 * 100);
        
        -- Update user_profiles with calculated stats (no ambiguity with calc_ prefixed variables)
        UPDATE user_profiles 
        SET 
            total_matches_played = calc_total_matches,
            total_wins = calc_total_wins,
            total_throws = calc_total_throws,
            total_hits = calc_total_hits,
            average_rating = calc_average_ranking,
            best_rating = GREATEST(COALESCE(average_rating, 0), calc_average_ranking),
            updated_at = NOW()
        WHERE id = user_record.id;
        
        -- Log progress for debugging
        RAISE NOTICE 'Updated user %: matches=%, wins=%, ranking=%', user_record.id, calc_total_matches, calc_total_wins, calc_average_ranking;
    END LOOP;
END; $$;

-- 4. Execute the stats calculation function
SELECT update_user_stats_from_matches();

-- 5. Update best ratings to match current average ratings
UPDATE public.user_profiles 
SET best_rating = GREATEST(COALESCE(best_rating, 0), COALESCE(average_rating, 0))
WHERE average_rating IS NOT NULL;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stats 
ON user_profiles(total_matches_played, total_wins, average_rating);

CREATE INDEX IF NOT EXISTS idx_saved_matches_user_slot_map 
ON saved_matches USING GIN ("userSlotMap");

-- 7. Display results to verify success
SELECT 
    id, 
    username,
    preferred_theme,
    total_matches_played, 
    total_wins, 
    average_rating,
    updated_at
FROM user_profiles 
WHERE total_matches_played > 0
ORDER BY total_matches_played DESC, average_rating DESC;

-- 8. Quick verification query to show all users (even those with 0 matches)
SELECT 
    COUNT(*) as total_users_in_profiles,
    COUNT(CASE WHEN total_matches_played > 0 THEN 1 END) as users_with_matches,
    COUNT(CASE WHEN preferred_theme = 'light' THEN 1 END) as users_with_light_theme
FROM user_profiles;

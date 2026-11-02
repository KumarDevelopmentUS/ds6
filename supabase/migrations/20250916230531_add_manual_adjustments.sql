-- Add manual adjustments columns to live_matches table
ALTER TABLE live_matches 
ADD COLUMN manual_adjustments JSONB DEFAULT '{"1": 0, "2": 0}'::jsonb,
ADD COLUMN adjustment_history JSONB DEFAULT '[]'::jsonb;
-- Add manual adjustments columns to saved_matches table
ALTER TABLE saved_matches 
ADD COLUMN manual_adjustments JSONB DEFAULT '{"1": 0, "2": 0}'::jsonb,
ADD COLUMN adjustment_history JSONB DEFAULT '[]'::jsonb;

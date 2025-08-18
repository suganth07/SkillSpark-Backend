-- Fix the level constraint in user_videos table to accept the correct values
-- Drop the existing constraint and add a new one with the correct values

-- Drop the existing constraint
ALTER TABLE user_videos DROP CONSTRAINT IF EXISTS user_videos_level_check;

-- Add new constraint with correct values
ALTER TABLE user_videos ADD CONSTRAINT user_videos_level_check 
CHECK (level IN ('beginner', 'intermediate', 'advanced'));

-- Verify the constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'user_videos_level_check';

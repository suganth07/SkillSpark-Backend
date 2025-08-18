-- Add pagination support to user_videos table
-- Add page_number and generation_number columns

ALTER TABLE user_videos 
ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS generation_number INTEGER DEFAULT 1;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_videos_pagination 
ON user_videos(user_roadmap_id, level, page_number, generation_number);

-- Remove the unique constraint on user_roadmap_id, level to allow multiple pages
ALTER TABLE user_videos 
DROP CONSTRAINT IF EXISTS user_videos_user_roadmap_id_level_key;

-- Add new unique constraint that includes page_number
ALTER TABLE user_videos 
ADD CONSTRAINT user_videos_unique_page 
UNIQUE (user_roadmap_id, level, page_number, generation_number);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_videos' 
ORDER BY ordinal_position;

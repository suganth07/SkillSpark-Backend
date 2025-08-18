-- Add pagination support columns to user_videos table

-- Add page_number column if it doesn't exist
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1 NOT NULL;

-- Add generation_number column if it doesn't exist  
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS generation_number INTEGER DEFAULT 1 NOT NULL;

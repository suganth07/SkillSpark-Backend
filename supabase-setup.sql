-- SkillSpark Database Schema Setup
-- Run this SQL in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- In production, this should be hashed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_topics table
CREATE TABLE IF NOT EXISTS user_topics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roadmaps table
CREATE TABLE IF NOT EXISTS user_roadmaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_topic_id UUID NOT NULL REFERENCES user_topics(id) ON DELETE CASCADE,
    roadmap_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_videos table
CREATE TABLE IF NOT EXISTS user_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_roadmap_id UUID NOT NULL REFERENCES user_roadmaps(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL CHECK (level IN ('basic', 'medium', 'advanced')),
    video_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmaps_user_topic_id ON user_roadmaps(user_topic_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_user_roadmap_id ON user_videos(user_roadmap_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_level ON user_videos(level);

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at in user_roadmaps
CREATE TRIGGER update_user_roadmaps_updated_at 
    BEFORE UPDATE ON user_roadmaps 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for better security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS (optional - for added security)
-- These policies ensure users can only access their own data

-- Users can only read their own user record
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Users can only access their own topics
CREATE POLICY "Users can view own topics" ON user_topics
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

-- Users can only access roadmaps for their own topics
CREATE POLICY "Users can view own roadmaps" ON user_roadmaps
    FOR ALL USING (user_topic_id IN (
        SELECT id FROM user_topics WHERE user_id IN (
            SELECT id FROM users WHERE auth.uid()::text = id::text
        )
    ));

-- Users can only access videos for their own roadmaps
CREATE POLICY "Users can view own videos" ON user_videos
    FOR ALL USING (user_roadmap_id IN (
        SELECT id FROM user_roadmaps WHERE user_topic_id IN (
            SELECT id FROM user_topics WHERE user_id IN (
                SELECT id FROM users WHERE auth.uid()::text = id::text
            )
        )
    ));

-- Insert some sample data for testing (optional)
-- Uncomment the lines below if you want to add test data

/*
-- Sample user
INSERT INTO users (username, password) VALUES ('testuser', 'password123');

-- Get the user ID for the sample data
DO $$
DECLARE
    sample_user_id UUID;
    sample_topic_id UUID;
    sample_roadmap_id UUID;
BEGIN
    -- Get the test user ID
    SELECT id INTO sample_user_id FROM users WHERE username = 'testuser';
    
    -- Sample topic
    INSERT INTO user_topics (user_id, topic) VALUES (sample_user_id, 'React Native')
    RETURNING id INTO sample_topic_id;
    
    -- Sample roadmap
    INSERT INTO user_roadmaps (user_topic_id, roadmap_data) VALUES (
        sample_topic_id,
        '{
            "id": "roadmap_001",
            "topic": "react native",
            "title": "React Native Development Roadmap",
            "description": "Complete learning path for react native development",
            "points": [
                {
                    "id": "point_001",
                    "title": "JavaScript Fundamentals",
                    "description": "Master JavaScript fundamentals concepts and patterns",
                    "level": "basic",
                    "order": 1,
                    "playlists": null,
                    "isCompleted": false
                }
            ],
            "progress": {
                "completedPoints": 0,
                "totalPoints": 1,
                "percentage": 0
            }
        }'::jsonb
    ) RETURNING id INTO sample_roadmap_id;
    
    -- Sample videos
    INSERT INTO user_videos (user_roadmap_id, level, video_data) VALUES (
        sample_roadmap_id,
        'basic',
        '[
            {
                "id": "video_001",
                "title": "JavaScript Basics Tutorial",
                "videoUrl": "https://youtube.com/watch?v=example",
                "duration": "15:30",
                "description": "Learn JavaScript basics"
            }
        ]'::jsonb
    );
END $$;
*/

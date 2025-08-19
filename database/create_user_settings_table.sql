-- Create user_settings table in Supabase
-- Run this command in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_name VARCHAR(100),
    user_description TEXT,
    theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    roadmap_depth VARCHAR(20) DEFAULT 'balanced' CHECK (roadmap_depth IN ('basic', 'detailed', 'comprehensive')),
    video_length VARCHAR(20) DEFAULT 'medium' CHECK (video_length IN ('short', 'medium', 'long')),
    learning_pace VARCHAR(20) DEFAULT 'moderate' CHECK (learning_pace IN ('slow', 'moderate', 'fast')),
    preferred_language VARCHAR(10) DEFAULT 'en',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_user_settings_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint to ensure one settings record per user
    CONSTRAINT unique_user_settings_per_user UNIQUE (user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_settings_updated_at ON user_settings;
CREATE TRIGGER trigger_update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see and modify their own settings
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_settings TO service_role;

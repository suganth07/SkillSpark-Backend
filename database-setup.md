# Supabase Database Setup Instructions

## 1. Create Tables

Run the following SQL commands in your Supabase SQL editor to create the required tables:

```sql
-- Create users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_topics table
CREATE TABLE user_topics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roadmaps table
CREATE TABLE user_roadmaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_topic_id UUID REFERENCES user_topics(id) ON DELETE CASCADE,
    roadmap_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_videos table
CREATE TABLE user_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_roadmap_id UUID REFERENCES user_roadmaps(id) ON DELETE CASCADE,
    level VARCHAR(20) CHECK (level IN ('basic', 'medium', 'advanced')) NOT NULL,
    video_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_user_topics_user_id ON user_topics(user_id);
CREATE INDEX idx_user_topics_topic ON user_topics(topic);
CREATE INDEX idx_user_roadmaps_user_topic_id ON user_roadmaps(user_topic_id);
CREATE INDEX idx_user_videos_user_roadmap_id ON user_videos(user_roadmap_id);
CREATE INDEX idx_user_videos_level ON user_videos(level);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_roadmaps_updated_at
    BEFORE UPDATE ON user_roadmaps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## 2. Enable Row Level Security (RLS) - Optional but Recommended

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;

-- Create policies (these are basic examples - adjust based on your needs)
-- Allow users to read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can read own topics" ON user_topics
    FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can read own roadmaps" ON user_roadmaps
    FOR ALL USING (
        user_topic_id IN (
            SELECT id FROM user_topics WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can read own videos" ON user_videos
    FOR ALL USING (
        user_roadmap_id IN (
            SELECT ur.id FROM user_roadmaps ur
            JOIN user_topics ut ON ur.user_topic_id = ut.id
            WHERE ut.user_id::text = auth.uid()::text
        )
    );
```

## 3. Environment Variables

After creating the database tables, get your Supabase credentials:

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the following values:

### Frontend (.env):
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

### Backend (.env):
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

⚠️ **Important**: Use the service role key for the backend, not the anon key!

## 4. Database Structure Overview

```
User Flow:
User -> Topic -> Roadmap -> Videos (Basic/Medium/Advanced)

Tables:
- users: Store user credentials
- user_topics: Topics that users are learning
- user_roadmaps: Generated roadmaps for each topic
- user_videos: YouTube videos for each roadmap level
```

## 5. Example Data Structure

The roadmap_data JSONB field will store data like:
```json
{
  "id": "roadmap_abc123",
  "topic": "react native",
  "title": "React Native Development Roadmap",
  "description": "Complete learning path for react native development",
  "points": [
    {
      "id": "point_xyz789",
      "title": "Introduction to React Native",
      "level": "beginner",
      "order": 1,
      "isCompleted": false
    }
  ],
  "progress": {
    "completedPoints": 0,
    "totalPoints": 12,
    "percentage": 0
  }
}
```

The video_data JSONB field will store arrays of videos like:
```json
[
  {
    "id": "video_123",
    "title": "React Native Tutorial",
    "videoUrl": "https://youtube.com/watch?v=...",
    "duration": "15:30",
    "description": "Learn React Native basics"
  }
]
```

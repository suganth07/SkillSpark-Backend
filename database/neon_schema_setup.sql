-- Neon Database Schema Setup for SkillSpark
-- Execute these commands in your Neon DB console or using psql

-- Enable UUID extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username character varying NOT NULL UNIQUE,
  password character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Create user_topics table
CREATE TABLE IF NOT EXISTS public.user_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  topic character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_topics_pkey PRIMARY KEY (id),
  CONSTRAINT user_topics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create user_roadmaps table
CREATE TABLE IF NOT EXISTS public.user_roadmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_topic_id uuid,
  roadmap_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roadmaps_pkey PRIMARY KEY (id),
  CONSTRAINT user_roadmaps_user_topic_id_fkey FOREIGN KEY (user_topic_id) REFERENCES public.user_topics(id) ON DELETE CASCADE
);

-- Create roadmap_progress table
CREATE TABLE IF NOT EXISTS public.roadmap_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  roadmap_id uuid NOT NULL,
  point_id character varying NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roadmap_progress_pkey PRIMARY KEY (id),
  CONSTRAINT roadmap_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT roadmap_progress_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.user_roadmaps(id) ON DELETE CASCADE
);

-- Create user_videos table (weak entity with composite primary key)
CREATE TABLE IF NOT EXISTS public.user_videos (
  user_roadmap_id uuid NOT NULL,
  level character varying NOT NULL,
  video_data jsonb NOT NULL,
  page_number integer NOT NULL DEFAULT 1,
  generation_number integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_videos_pkey PRIMARY KEY (user_roadmap_id, level, page_number, generation_number),
  CONSTRAINT user_videos_new_user_roadmap_id_fkey FOREIGN KEY (user_roadmap_id) REFERENCES public.user_roadmaps(id) ON DELETE CASCADE
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name character varying,
  about_description text,
  theme character varying DEFAULT 'light'::character varying CHECK (theme::text = ANY (ARRAY['light'::character varying, 'dark'::character varying]::text[])),
  default_roadmap_depth character varying DEFAULT 'detailed'::character varying CHECK (default_roadmap_depth::text = ANY (ARRAY['basic'::character varying, 'detailed'::character varying, 'comprehensive'::character varying]::text[])),
  default_video_length character varying DEFAULT 'medium'::character varying CHECK (default_video_length::text = ANY (ARRAY['short'::character varying, 'medium'::character varying, 'long'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON public.user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmaps_user_topic_id ON public.user_roadmaps(user_topic_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_user_id ON public.roadmap_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_roadmap_id ON public.roadmap_progress(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_roadmap_id ON public.user_videos(user_roadmap_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Create triggers to automatically update the updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables that need automatic timestamp updates
DROP TRIGGER IF EXISTS update_user_roadmaps_updated_at ON public.user_roadmaps;
CREATE TRIGGER update_user_roadmaps_updated_at 
    BEFORE UPDATE ON public.user_roadmaps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roadmap_progress_updated_at ON public.roadmap_progress;
CREATE TRIGGER update_roadmap_progress_updated_at 
    BEFORE UPDATE ON public.roadmap_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_videos_updated_at ON public.user_videos;
CREATE TRIGGER update_user_videos_updated_at 
    BEFORE UPDATE ON public.user_videos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON public.user_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Display created tables
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_topics', 'user_roadmaps', 'roadmap_progress', 'user_videos', 'user_settings')
ORDER BY table_name;

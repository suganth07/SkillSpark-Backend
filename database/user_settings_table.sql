-- User Settings Table
-- This table stores user preferences and settings from the settings tab

CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Personal Information
  full_name character varying,
  about_description text,
  
  -- Appearance
  theme character varying DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  
  -- Learning Preferences
  default_roadmap_depth character varying DEFAULT 'detailed' CHECK (default_roadmap_depth IN ('basic', 'detailed', 'comprehensive')),
  default_video_length character varying DEFAULT 'medium' CHECK (default_video_length IN ('short', 'medium', 'long')),
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Constraints
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- Step 7: Create user_settings table
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

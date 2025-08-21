-- Step 6: Create user_videos table
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

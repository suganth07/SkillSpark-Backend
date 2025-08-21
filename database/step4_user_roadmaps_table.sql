-- Step 4: Create user_roadmaps table
CREATE TABLE IF NOT EXISTS public.user_roadmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_topic_id uuid,
  roadmap_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roadmaps_pkey PRIMARY KEY (id),
  CONSTRAINT user_roadmaps_user_topic_id_fkey FOREIGN KEY (user_topic_id) REFERENCES public.user_topics(id) ON DELETE CASCADE
);

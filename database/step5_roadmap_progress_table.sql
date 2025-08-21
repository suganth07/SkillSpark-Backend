-- Step 5: Create roadmap_progress table
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

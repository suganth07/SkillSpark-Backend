-- Step 3: Create user_topics table
CREATE TABLE IF NOT EXISTS public.user_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  topic character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_topics_pkey PRIMARY KEY (id),
  CONSTRAINT user_topics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create roadmap_progress table to store completion status of individual roadmap points
CREATE TABLE public.roadmap_progress (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    roadmap_id uuid NOT NULL,
    point_id varchar(255) NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roadmap_progress_pkey PRIMARY KEY (id),
    CONSTRAINT roadmap_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT roadmap_progress_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.user_roadmaps(id) ON DELETE CASCADE,
    CONSTRAINT roadmap_progress_unique_user_roadmap_point UNIQUE (user_id, roadmap_id, point_id)
);

-- Create indexes for better performance
CREATE INDEX idx_roadmap_progress_user_id ON public.roadmap_progress(user_id);
CREATE INDEX idx_roadmap_progress_roadmap_id ON public.roadmap_progress(roadmap_id);
CREATE INDEX idx_roadmap_progress_point_id ON public.roadmap_progress(point_id);
CREATE INDEX idx_roadmap_progress_is_completed ON public.roadmap_progress(is_completed);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_roadmap_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_roadmap_progress_updated_at
    BEFORE UPDATE ON public.roadmap_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_roadmap_progress_updated_at();

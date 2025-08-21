-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON public.user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmaps_user_topic_id ON public.user_roadmaps(user_topic_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_user_id ON public.roadmap_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_roadmap_id ON public.roadmap_progress(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_roadmap_id ON public.user_videos(user_roadmap_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

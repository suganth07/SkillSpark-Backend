-- Step 10: Apply triggers to tables
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

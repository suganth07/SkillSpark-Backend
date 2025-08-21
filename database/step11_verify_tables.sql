-- Step 11: Verify table creation
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_topics', 'user_roadmaps', 'roadmap_progress', 'user_videos', 'user_settings')
ORDER BY table_name;

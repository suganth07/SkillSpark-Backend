-- Test script to verify user_settings table setup
-- Copy and run this in Neon SQL Console to test the setup

-- Test 1: Insert a sample user settings record
INSERT INTO user_settings (
    user_id,
    user_name,
    user_description,
    theme,
    roadmap_depth,
    video_length,
    learning_pace,
    preferred_language,
    notifications_enabled
) VALUES (
    gen_random_uuid(),  -- Replace with actual user UUID from auth.users
    'John Doe',
    'Learning full-stack development',
    'dark',
    'comprehensive',
    'long',
    'fast',
    'en',
    true
) RETURNING *;

-- Test 2: Select all user settings
SELECT * FROM user_settings;

-- Test 3: Update user settings
-- UPDATE user_settings 
-- SET theme = 'light', roadmap_depth = 'basic'
-- WHERE user_id = 'your-user-id-here'
-- RETURNING *;

-- Test 4: Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

-- Test 5: Check constraints
SELECT 
    constraint_name,
    constraint_type,
    check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'user_settings';

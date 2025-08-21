-- Fix the foreign key constraint in existing user_settings table
-- Run this in Neon SQL Console to fix the foreign key reference

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.user_settings 
DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

-- Step 2: Add the correct foreign key constraint referencing auth.users
ALTER TABLE public.user_settings 
ADD CONSTRAINT user_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Enable Row Level Security (if not already enabled)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for user data security
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON public.user_settings;

CREATE POLICY "Users can view their own settings" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON public.user_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Grant necessary permissions
GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

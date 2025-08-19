-- Temporarily disable foreign key constraint for testing
-- Run this in Supabase SQL Editor

-- Drop the foreign key constraint temporarily
ALTER TABLE public.user_settings 
DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

-- Test without constraint
-- You can re-add the constraint later when you have proper user IDs

-- To re-add the constraint later, run:
-- ALTER TABLE public.user_settings 
-- ADD CONSTRAINT user_settings_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

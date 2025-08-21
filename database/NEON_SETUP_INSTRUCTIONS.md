# Neon DB Schema Setup - Step by Step Instructions

Since the Neon SQL Editor can't handle large SQL files, execute these files one by one:

## Step-by-Step Execution Order

### Step 1: Enable UUID Extension
**File:** `step1_extensions.sql`
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```
- Copy and paste this into Neon SQL Editor
- Click "Run"
- Should see: Success message

### Step 2: Create Users Table
**File:** `step2_users_table.sql`
```sql
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username character varying NOT NULL UNIQUE,
  password character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
```
- Copy and paste this into Neon SQL Editor
- Click "Run"

### Step 3: Create User Topics Table
**File:** `step3_user_topics_table.sql`
- Copy and paste content
- Click "Run"

### Step 4: Create User Roadmaps Table
**File:** `step4_user_roadmaps_table.sql`
- Copy and paste content
- Click "Run"

### Step 5: Create Roadmap Progress Table
**File:** `step5_roadmap_progress_table.sql`
- Copy and paste content
- Click "Run"

### Step 6: Create User Videos Table
**File:** `step6_user_videos_table.sql`
- Copy and paste content
- Click "Run"

### Step 7: Create User Settings Table
**File:** `step7_user_settings_table.sql`
- Copy and paste content
- Click "Run"

### Step 8: Create Performance Indexes
**File:** `step8_indexes.sql`
- Copy and paste content
- Click "Run"

### Step 9: Create Timestamp Update Function
**File:** `step9_timestamp_function.sql`
- Copy and paste content
- Click "Run"

### Step 10: Apply Update Triggers
**File:** `step10_triggers.sql`
- Copy and paste content
- Click "Run"

### Step 11: Verify All Tables Created
**File:** `step11_verify_tables.sql`
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_topics', 'user_roadmaps', 'roadmap_progress', 'user_videos', 'user_settings')
ORDER BY table_name;
```
- Copy and paste content
- Click "Run"
- Should see 6 tables listed: users, user_topics, user_roadmaps, roadmap_progress, user_videos, user_settings

## Alternative: Quick Commands for Each Step

If you prefer to copy-paste directly, here are the essential commands:

### 1. UUID Extension:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2. Users Table:
```sql
CREATE TABLE public.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username varchar UNIQUE NOT NULL, password varchar NOT NULL, created_at timestamptz DEFAULT now());
```

### 3. User Topics Table:
```sql
CREATE TABLE public.user_topics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE, topic varchar NOT NULL, created_at timestamptz DEFAULT now());
```

### 4. User Roadmaps Table:
```sql
CREATE TABLE public.user_roadmaps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_topic_id uuid REFERENCES user_topics(id) ON DELETE CASCADE, roadmap_data jsonb NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
```

### 5. Roadmap Progress Table:
```sql
CREATE TABLE public.roadmap_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE, roadmap_id uuid REFERENCES user_roadmaps(id) ON DELETE CASCADE, point_id varchar NOT NULL, is_completed boolean DEFAULT false, completed_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
```

### 6. User Videos Table:
```sql
CREATE TABLE public.user_videos (user_roadmap_id uuid REFERENCES user_roadmaps(id) ON DELETE CASCADE, level varchar NOT NULL, video_data jsonb NOT NULL, page_number int DEFAULT 1, generation_number int DEFAULT 1, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), PRIMARY KEY (user_roadmap_id, level, page_number, generation_number));
```

### 7. User Settings Table:
```sql
CREATE TABLE public.user_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE, full_name varchar, about_description text, theme varchar DEFAULT 'light' CHECK (theme IN ('light', 'dark')), default_roadmap_depth varchar DEFAULT 'detailed' CHECK (default_roadmap_depth IN ('basic', 'detailed', 'comprehensive')), default_video_length varchar DEFAULT 'medium' CHECK (default_video_length IN ('short', 'medium', 'long')), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
```

## After Completion
Once all steps are complete, your Neon database will have all the required tables and you can test your backend connection!

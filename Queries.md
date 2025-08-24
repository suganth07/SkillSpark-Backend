# SkillSpark Backend - Database Queries Documentation

This document contains all the database operations and their respective SQL queries used in the SkillSpark backend application.

## Database Tables

The application uses the following main tables:

- `users` - User authentication and basic information
- `user_topics` - Topics that users are learning
- `user_roadmaps` - Learning roadmaps for each topic
- `user_videos` - Video content for each roadmap level
- `roadmap_progress` - User progress tracking for roadmap points
- `user_settings` - User preferences and settings

---

## 1. USER MANAGEMENT OPERATIONS

### 1.1 Create User

**Operation**: Register a new user  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
INSERT INTO users (username, password)
VALUES ($1, $2)
RETURNING id, username, created_at
```

### 1.2 Get User by Credentials

**Operation**: Authenticate user login  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT id, username
FROM users
WHERE username = $1 AND password = $2
```

### 1.3 Check User Exists

**Operation**: Verify if username already exists  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT COUNT(*) as count
FROM users
WHERE username = $1
```

### 1.4 Delete User Account

**Operation**: Remove user account and all related data  
**Service**: `userRoutes.js`

```sql
DELETE FROM users WHERE id = $1 RETURNING username
```

---

## 2. USER TOPICS OPERATIONS

### 2.1 Create User Topic

**Operation**: Create a new learning topic for user  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
INSERT INTO user_topics (user_id, topic)
VALUES ($1, $2)
RETURNING id, user_id, topic, created_at
```

### 2.2 Get User Topics

**Operation**: Retrieve all topics for a user  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT *
FROM user_topics
WHERE user_id = $1
ORDER BY created_at DESC
```

### 2.3 Get User Topic by Name

**Operation**: Find specific topic by name for user  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT *
FROM user_topics
WHERE user_id = $1 AND topic = $2
```

### 2.4 Delete User Topics

**Operation**: Remove all topics for a user  
**Service**: `userRoutes.js`

```sql
DELETE FROM user_topics WHERE user_id = $1
```

---

## 3. USER ROADMAPS OPERATIONS

### 3.1 Create User Roadmap

**Operation**: Create a learning roadmap for a topic  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
INSERT INTO user_roadmaps (user_topic_id, roadmap_data)
VALUES ($1, $2)
RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
```

### 3.2 Get User Roadmaps

**Operation**: Retrieve all roadmaps for a user with progress  
**Services**: `neonDbService.js`, `supabaseService_new.js`

**Main Query:**

```sql
SELECT
  ur.id,
  ur.roadmap_data,
  ur.created_at,
  ur.updated_at,
  ut.user_id,
  ut.topic
FROM user_roadmaps ur
INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
WHERE ut.user_id = $1
ORDER BY ur.created_at DESC
```

**Progress Query:**

```sql
SELECT rp.roadmap_id, rp.point_id, rp.is_completed, rp.completed_at
FROM roadmap_progress rp
INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
WHERE ut.user_id = $1
```

### 3.3 Update User Roadmap

**Operation**: Update roadmap data  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
UPDATE user_roadmaps
SET roadmap_data = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
```

### 3.4 Delete User Roadmaps

**Operation**: Remove roadmaps for a user  
**Service**: `userRoutes.js`

```sql
DELETE FROM user_roadmaps
WHERE user_topic_id IN (
  SELECT id FROM user_topics WHERE user_id = $1
)
```

### 3.5 Delete Specific User Roadmap

**Operation**: Remove a specific roadmap and related data  
**Services**: `neonDbService.js`, `supabaseService_new.js`

**Ownership Check:**

```sql
SELECT ur.user_topic_id
FROM user_roadmaps ur
JOIN user_topics ut ON ur.user_topic_id = ut.id
WHERE ur.id = $1 AND ut.user_id = $2
```

**Delete Roadmap:**

```sql
DELETE FROM user_roadmaps WHERE id = $1
```

**Check Other Roadmaps:**

```sql
SELECT COUNT(*) as count FROM user_roadmaps WHERE user_topic_id = $1
```

**Delete Topic (if no other roadmaps):**

```sql
DELETE FROM user_topics WHERE id = $1
```

---

## 4. USER VIDEOS OPERATIONS

### 4.1 Create User Videos

**Operation**: Store video data for a roadmap level  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
INSERT INTO user_videos (user_roadmap_id, level, video_data)
VALUES ($1, $2, $3)
RETURNING id, user_roadmap_id, level, video_data, created_at
```

### 4.2 Store User Videos (with pagination)

**Operation**: Store videos with page and generation tracking  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, user_roadmap_id, level, video_data, page_number, generation_number, created_at
```

### 4.3 Update Existing User Videos

**Operation**: Update video data for existing entry  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
UPDATE user_videos
SET video_data = $1, updated_at = CURRENT_TIMESTAMP
WHERE user_roadmap_id = $2 AND level = $3
RETURNING *
```

### 4.4 Get User Videos

**Operation**: Retrieve videos for roadmap level with pagination  
**Services**: `neonDbService.js`, `supabaseService_new.js`

**Neon DB (Dynamic Query):**

```sql
SELECT *
FROM user_videos
WHERE user_roadmap_id = {userRoadmapId}
AND level = '{level}'
AND page_number = {page}
ORDER BY generation_number DESC, created_at DESC
```

**PostgreSQL (Parameterized Query):**

```sql
SELECT *
FROM user_videos
WHERE user_roadmap_id = $1
AND level = $2
AND page_number = $3
ORDER BY generation_number DESC, created_at DESC
```

### 4.5 Get Next Generation Number

**Operation**: Get the next generation number for video pagination  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT COALESCE(MAX(generation_number), 0) + 1 as next_generation
FROM user_videos
WHERE user_roadmap_id = $1 AND level = $2 AND page_number = $3
```

### 4.6 Move Videos to Next Page

**Operation**: Increment page numbers for existing videos  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
UPDATE user_videos
SET page_number = page_number + 1
WHERE user_roadmap_id = $1 AND level = $2
```

### 4.7 Delete User Videos

**Operation**: Remove videos for specific roadmap level  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
DELETE FROM user_videos
WHERE user_roadmap_id = $1 AND level = $2
RETURNING id
```

### 4.8 Delete All User Videos for Roadmap

**Operation**: Remove all videos for a roadmap  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
DELETE FROM user_videos WHERE user_roadmap_id = $1
```

### 4.9 Delete All User Videos (Bulk)

**Operation**: Remove all videos for a user  
**Service**: `userRoutes.js`

```sql
DELETE FROM user_videos
WHERE user_roadmap_id IN (
  SELECT ur.id FROM user_roadmaps ur
  JOIN user_topics ut ON ur.user_topic_id = ut.id
  WHERE ut.user_id = $1
)
```

---

## 5. ROADMAP PROGRESS OPERATIONS

### 5.1 Mark Roadmap Point Complete

**Operation**: Mark a roadmap point as completed/incomplete  
**Services**: `neonDbService.js`, `supabaseService_new.js`

**Check Existing Progress:**

```sql
SELECT * FROM roadmap_progress
WHERE user_id = $1 AND roadmap_id = $2 AND point_id = $3
```

**Update Existing Record:**

```sql
UPDATE roadmap_progress
SET is_completed = $4, completed_at = $5, updated_at = NOW()
WHERE user_id = $1 AND roadmap_id = $2 AND point_id = $3
RETURNING *
```

**Create New Record:**

```sql
INSERT INTO roadmap_progress (user_id, roadmap_id, point_id, is_completed, completed_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *
```

### 5.2 Get Roadmap Progress

**Operation**: Get progress for specific roadmap  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT * FROM roadmap_progress
WHERE user_id = $1 AND roadmap_id = $2
ORDER BY created_at ASC
```

### 5.3 Get All User Roadmap Progress

**Operation**: Get progress for all user roadmaps  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT rp.*, ur.roadmap_data
FROM roadmap_progress rp
INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
WHERE ut.user_id = $1
ORDER BY rp.created_at ASC
```

### 5.4 Delete Roadmap Progress

**Operation**: Remove progress for specific roadmap  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
DELETE FROM roadmap_progress WHERE roadmap_id = $1
```

### 5.5 Delete All User Progress

**Operation**: Remove all progress for a user  
**Service**: `userRoutes.js`

```sql
DELETE FROM roadmap_progress
WHERE roadmap_id IN (
  SELECT ur.id FROM user_roadmaps ur
  JOIN user_topics ut ON ur.user_topic_id = ut.id
  WHERE ut.user_id = $1
)
```

---

## 6. USER SETTINGS OPERATIONS

### 6.1 Get User Settings

**Operation**: Retrieve user preferences and settings  
**Service**: `neonDbService.js`

```sql
SELECT * FROM user_settings WHERE user_id = $1
```

### 6.2 Create User Settings

**Operation**: Create initial user settings  
**Service**: `neonDbService.js`

```sql
INSERT INTO user_settings (
  user_id, full_name, about_description, theme,
  default_roadmap_depth, default_video_length
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
```

### 6.3 Update User Settings

**Operation**: Update specific user settings  
**Service**: `neonDbService.js`

```sql
UPDATE user_settings
SET {dynamic_set_clause}, updated_at = NOW()
WHERE user_id = {userId}
RETURNING *
```

### 6.4 Upsert User Settings

**Operation**: Insert or update user settings  
**Service**: `neonDbService.js`

```sql
INSERT INTO user_settings (
  user_id, full_name, about_description, theme,
  default_roadmap_depth, default_video_length
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id)
DO UPDATE SET
  full_name = EXCLUDED.full_name,
  about_description = EXCLUDED.about_description,
  theme = EXCLUDED.theme,
  default_roadmap_depth = EXCLUDED.default_roadmap_depth,
  default_video_length = EXCLUDED.default_video_length,
  updated_at = NOW()
RETURNING *
```

### 6.5 Delete User Settings

**Operation**: Remove user settings  
**Service**: `neonDbService.js`, `userRoutes.js`

```sql
DELETE FROM user_settings WHERE user_id = $1
```

---

## 7. UTILITY OPERATIONS

### 7.1 Database Connection Test

**Operation**: Test database connectivity  
**Services**: `neonDbService.js`, `supabaseService_new.js`

```sql
SELECT NOW()
```

---

## 8. DATA CLEANUP OPERATIONS

### 8.1 Clear All User Data

**Operation**: Complete user data deletion (used in user account deletion)  
**Service**: `userRoutes.js`

**Execution Order:**

1. Delete roadmap progress
2. Delete user videos
3. Delete user roadmaps
4. Delete user topics
5. Delete user settings
6. Delete user account

```sql
-- 1. Delete roadmap progress
DELETE FROM roadmap_progress
WHERE roadmap_id IN (
  SELECT ur.id FROM user_roadmaps ur
  JOIN user_topics ut ON ur.user_topic_id = ut.id
  WHERE ut.user_id = $1
);

-- 2. Delete user videos
DELETE FROM user_videos
WHERE user_roadmap_id IN (
  SELECT ur.id FROM user_roadmaps ur
  JOIN user_topics ut ON ur.user_topic_id = ut.id
  WHERE ut.user_id = $1
);

-- 3. Delete user roadmaps
DELETE FROM user_roadmaps
WHERE user_topic_id IN (
  SELECT id FROM user_topics WHERE user_id = $1
);

-- 4. Delete user topics
DELETE FROM user_topics WHERE user_id = $1;

-- 5. Delete user settings
DELETE FROM user_settings WHERE user_id = $1;

-- 6. Delete user account
DELETE FROM users WHERE id = $1 RETURNING username;
```

---

## Database Architecture Notes

### Foreign Key Relationships

- `user_topics.user_id` → `users.id`
- `user_roadmaps.user_topic_id` → `user_topics.id`
- `user_videos.user_roadmap_id` → `user_roadmaps.id`
- `roadmap_progress.user_id` → `users.id`
- `roadmap_progress.roadmap_id` → `user_roadmaps.id`
- `user_settings.user_id` → `users.id`

### Data Types

- **JSON Fields**: `roadmap_data`, `video_data` (stored as JSON strings)
- **Timestamps**: All tables include `created_at` and `updated_at` fields
- **Text Fields**: `username`, `password`, `topic`, `full_name`, `about_description`
- **Enums**: `theme` ('light'|'dark'), `level` ('beginner'|'intermediate'|'advanced'), `default_roadmap_depth` ('basic'|'detailed'|'comprehensive'), `default_video_length` ('short'|'medium'|'long')

### Database Services

- **neonDbService.js**: Uses Neon serverless PostgreSQL with template literals
- **supabaseService_new.js**: Uses PostgreSQL connection pool with parameterized queries

### Security Features

- Parameterized queries to prevent SQL injection
- User ownership verification for data access
- Soft deletion patterns for maintaining data integrity

---

## Performance Considerations

### Indexes (Recommended)

```sql
-- User lookups
CREATE INDEX idx_users_username ON users(username);

-- Topic queries
CREATE INDEX idx_user_topics_user_id ON user_topics(user_id);
CREATE INDEX idx_user_topics_user_topic ON user_topics(user_id, topic);

-- Roadmap queries
CREATE INDEX idx_user_roadmaps_topic_id ON user_roadmaps(user_topic_id);

-- Video queries
CREATE INDEX idx_user_videos_roadmap_level ON user_videos(user_roadmap_id, level);
CREATE INDEX idx_user_videos_pagination ON user_videos(user_roadmap_id, level, page_number, generation_number);

-- Progress queries
CREATE INDEX idx_roadmap_progress_user_roadmap ON roadmap_progress(user_id, roadmap_id);
CREATE INDEX idx_roadmap_progress_point ON roadmap_progress(roadmap_id, point_id);

-- Settings queries
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

### Query Optimization

- Uses JOINs to minimize database round trips
- Implements pagination for large video datasets
- Batches related operations in transactions
- Uses RETURNING clauses to get updated data in single query

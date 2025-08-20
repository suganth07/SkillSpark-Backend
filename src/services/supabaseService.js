import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

class SupabaseService {
  constructor() {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is required for PostgreSQL connection');
      this.pool = null;
      return;
    }

    try {
      console.log('🔗 Connecting to database...');
      console.log('🔗 Database URL (masked):', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
      
      // Initialize PostgreSQL connection pool for raw SQL only
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
          require: true
        },
        // Improved connection pool settings for better performance and timeout handling
        max: 10,                      // Maximum number of clients in pool
        min: 2,                       // Minimum number of clients in pool
        idleTimeoutMillis: 30000,     // Close idle clients after 30 seconds
        connectionTimeoutMillis: 8000, // Timeout for acquiring connection (increased)
        acquireTimeoutMillis: 60000,   // Timeout for acquiring connection from pool
        createTimeoutMillis: 10000,    // Timeout for creating new connection
        destroyTimeoutMillis: 5000,    // Timeout for destroying connection
        reapIntervalMillis: 1000,      // How often to check for idle connections
        createRetryIntervalMillis: 200, // Retry interval for failed connections
        query_timeout: 15000,          // Query timeout (increased)
        statement_timeout: 15000,      // Statement timeout (increased)
      });

      // Add error handling for pool events
      this.pool.on('error', (err) => {
        console.warn('⚠️ PostgreSQL pool error:', err.message);
      });

      this.pool.on('connect', (client) => {
        console.log('🔗 New PostgreSQL client connected');
      });

      this.pool.on('remove', (client) => {
        console.log('🔌 PostgreSQL client removed from pool');
      });
      
      console.log('✅ PostgreSQL pool initialized successfully');
      
      // Test the connection asynchronously
      this.testConnection().catch(error => {
        console.warn('⚠️ PostgreSQL connection test failed:', error.message);
      });
      
    } catch (error) {
      console.error('Failed to initialize database connection:', error.message);
      this.pool = null;
    }
  }

  async testConnection() {
    if (!this.pool) return;
    
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('✅ Database connection test successful:', result.rows[0]);
      client.release();
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      throw error;
    }
  }

  // Gracefully close the pool
  async closePool() {
    if (this.pool) {
      try {
        await this.pool.end();
        console.log('🔌 PostgreSQL pool closed gracefully');
      } catch (error) {
        console.error('❌ Error closing PostgreSQL pool:', error.message);
      }
      this.pool = null;
    }
  }

  // Helper method for executing queries with proper timeout and connection management
  async executeQuery(query, params = [], timeout = 10000) {
    this._checkConnection();
    let client;
    
    try {
      // Get client from pool with timeout
      client = await Promise.race([
        this.pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection acquisition timeout')), 5000)
        )
      ]);
      
      console.log('🔗 Client acquired from pool');
      
      // Execute query with timeout
      const result = await Promise.race([
        client.query(query, params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query execution timeout')), timeout)
        )
      ]);
      
      return result;
      
    } catch (error) {
      console.error('❌ Query execution error:', error.message);
      throw error;
    } finally {
      if (client) {
        client.release();
        console.log('🔌 Client released back to pool');
      }
    }
  }

  _checkConnection() {
    if (!this.pool) {
      throw new Error('No database connection available. Please check your configuration.');
    }
  }

  // User management
  async createUser(username, password) {
    this._checkConnection();
    try {
      const query = `
        INSERT INTO users (username, password)
        VALUES ($1, $2)
        RETURNING id, username, created_at
      `;
      
      const result = await this.pool.query(query, [username, password]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getUserByCredentials(username, password) {
    this._checkConnection();
    try {
      console.log('🔍 Attempting to get user by credentials via PostgreSQL:', username);
      
      const query = `
        SELECT id, username 
        FROM users 
        WHERE username = $1 AND password = $2
      `;
      
      console.log('📋 Executing query:', query);
      console.log('📋 Query parameters:', [username, '***']);
      
      const result = await this.pool.query(query, [username, password]);
      
      console.log('📊 Query result:', {
        rowCount: result.rowCount,
        hasRows: result.rows.length > 0,
        firstRow: result.rows.length > 0 ? { id: result.rows[0].id, username: result.rows[0].username } : null
      });
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('❌ Database query error:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint
      });
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async checkUserExists(username) {
    this._checkConnection();
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM users 
        WHERE username = $1
      `;
      
      const result = await this.pool.query(query, [username]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  // User Topics
  async createUserTopic(userId, topic) {
    this._checkConnection();
    try {
      const query = `
        INSERT INTO user_topics (user_id, topic)
        VALUES ($1, $2)
        RETURNING id, user_id, topic, created_at
      `;
      
      const result = await this.pool.query(query, [userId, topic]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create user topic: ${error.message}`);
    }
  }

  async getUserTopics(userId) {
    this._checkConnection();
    try {
      const query = `
        SELECT * 
        FROM user_topics 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows || [];
    } catch (error) {
      throw new Error(`Failed to get user topics: ${error.message}`);
    }
  }

  async getUserTopicByName(userId, topicName) {
    this._checkConnection();
    try {
      const query = `
        SELECT * 
        FROM user_topics 
        WHERE user_id = $1 AND topic = $2
      `;
      
      const result = await this.pool.query(query, [userId, topicName]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      throw new Error(`Failed to get user topic by name: ${error.message}`);
    }
  }

  // User Roadmaps
  async createUserRoadmap(userTopicId, roadmapData) {
    this._checkConnection();
    try {
      const query = `
        INSERT INTO user_roadmaps (user_topic_id, roadmap_data)
        VALUES ($1, $2)
        RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
      `;
      
      const result = await this.pool.query(query, [userTopicId, JSON.stringify(roadmapData)]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create user roadmap: ${error.message}`);
    }
  }

  async getUserRoadmaps(userId) {
    try {
      console.log('🔍 Fetching roadmaps for user ID:', userId);
      
      const query = `
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
      `;
      
      const result = await this.executeQuery(query, [userId], 10000);
      
      // Get progress data for all roadmaps
      const progressQuery = `
        SELECT rp.roadmap_id, rp.point_id, rp.is_completed, rp.completed_at
        FROM roadmap_progress rp
        INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = $1
      `;
      
      const progressResult = await this.executeQuery(progressQuery, [userId], 10000);
      const progressMap = new Map();
      
      // Group progress by roadmap_id
      progressResult.rows.forEach(row => {
        if (!progressMap.has(row.roadmap_id)) {
          progressMap.set(row.roadmap_id, {});
        }
        progressMap.get(row.roadmap_id)[row.point_id] = {
          isCompleted: row.is_completed,
          completedAt: row.completed_at
        };
      });
      
      // Transform the data to match frontend expectations and merge progress
      const transformedData = result.rows.map(item => {
        const roadmapData = typeof item.roadmap_data === 'string' ? JSON.parse(item.roadmap_data) : item.roadmap_data;
        const progressData = progressMap.get(item.id) || {};
        
        // Update points with progress data
        if (roadmapData.points) {
          roadmapData.points = roadmapData.points.map(point => ({
            ...point,
            isCompleted: progressData[point.id]?.isCompleted || false
          }));
          
          // Recalculate progress
          const completedPoints = roadmapData.points.filter(point => point.isCompleted).length;
          const totalPoints = roadmapData.points.length;
          const percentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
          
          roadmapData.progress = {
            completedPoints,
            totalPoints,
            percentage
          };
        }
        
        return {
          id: item.id,
          userId: item.user_id,
          topic: item.topic,
          roadmapData: roadmapData,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        };
      });
      
      return transformedData;
    } catch (error) {
      throw new Error(`Failed to get user roadmaps: ${error.message}`);
    }
  }

  async updateUserRoadmap(roadmapId, roadmapData) {
    this._checkConnection();
    try {
      const query = `
        UPDATE user_roadmaps 
        SET roadmap_data = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
      `;
      
      const result = await this.pool.query(query, [roadmapId, JSON.stringify(roadmapData)]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update user roadmap: ${error.message}`);
    }
  }

  // User Videos (Weak Entity - no id column)
  async createUserVideos(userRoadmapId, level, videoData) {
    this._checkConnection();
    try {
      const query = `
        INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number)
        VALUES ($1, $2, $3, 1, 1)
        RETURNING user_roadmap_id, level, video_data, page_number, generation_number, created_at
      `;
      
      const result = await this.pool.query(query, [userRoadmapId, level, JSON.stringify(videoData)]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create user videos: ${error.message}`);
    }
  }

  // Roadmap Progress Management
  async markRoadmapPointComplete(userId, roadmapId, pointId, isCompleted) {
    this._checkConnection();
    try {
      // Check if progress record exists
      const checkQuery = `
        SELECT * FROM roadmap_progress 
        WHERE user_id = $1 AND roadmap_id = $2 AND point_id = $3
      `;
      const checkResult = await this.pool.query(checkQuery, [userId, roadmapId, pointId]);

      if (checkResult.rows.length > 0) {
        // Update existing record
        const updateQuery = `
          UPDATE roadmap_progress 
          SET is_completed = $4, completed_at = $5, updated_at = NOW()
          WHERE user_id = $1 AND roadmap_id = $2 AND point_id = $3
          RETURNING *
        `;
        const completedAt = isCompleted ? new Date().toISOString() : null;
        const result = await this.pool.query(updateQuery, [userId, roadmapId, pointId, isCompleted, completedAt]);
        return result.rows[0];
      } else {
        // Create new record
        const insertQuery = `
          INSERT INTO roadmap_progress (user_id, roadmap_id, point_id, is_completed, completed_at)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const completedAt = isCompleted ? new Date().toISOString() : null;
        const result = await this.pool.query(insertQuery, [userId, roadmapId, pointId, isCompleted, completedAt]);
        return result.rows[0];
      }
    } catch (error) {
      throw new Error(`Failed to mark roadmap point complete: ${error.message}`);
    }
  }

  async getRoadmapProgress(userId, roadmapId) {
    this._checkConnection();
    try {
      const query = `
        SELECT * FROM roadmap_progress 
        WHERE user_id = $1 AND roadmap_id = $2
        ORDER BY created_at ASC
      `;
      
      const result = await this.pool.query(query, [userId, roadmapId]);
      return result.rows || [];
    } catch (error) {
      throw new Error(`Failed to get roadmap progress: ${error.message}`);
    }
  }

  async getAllUserRoadmapProgress(userId) {
    this._checkConnection();
    try {
      const query = `
        SELECT rp.*, ur.roadmap_data 
        FROM roadmap_progress rp
        INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = $1
        ORDER BY rp.created_at ASC
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows || [];
    } catch (error) {
      throw new Error(`Failed to get all user roadmap progress: ${error.message}`);
    }
  }

  async storeUserVideos(userRoadmapId, level, videoData) {
    this._checkConnection();
    try {
      // First check if videos already exist for this level (get the latest generation)
      const existingVideos = await this.getUserVideos(userRoadmapId, level, 1);
      
      if (existingVideos.length > 0) {
        // Update the latest generation entry for page 1
        const latestVideo = existingVideos[0]; // Already ordered by generation_number DESC
        const query = `
          UPDATE user_videos 
          SET video_data = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_roadmap_id = $2 AND level = $3 AND page_number = $4 AND generation_number = $5
          RETURNING *
        `;
        const result = await this.pool.query(query, [
          JSON.stringify(videoData), 
          userRoadmapId, 
          level, 
          latestVideo.page_number, 
          latestVideo.generation_number
        ]);
        return result.rows[0];
      } else {
        // Insert new entry
        const query = `
          INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, created_at, updated_at)
          VALUES ($1, $2, $3, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        const result = await this.pool.query(query, [userRoadmapId, level, JSON.stringify(videoData)]);
        return result.rows[0];
      }
    } catch (error) {
      throw new Error(`Failed to store user videos: ${error.message}`);
    }
  }

  async getUserVideos(userRoadmapId, level = null, page = 1) {
    this._checkConnection();
    try {
      let query = `
        SELECT * 
        FROM user_videos 
        WHERE user_roadmap_id = $1
      `;
      let params = [userRoadmapId];

      if (level) {
        query += ` AND level = $2`;
        params.push(level);
      }

      if (page) {
        query += ` AND page_number = $${params.length + 1}`;
        params.push(page);
      }

      query += ` ORDER BY generation_number DESC, created_at DESC`;

      const result = await this.pool.query(query, params);
      
      // Parse video_data if it's a string
      const transformedData = result.rows.map(item => ({
        ...item,
        video_data: typeof item.video_data === 'string' ? JSON.parse(item.video_data) : item.video_data
      }));
      
      return transformedData;
    } catch (error) {
      throw new Error(`Failed to get user videos: ${error.message}`);
    }
  }

  async storeUserVideos(userRoadmapId, level, videoData, pageNumber = 1, isRegenerate = false) {
    this._checkConnection();
    try {
      // If this is a regenerate operation, move existing videos to next pages
      if (isRegenerate) {
        await this.moveVideosToNextPage(userRoadmapId, level);
      }

      // Get the next generation number for this page
      const generationNumber = await this.getNextGenerationNumber(userRoadmapId, level, pageNumber);

      const query = `
        INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_roadmap_id, level, video_data, page_number, generation_number, created_at
      `;
      
      const result = await this.pool.query(query, [userRoadmapId, level, JSON.stringify(videoData), pageNumber, generationNumber]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to store user videos: ${error.message}`);
    }
  }

  async getNextGenerationNumber(userRoadmapId, level, pageNumber) {
    this._checkConnection();
    try {
      const query = `
        SELECT COALESCE(MAX(generation_number), 0) + 1 as next_generation
        FROM user_videos 
        WHERE user_roadmap_id = $1 AND level = $2 AND page_number = $3
      `;
      
      const result = await this.pool.query(query, [userRoadmapId, level, pageNumber]);
      return result.rows[0].next_generation;
    } catch (error) {
      throw new Error(`Failed to get next generation number: ${error.message}`);
    }
  }

  async moveVideosToNextPage(userRoadmapId, level) {
    this._checkConnection();
    try {
      const query = `
        UPDATE user_videos 
        SET page_number = page_number + 1
        WHERE user_roadmap_id = $1 AND level = $2
      `;
      
      const result = await this.pool.query(query, [userRoadmapId, level]);
      return result.rowCount;
    } catch (error) {
      throw new Error(`Failed to move videos to next page: ${error.message}`);
    }
  }

  async deleteUserVideos(userRoadmapId, level) {
    this._checkConnection();
    try {
      const query = `
        DELETE FROM user_videos 
        WHERE user_roadmap_id = $1 AND level = $2
        RETURNING user_roadmap_id, level
      `;
      
      const result = await this.pool.query(query, [userRoadmapId, level]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to delete user videos: ${error.message}`);
    }
  }

  async deleteUserRoadmap(roadmapId, userId) {
    this._checkConnection();
    try {
      console.log(`🗑️ Deleting roadmap ${roadmapId} for user ${userId} using PostgreSQL pool`);
      
      // First, get the user_topic_id for the roadmap to verify ownership
      const checkOwnershipQuery = `
        SELECT ur.user_topic_id 
        FROM user_roadmaps ur
        JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ur.id = $1 AND ut.user_id = $2
      `;
      const ownershipResult = await this.pool.query(checkOwnershipQuery, [roadmapId, userId]);
      
      if (ownershipResult.rows.length === 0) {
        throw new Error('Roadmap not found or not owned by user');
      }
      
      const userTopicId = ownershipResult.rows[0].user_topic_id;
      
      // Delete in correct order: child tables first, then parent tables
      
      // 1. Delete roadmap progress
      try {
        const deleteProgressQuery = `DELETE FROM roadmap_progress WHERE roadmap_id = $1`;
        await this.pool.query(deleteProgressQuery, [roadmapId]);
        console.log('✅ Deleted roadmap progress');
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log('⚠️ roadmap_progress table does not exist, skipping...');
        } else {
          throw error;
        }
      }

      // 2. Delete user videos
      try {
        const deleteVideosQuery = `DELETE FROM user_videos WHERE user_roadmap_id = $1`;
        await this.pool.query(deleteVideosQuery, [roadmapId]);
        console.log('✅ Deleted user videos');
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log('⚠️ user_videos table does not exist, skipping...');
        } else {
          throw error;
        }
      }

      // 3. Delete user roadmap
      const deleteRoadmapQuery = `DELETE FROM user_roadmaps WHERE id = $1`;
      await this.pool.query(deleteRoadmapQuery, [roadmapId]);
      console.log('✅ Deleted user roadmap');

      // 4. Delete user topic (if no other roadmaps reference it)
      const checkOtherRoadmapsQuery = `SELECT COUNT(*) as count FROM user_roadmaps WHERE user_topic_id = $1`;
      const otherRoadmapsResult = await this.pool.query(checkOtherRoadmapsQuery, [userTopicId]);
      
      if (otherRoadmapsResult.rows[0].count == 0) {
        const deleteTopicQuery = `DELETE FROM user_topics WHERE id = $1`;
        await this.pool.query(deleteTopicQuery, [userTopicId]);
        console.log('✅ Deleted user topic (no other roadmaps reference it)');
      } else {
        console.log('ℹ️ User topic kept (other roadmaps still reference it)');
      }
      
      console.log(`✅ Successfully deleted roadmap ${roadmapId} and all related data`);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete roadmap: ${error.message}`);
    }
  }

  // User Settings Management
  async createUserSettings(userId, settings = {}) {
    this._checkConnection();
    try {
      const {
        full_name = null,
        about_description = null,
        theme = 'light',
        default_roadmap_depth = 'detailed',
        default_video_length = 'medium'
      } = settings;

      const query = `
        INSERT INTO user_settings (
          user_id, full_name, about_description, theme, 
          default_roadmap_depth, default_video_length
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        userId, full_name, about_description, theme, 
        default_roadmap_depth, default_video_length
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create user settings: ${error.message}`);
    }
  }

  async getUserSettings(userId) {
    try {
      console.log('🔍 Fetching user settings for user ID:', userId);
      
      const query = `
        SELECT * FROM user_settings WHERE user_id = $1
      `;
      
      const result = await this.executeQuery(query, [userId], 8000);
      
      // If no settings exist, return null (don't auto-create)
      if (result.rows.length === 0) {
        console.log('⚠️  No user settings found for user:', userId);
        return null;
      }
      
      console.log('✅ User settings found successfully');
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in getUserSettings:', error.message);
      throw new Error(`Failed to get user settings: ${error.message}`);
    }
  }

  async updateUserSettings(userId, settings) {
    try {
      const updateFields = [];
      const values = [userId];
      let paramCount = 1;

      // Build dynamic update query based on provided fields
      if (settings.full_name !== undefined) {
        updateFields.push(`full_name = $${++paramCount}`);
        values.push(settings.full_name);
      }
      
      if (settings.about_description !== undefined) {
        updateFields.push(`about_description = $${++paramCount}`);
        values.push(settings.about_description);
      }
      
      if (settings.theme !== undefined) {
        updateFields.push(`theme = $${++paramCount}`);
        values.push(settings.theme);
      }
      
      if (settings.default_roadmap_depth !== undefined) {
        updateFields.push(`default_roadmap_depth = $${++paramCount}`);
        values.push(settings.default_roadmap_depth);
      }
      
      if (settings.default_video_length !== undefined) {
        updateFields.push(`default_video_length = $${++paramCount}`);
        values.push(settings.default_video_length);
      }

      if (updateFields.length === 0) {
        // No fields to update, return current settings
        return await this.getUserSettings(userId);
      }

      const query = `
        UPDATE user_settings 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `;
      
      const result = await this.executeQuery(query, values, 8000);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error in updateUserSettings:', error.message);
      throw new Error(`Failed to update user settings: ${error.message}`);
    }
  }

  async deleteUserSettings(userId) {
    this._checkConnection();
    try {
      const query = `
        DELETE FROM user_settings WHERE user_id = $1
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to delete user settings: ${error.message}`);
    }
  }
}

export default new SupabaseService();

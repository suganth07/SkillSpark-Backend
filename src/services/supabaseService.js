import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

class SupabaseService {
  constructor() {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is required for PostgreSQL connection');
      this.pool = null;
      this.supabase = null;
      return;
    }

    try {
      console.log('🔗 Connecting to database...');
      console.log('🔗 Database URL (masked):', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
      
      // Initialize PostgreSQL connection pool for raw SQL
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
          require: true
        },
        // Add connection pool settings for Supabase
        max: 5, // Lower connection count for better performance
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000, // Longer timeout for initial connection
        query_timeout: 60000,
        statement_timeout: 60000,
      });

      // Add error handling for pool events
      this.pool.on('error', (err) => {
        console.warn('⚠️ PostgreSQL pool error:', err.message);
        console.log('🔄 Disabling PostgreSQL pool, will use Supabase client fallback');
        this.pool = null; // Disable pool on error
      });

      this.pool.on('connect', (client) => {
        console.log('🔗 New PostgreSQL client connected');
      });

      this.pool.on('remove', (client) => {
        console.log('🔌 PostgreSQL client removed from pool');
      });
      
      // Initialize Supabase client only for auth (optional)
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        this.supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
      } else {
        this.supabase = null;
      }
      
      console.log('✅ PostgreSQL pool initialized successfully');
      
      // Test the connection asynchronously (don't block startup)
      this.testConnection().catch(error => {
        console.warn('⚠️ PostgreSQL connection test failed, will use Supabase client fallback');
        this.pool = null; // Disable pool if connection fails
      });
      
    } catch (error) {
      console.error('Failed to initialize database connections:', error.message);
      this.pool = null;
      this.supabase = null;
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
      console.log('🔄 Disabling PostgreSQL pool due to connection failure');
      this.pool = null; // Disable pool if connection test fails
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

  _checkConnection() {
    if (!this.pool && !this.supabase) {
      throw new Error('No database connection available. Please check your configuration.');
    }
    
    // If pool was disabled due to errors, ensure we log this
    if (!this.pool && this.supabase) {
      console.log('🔄 Using Supabase client fallback (PostgreSQL pool unavailable)');
    }
  }

  // User management
  async createUser(username, password) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          INSERT INTO users (username, password)
          VALUES ($1, $2)
          RETURNING id, username, created_at
        `;
        
        const result = await this.pool.query(query, [username, password]);
        return result.rows[0];
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for user creation');
        
        const { data, error } = await this.supabase
          .from('users')
          .insert([{ username, password }])
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getUserByCredentials(username, password) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
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
      } 
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for user authentication');
        
        const { data, error } = await this.supabase
          .from('users')
          .select('id, username')
          .eq('username', username)
          .eq('password', password)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return null; // No user found
          }
          throw error;
        }
        return data;
      } else {
        throw new Error('No database connection available');
      }
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
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          SELECT COUNT(*) as count 
          FROM users 
          WHERE username = $1
        `;
        
        const result = await this.pool.query(query, [username]);
        return parseInt(result.rows[0].count) > 0;
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for user existence check');
        
        const { data, error } = await this.supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        return data !== null;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  // User Topics
  async createUserTopic(userId, topic) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          INSERT INTO user_topics (user_id, topic)
          VALUES ($1, $2)
          RETURNING id, user_id, topic, created_at
        `;
        
        const result = await this.pool.query(query, [userId, topic]);
        return result.rows[0];
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for creating user topic');
        
        const { data, error } = await this.supabase
          .from('user_topics')
          .insert([{ user_id: userId, topic: topic }])
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        throw new Error('No database connection available');
      }
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
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          SELECT * 
          FROM user_topics 
          WHERE user_id = $1 AND topic = $2
        `;
        
        const result = await this.pool.query(query, [userId, topicName]);
        return result.rows.length > 0 ? result.rows[0] : null;
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for getting user topic by name');
        
        const { data, error } = await this.supabase
          .from('user_topics')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', topicName)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return null; // No topic found
          }
          throw error;
        }
        return data;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to get user topic by name: ${error.message}`);
    }
  }

  // User Roadmaps
  async createUserRoadmap(userTopicId, roadmapData) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          INSERT INTO user_roadmaps (user_topic_id, roadmap_data)
          VALUES ($1, $2)
          RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
        `;
        
        const result = await this.pool.query(query, [userTopicId, JSON.stringify(roadmapData)]);
        return result.rows[0];
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for creating user roadmap');
        
        const { data, error } = await this.supabase
          .from('user_roadmaps')
          .insert([{ 
            user_topic_id: userTopicId, 
            roadmap_data: roadmapData 
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to create user roadmap: ${error.message}`);
    }
  }

  async getUserRoadmaps(userId) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
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
        
        const result = await this.pool.query(query, [userId]);
        
        // Get progress data for all roadmaps
        const progressQuery = `
          SELECT rp.roadmap_id, rp.point_id, rp.is_completed, rp.completed_at
          FROM roadmap_progress rp
          INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
          INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
          WHERE ut.user_id = $1
        `;
        
        const progressResult = await this.pool.query(progressQuery, [userId]);
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
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for getting user roadmaps');
        console.log('🔍 Querying roadmaps for user ID:', userId);
        
        // Get user topics first
        const { data: userTopics, error: topicsError } = await this.supabase
          .from('user_topics')
          .select('id, topic')
          .eq('user_id', userId);

        if (topicsError) throw topicsError;

        console.log('📂 Found user topics:', userTopics);

        if (!userTopics || userTopics.length === 0) {
          console.log('⚠️ No topics found for user:', userId);
          return []; // No topics found for user
        }

        // Get roadmaps for all user topics
        const topicIds = userTopics.map(topic => topic.id);
        console.log('🔍 Searching roadmaps for topic IDs:', topicIds);
        
        const { data: roadmaps, error: roadmapsError } = await this.supabase
          .from('user_roadmaps')
          .select('id, user_topic_id, roadmap_data, created_at, updated_at')
          .in('user_topic_id', topicIds)
          .order('created_at', { ascending: false });

        if (roadmapsError) throw roadmapsError;

        console.log('📊 Raw roadmaps from database:', roadmaps);

        // Get progress data for all roadmaps
        let progressData = [];
        if (roadmaps && roadmaps.length > 0) {
          const roadmapIds = roadmaps.map(rm => rm.id);
          const { data: progress, error: progressError } = await this.supabase
            .from('roadmap_progress')
            .select('roadmap_id, point_id, is_completed, completed_at')
            .in('roadmap_id', roadmapIds);

          if (progressError) throw progressError;
          progressData = progress || [];
        }

        // Group progress by roadmap_id
        const progressMap = new Map();
        progressData.forEach(row => {
          if (!progressMap.has(row.roadmap_id)) {
            progressMap.set(row.roadmap_id, {});
          }
          progressMap.get(row.roadmap_id)[row.point_id] = {
            isCompleted: row.is_completed,
            completedAt: row.completed_at
          };
        });

        // Transform the data to match frontend expectations and merge progress
        const transformedData = (roadmaps || []).map(roadmap => {
          const topic = userTopics.find(t => t.id === roadmap.user_topic_id);
          const roadmapData = typeof roadmap.roadmap_data === 'string' ? JSON.parse(roadmap.roadmap_data) : roadmap.roadmap_data;
          const progressForRoadmap = progressMap.get(roadmap.id) || {};
          
          // Update points with progress data
          if (roadmapData.points) {
            roadmapData.points = roadmapData.points.map(point => ({
              ...point,
              isCompleted: progressForRoadmap[point.id]?.isCompleted || false
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
            id: roadmap.id,
            userId: userId,
            topic: topic?.topic || 'Unknown',
            roadmapData: roadmapData,
            createdAt: roadmap.created_at,
            updatedAt: roadmap.updated_at
          };
        });
        
        console.log('✅ Transformed roadmaps with progress for user:', transformedData);
        
        return transformedData;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to get user roadmaps: ${error.message}`);
    }
  }

  async updateUserRoadmap(roadmapId, roadmapData) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          UPDATE user_roadmaps 
          SET roadmap_data = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
        `;
        
        const result = await this.pool.query(query, [roadmapId, JSON.stringify(roadmapData)]);
        return result.rows[0];
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for updating user roadmap');
        
        const { data, error } = await this.supabase
          .from('user_roadmaps')
          .update({ 
            roadmap_data: roadmapData,
            updated_at: new Date().toISOString()
          })
          .eq('id', roadmapId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to update user roadmap: ${error.message}`);
    }
  }

  // User Videos
  async createUserVideos(userRoadmapId, level, videoData) {
    this._checkConnection();
    try {
      const query = `
        INSERT INTO user_videos (user_roadmap_id, level, video_data)
        VALUES ($1, $2, $3)
        RETURNING id, user_roadmap_id, level, video_data, created_at
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
      // Try PostgreSQL first
      if (this.pool) {
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
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for roadmap progress');
        
        // Check if record exists
        const { data: existingRecord } = await this.supabase
          .from('roadmap_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('roadmap_id', roadmapId)
          .eq('point_id', pointId)
          .single();

        const completedAt = isCompleted ? new Date().toISOString() : null;

        if (existingRecord) {
          // Update existing record
          const { data, error } = await this.supabase
            .from('roadmap_progress')
            .update({ 
              is_completed: isCompleted, 
              completed_at: completedAt,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('roadmap_id', roadmapId)
            .eq('point_id', pointId)
            .select()
            .single();

          if (error) throw error;
          return data;
        } else {
          // Create new record
          const { data, error } = await this.supabase
            .from('roadmap_progress')
            .insert([{ 
              user_id: userId, 
              roadmap_id: roadmapId, 
              point_id: pointId,
              is_completed: isCompleted,
              completed_at: completedAt
            }])
            .select()
            .single();

          if (error) throw error;
          return data;
        }
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to mark roadmap point complete: ${error.message}`);
    }
  }

  async getRoadmapProgress(userId, roadmapId) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          SELECT * FROM roadmap_progress 
          WHERE user_id = $1 AND roadmap_id = $2
          ORDER BY created_at ASC
        `;
        
        const result = await this.pool.query(query, [userId, roadmapId]);
        return result.rows || [];
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for getting roadmap progress');
        
        const { data, error } = await this.supabase
          .from('roadmap_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('roadmap_id', roadmapId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to get roadmap progress: ${error.message}`);
    }
  }

  async getAllUserRoadmapProgress(userId) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
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
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for getting all user roadmap progress');
        
        // First get user roadmaps
        const { data: userTopics } = await this.supabase
          .from('user_topics')
          .select('id')
          .eq('user_id', userId);

        if (!userTopics || userTopics.length === 0) {
          return [];
        }

        const topicIds = userTopics.map(topic => topic.id);

        const { data: roadmaps } = await this.supabase
          .from('user_roadmaps')
          .select('id')
          .in('user_topic_id', topicIds);

        if (!roadmaps || roadmaps.length === 0) {
          return [];
        }

        const roadmapIds = roadmaps.map(roadmap => roadmap.id);

        const { data, error } = await this.supabase
          .from('roadmap_progress')
          .select('*')
          .in('roadmap_id', roadmapIds)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to get all user roadmap progress: ${error.message}`);
    }
  }

  async storeUserVideos(userRoadmapId, level, videoData) {
    try {
      if (!this.pool) {
        throw new Error('PostgreSQL connection not available');
      }

      // First check if videos already exist for this level
      const existingVideos = await this.getUserVideos(userRoadmapId, level);
      
      if (existingVideos.length > 0) {
        // Update existing entry
        const query = `
          UPDATE user_videos 
          SET video_data = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_roadmap_id = $2 AND level = $3
          RETURNING *
        `;
        const result = await this.pool.query(query, [JSON.stringify(videoData), userRoadmapId, level]);
        return result.rows[0];
      } else {
        // Insert new entry
        const query = `
          INSERT INTO user_videos (user_roadmap_id, level, video_data, created_at, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
      // Try PostgreSQL first
      if (this.pool) {
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
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for getting user videos');
        
        let query = this.supabase
          .from('user_videos')
          .select('*')
          .eq('user_roadmap_id', userRoadmapId);

        if (level) {
          query = query.eq('level', level);
        }

        if (page) {
          query = query.eq('page_number', page);
        }

        const { data, error } = await query.order('generation_number', { ascending: false })
                                           .order('created_at', { ascending: false });

        if (error) throw error;
        
        return data || [];
      } else {
        throw new Error('No database connection available');
      }
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

      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, user_roadmap_id, level, video_data, page_number, generation_number, created_at
        `;
        
        const result = await this.pool.query(query, [userRoadmapId, level, JSON.stringify(videoData), pageNumber, generationNumber]);
        return result.rows[0];
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for storing user videos');
        
        // Insert new videos with pagination support
        const { data, error } = await this.supabase
          .from('user_videos')
          .insert([{ 
            user_roadmap_id: userRoadmapId, 
            level: level,
            video_data: videoData,
            page_number: pageNumber,
            generation_number: generationNumber
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to store user videos: ${error.message}`);
    }
  }

  async getNextGenerationNumber(userRoadmapId, level, pageNumber) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          SELECT COALESCE(MAX(generation_number), 0) + 1 as next_generation
          FROM user_videos 
          WHERE user_roadmap_id = $1 AND level = $2 AND page_number = $3
        `;
        
        const result = await this.pool.query(query, [userRoadmapId, level, pageNumber]);
        return result.rows[0].next_generation;
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        const { data, error } = await this.supabase
          .from('user_videos')
          .select('generation_number')
          .eq('user_roadmap_id', userRoadmapId)
          .eq('level', level)
          .eq('page_number', pageNumber)
          .order('generation_number', { ascending: false })
          .limit(1);

        if (error) throw error;
        
        return data && data.length > 0 ? data[0].generation_number + 1 : 1;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to get next generation number: ${error.message}`);
    }
  }

  async moveVideosToNextPage(userRoadmapId, level) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          UPDATE user_videos 
          SET page_number = page_number + 1
          WHERE user_roadmap_id = $1 AND level = $2
        `;
        
        const result = await this.pool.query(query, [userRoadmapId, level]);
        return result.rowCount;
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        // First get all existing videos
        const { data: existingVideos, error: selectError } = await this.supabase
          .from('user_videos')
          .select('id, page_number')
          .eq('user_roadmap_id', userRoadmapId)
          .eq('level', level);

        if (selectError) throw selectError;

        // Update each video to increment page number
        for (const video of existingVideos || []) {
          const { error: updateError } = await this.supabase
            .from('user_videos')
            .update({ page_number: video.page_number + 1 })
            .eq('id', video.id);

          if (updateError) throw updateError;
        }

        return existingVideos?.length || 0;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to move videos to next page: ${error.message}`);
    }
  }

  async deleteUserVideos(userRoadmapId, level) {
    this._checkConnection();
    try {
      // Try PostgreSQL first
      if (this.pool) {
        const query = `
          DELETE FROM user_videos 
          WHERE user_roadmap_id = $1 AND level = $2
          RETURNING id
        `;
        
        const result = await this.pool.query(query, [userRoadmapId, level]);
        return result.rows.length > 0;
      }
      // Fallback to Supabase client
      else if (this.supabase) {
        console.log('🔄 Falling back to Supabase client for deleting user videos');
        
        const { error } = await this.supabase
          .from('user_videos')
          .delete()
          .eq('user_roadmap_id', userRoadmapId)
          .eq('level', level);

        if (error) throw error;
        return true;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      throw new Error(`Failed to delete user videos: ${error.message}`);
    }
  }
}

export default new SupabaseService();

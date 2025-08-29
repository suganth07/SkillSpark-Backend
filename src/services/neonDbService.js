import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

class DatabaseService {
  constructor() {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is required for Neon database connection');
      this.sql = null;
      return;
    }

    try {
      console.log('🔗 Connecting to Neon database...');
      console.log('🔗 Database URL (masked):', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
      
      // Initialize Neon serverless database connection
      this.sql = neon(process.env.DATABASE_URL);
      
      console.log('✅ Neon database connection initialized successfully');
      
      // Test the connection asynchronously
      this.testConnection().catch(error => {
        console.warn('⚠️ Neon database connection test failed:', error.message);
      });
      
    } catch (error) {
      console.error('Failed to initialize database connection:', error.message);
      this.sql = null;
    }
  }

  async testConnection() {
    if (!this.sql) return;
    
    try {
      const result = await this.sql`SELECT NOW()`;
      console.log('✅ Database connection test successful:', result[0]);
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      throw error;
    }
  }

  // Gracefully close the connection (Neon serverless doesn't need explicit closing)
  async closeConnection() {
    if (this.sql) {
      console.log('🔌 Neon database connection closed');
      this.sql = null;
    }
  }

  _checkConnection() {
    if (!this.sql) {
      throw new Error('No database connection available. Please check your configuration.');
    }
  }

  // User management
  async createUser(username, password) {
    this._checkConnection();
    try {
      const result = await this.sql`
        INSERT INTO users (username, password)
        VALUES (${username}, ${password})
        RETURNING id, username, created_at
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getUserByCredentials(username, password) {
    this._checkConnection();
    try {
      console.log('🔍 Attempting to get user by credentials via Neon:', username);
      
      const result = await this.sql`
        SELECT id, username 
        FROM users 
        WHERE username = ${username} AND password = ${password}
      `;
      
      console.log('📊 Query result:', {
        rowCount: result.length,
        hasRows: result.length > 0,
        firstRow: result.length > 0 ? { id: result[0].id, username: result[0].username } : null
      });
      
      return result.length > 0 ? result[0] : null;
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
      const result = await this.sql`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE username = ${username}
      `;
      
      return parseInt(result[0].count) > 0;
    } catch (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  async ensureUserExists(userId, username = null) {
    this._checkConnection();
    try {
      // First check if user exists by ID
      const existingUser = await this.sql`
        SELECT id, username 
        FROM users 
        WHERE id = ${userId}
      `;
      
      if (existingUser.length > 0) {
        return existingUser[0];
      }
      
      // User doesn't exist, create them
      console.log(`👤 Creating user record for UUID: ${userId}`);
      const result = await this.sql`
        INSERT INTO users (id, username, password)
        VALUES (${userId}, ${username || 'user_' + userId.slice(0, 8)}, 'oauth')
        RETURNING id, username, created_at
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to ensure user exists: ${error.message}`);
    }
  }

  // User Topics
  async createUserTopic(userId, topic) {
    this._checkConnection();
    try {
      const result = await this.sql`
        INSERT INTO user_topics (user_id, topic)
        VALUES (${userId}, ${topic})
        RETURNING id, user_id, topic, created_at
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to create user topic: ${error.message}`);
    }
  }

  async getUserTopics(userId) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT * 
        FROM user_topics 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC
      `;
      
      return result || [];
    } catch (error) {
      throw new Error(`Failed to get user topics: ${error.message}`);
    }
  }

  async getUserTopicByName(userId, topicName) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT * 
        FROM user_topics 
        WHERE user_id = ${userId} AND topic = ${topicName}
      `;
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new Error(`Failed to get user topic by name: ${error.message}`);
    }
  }

  // User Roadmaps
  processRoadmapWithStepIds(roadmapData) {
    // Convert simple array format to object format with sequential step IDs
    const processedRoadmap = { ...roadmapData };
    
    if (processedRoadmap.roadmap) {
      const levels = ['beginner', 'intermediate', 'advanced'];
      
      levels.forEach(level => {
        if (processedRoadmap.roadmap[level] && Array.isArray(processedRoadmap.roadmap[level])) {
          // Convert array to object with step IDs
          const points = processedRoadmap.roadmap[level];
          const processedPoints = {};
          
          points.forEach((point, index) => {
            const stepId = `step_${index + 1}`;
            processedPoints[stepId] = {
              pointId: stepId,
              pointTitle: typeof point === 'string' ? point : point.pointTitle || point.title || point,
              title: typeof point === 'string' ? point : point.pointTitle || point.title || point
            };
          });
          
          processedRoadmap.roadmap[level] = processedPoints;
        }
      });
    }
    
    return processedRoadmap;
  }

  // Method to migrate existing roadmaps to use sequential step IDs
  async migrateRoadmapToStepIds(userRoadmapId) {
    this._checkConnection();
    try {
      // Get the current roadmap data
      const result = await this.sql`
        SELECT roadmap_data FROM user_roadmaps WHERE id = ${userRoadmapId}
      `;
      
      if (result.length === 0) {
        throw new Error('Roadmap not found');
      }
      
      const currentRoadmapData = typeof result[0].roadmap_data === 'string' 
        ? JSON.parse(result[0].roadmap_data) 
        : result[0].roadmap_data;
      
      // Check if already migrated (has step_X structure)
      const levels = ['beginner', 'intermediate', 'advanced'];
      let needsMigration = false;
      
      for (const level of levels) {
        if (currentRoadmapData.roadmap && currentRoadmapData.roadmap[level]) {
          if (Array.isArray(currentRoadmapData.roadmap[level])) {
            needsMigration = true;
            break;
          }
        }
      }
      
      if (!needsMigration) {
        console.log(`✅ Roadmap ${userRoadmapId} already uses step IDs`);
        return result[0];
      }
      
      // Process with new step ID structure
      const processedRoadmapData = this.processRoadmapWithStepIds(currentRoadmapData);
      
      // Update in database
      const updateResult = await this.sql`
        UPDATE user_roadmaps 
        SET roadmap_data = ${JSON.stringify(processedRoadmapData)}, updated_at = NOW()
        WHERE id = ${userRoadmapId}
        RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
      `;
      
      console.log(`✅ Migrated roadmap ${userRoadmapId} to use sequential step IDs`);
      return updateResult[0];
      
    } catch (error) {
      throw new Error(`Failed to migrate roadmap: ${error.message}`);
    }
  }

  // Method to migrate ALL roadmaps in the database to use sequential step IDs
  async migrateAllRoadmapsToStepIds() {
    this._checkConnection();
    try {
      console.log('🔄 Starting migration of all roadmaps to use sequential step IDs...');
      
      // Get all roadmaps
      const roadmaps = await this.sql`SELECT id, roadmap_data FROM user_roadmaps`;
      
      let migratedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const roadmap of roadmaps) {
        try {
          const currentRoadmapData = typeof roadmap.roadmap_data === 'string' 
            ? JSON.parse(roadmap.roadmap_data) 
            : roadmap.roadmap_data;
          
          // Check if already migrated (has step_X structure)
          const levels = ['beginner', 'intermediate', 'advanced'];
          let needsMigration = false;
          
          for (const level of levels) {
            if (currentRoadmapData.roadmap && currentRoadmapData.roadmap[level]) {
              if (Array.isArray(currentRoadmapData.roadmap[level])) {
                needsMigration = true;
                break;
              }
            }
          }
          
          if (!needsMigration) {
            skippedCount++;
            continue;
          }
          
          // Process with new step ID structure
          const processedRoadmapData = this.processRoadmapWithStepIds(currentRoadmapData);
          
          // Update in database
          await this.sql`
            UPDATE user_roadmaps 
            SET roadmap_data = ${JSON.stringify(processedRoadmapData)}, updated_at = NOW()
            WHERE id = ${roadmap.id}
          `;
          
          migratedCount++;
          console.log(`✅ Migrated roadmap ${roadmap.id}`);
          
        } catch (error) {
          console.error(`❌ Failed to migrate roadmap ${roadmap.id}:`, error.message);
          errorCount++;
        }
      }
      
      console.log(`🎉 Migration completed! Migrated: ${migratedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
      
      return {
        total: roadmaps.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount
      };
      
    } catch (error) {
      throw new Error(`Failed to migrate all roadmaps: ${error.message}`);
    }
  }

  async createUserRoadmap(userTopicId, roadmapData) {
    this._checkConnection();
    try {
      // Process roadmap to include sequential step IDs
      const processedRoadmapData = this.processRoadmapWithStepIds(roadmapData);
      
      const result = await this.sql`
        INSERT INTO user_roadmaps (user_topic_id, roadmap_data)
        VALUES (${userTopicId}, ${JSON.stringify(processedRoadmapData)})
        RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to create user roadmap: ${error.message}`);
    }
  }

  async getUserRoadmaps(userId) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT 
          ur.id,
          ur.roadmap_data,
          ur.created_at,
          ur.updated_at,
          ut.user_id,
          ut.topic
        FROM user_roadmaps ur
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = ${userId}
        ORDER BY ur.created_at DESC
      `;
      
      // Get progress data for all roadmaps
      const progressResult = await this.sql`
        SELECT rp.roadmap_id, rp.point_id, rp.is_completed, rp.completed_at
        FROM roadmap_progress rp
        INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = ${userId}
      `;
      
      const progressMap = new Map();
      
      // Group progress by roadmap_id
      progressResult.forEach(row => {
        if (!progressMap.has(row.roadmap_id)) {
          progressMap.set(row.roadmap_id, {});
        }
        progressMap.get(row.roadmap_id)[row.point_id] = {
          isCompleted: row.is_completed,
          completedAt: row.completed_at
        };
      });
      
      // Transform the data to match frontend expectations and merge progress
      const transformedData = result.map(item => {
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
      // Process roadmap to include sequential step IDs
      const processedRoadmapData = this.processRoadmapWithStepIds(roadmapData);
      
      const result = await this.sql`
        UPDATE user_roadmaps 
        SET roadmap_data = ${JSON.stringify(processedRoadmapData)}, updated_at = NOW()
        WHERE id = ${roadmapId}
        RETURNING id, user_topic_id, roadmap_data, created_at, updated_at
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to update user roadmap: ${error.message}`);
    }
  }

  // User Videos
  async createUserVideos(userRoadmapId, level, videoData) {
    this._checkConnection();
    try {
      const result = await this.sql`
        INSERT INTO user_videos (user_roadmap_id, level, video_data)
        VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoData)})
        RETURNING id, user_roadmap_id, level, video_data, created_at
      `;
      
      return result[0];
    } catch (error) {
      throw new Error(`Failed to create user videos: ${error.message}`);
    }
  }

  // Roadmap Progress Management
  async markRoadmapPointComplete(userId, roadmapId, pointId, isCompleted) {
    this._checkConnection();
    try {
      // Check if progress record exists
      const checkResult = await this.sql`
        SELECT * FROM roadmap_progress 
        WHERE user_id = ${userId} AND roadmap_id = ${roadmapId} AND point_id = ${pointId}
      `;

      if (checkResult.length > 0) {
        // Update existing record
        const completedAt = isCompleted ? new Date().toISOString() : null;
        const result = await this.sql`
          UPDATE roadmap_progress 
          SET is_completed = ${isCompleted}, completed_at = ${completedAt}, updated_at = NOW()
          WHERE user_id = ${userId} AND roadmap_id = ${roadmapId} AND point_id = ${pointId}
          RETURNING *
        `;
        return result[0];
      } else {
        // Create new record
        const completedAt = isCompleted ? new Date().toISOString() : null;
        const result = await this.sql`
          INSERT INTO roadmap_progress (user_id, roadmap_id, point_id, is_completed, completed_at)
          VALUES (${userId}, ${roadmapId}, ${pointId}, ${isCompleted}, ${completedAt})
          RETURNING *
        `;
        return result[0];
      }
    } catch (error) {
      throw new Error(`Failed to mark roadmap point complete: ${error.message}`);
    }
  }

  async getRoadmapProgress(userId, roadmapId) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT * FROM roadmap_progress 
        WHERE user_id = ${userId} AND roadmap_id = ${roadmapId}
        ORDER BY created_at ASC
      `;
      
      return result || [];
    } catch (error) {
      throw new Error(`Failed to get roadmap progress: ${error.message}`);
    }
  }

  async getAllUserRoadmapProgress(userId) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT rp.*, ur.roadmap_data 
        FROM roadmap_progress rp
        INNER JOIN user_roadmaps ur ON rp.roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = ${userId}
        ORDER BY rp.created_at ASC
      `;
      
      return result || [];
    } catch (error) {
      throw new Error(`Failed to get all user roadmap progress: ${error.message}`);
    }
  }

  async storeUserVideos(userRoadmapId, level, videoData, pageNumber = 1, pointId = null, isRegenerate = false, stepIndex = null) {
    this._checkConnection();
    
    // Generate sequential step ID if not provided
    if (!pointId && stepIndex !== null) {
      pointId = `step_${stepIndex + 1}`; // step_1, step_2, step_3, etc.
    }
    
    console.log("🔍 DEBUG - storeUserVideos called with:", {
      userRoadmapId,
      level,
      pageNumber,
      pointId,
      stepIndex,
      pointIdType: typeof pointId,
      isRegenerate,
      videoDataLength: Array.isArray(videoData) ? videoData.length : 'not array'
    });
    
    try {
      console.log(`🔄 Storing videos for roadmap: ${userRoadmapId}, level: ${level}, page: ${pageNumber}, pointId: ${pointId}`);
      
      // Add pointId to each video entry for tracking
      const videoDataWithPointId = videoData.map(video => ({
        ...video,
        pointId: pointId || `${level}_${pageNumber}`,
        generatedAt: new Date().toISOString()
      }));
      
      // If this is a regenerate operation with pointId, handle existing videos
      if (isRegenerate && pointId) {
        console.log(`🔄 Handling regeneration for point ${pointId}`);
        
        try {
          // Use a transaction-like approach: first move existing, then insert new
          
          // Step 1: Move all existing videos for this point to next page numbers
          const moveResult = await this.sql`
            UPDATE user_videos 
            SET page_number = page_number + 1 
            WHERE user_roadmap_id = ${userRoadmapId} 
              AND level = ${level} 
              AND point_id = ${pointId}
          `;
          console.log(`� Moved ${moveResult.count || 0} existing videos to next pages`);
          
          // Step 2: Insert new videos at page 1
          const result = await this.sql`
            INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, point_id, created_at, updated_at)
            VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoDataWithPointId)}, ${pageNumber}, 1, ${pointId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
          `;
          console.log(`✅ Inserted new regenerated videos for point ${pointId} at page ${pageNumber}`);
          return result[0];
          
        } catch (moveError) {
          console.error(`❌ Error during regeneration for point ${pointId}:`, moveError);
          
          // If we still get a constraint error, it means there's already a record with generation_number = 1
          // Let's find the next available generation number
          const maxGenResult = await this.sql`
            SELECT COALESCE(MAX(generation_number), 0) as max_gen
            FROM user_videos 
            WHERE user_roadmap_id = ${userRoadmapId} 
              AND level = ${level} 
              AND page_number = ${pageNumber}
              AND point_id = ${pointId}
          `;
          
          const nextGeneration = (maxGenResult[0]?.max_gen || 0) + 1;
          console.log(`🔢 Using generation number ${nextGeneration} for point ${pointId} regeneration (timestamp fallback: ${Date.now() % 1000000})`);
          
          const result = await this.sql`
            INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, point_id, created_at, updated_at)
            VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoDataWithPointId)}, ${pageNumber}, ${nextGeneration}, ${pointId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
          `;
          console.log(`✅ Inserted regenerated videos with generation ${nextGeneration}`);
          return result[0];
        }
      }
      
      // Check if videos already exist for this point and page
      const existingVideos = await this.sql`
        SELECT * FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} 
          AND level = ${level} 
          AND page_number = ${pageNumber}
          AND point_id = ${pointId}
      `;
      
      if (existingVideos.length > 0) {
        // For existing entries, we need to insert a new row with incremented generation_number
        // since generation_number is part of the primary key
        const maxGeneration = Math.max(...existingVideos.map(v => v.generation_number));
        const newGeneration = maxGeneration + 1;
        
        const result = await this.sql`
          INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, point_id, created_at, updated_at)
          VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoDataWithPointId)}, ${pageNumber}, ${newGeneration}, ${pointId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        console.log(`✅ Inserted updated videos for point ${pointId || 'unknown'} with generation ${newGeneration}`);
        return result[0];
      } else {
        // Insert new entry
        const result = await this.sql`
          INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, point_id, created_at, updated_at)
          VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoDataWithPointId)}, ${pageNumber}, 1, ${pointId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        console.log(`✅ Inserted new videos for point ${pointId || 'unknown'}`);
        return result[0];
      }
    } catch (error) {
      console.error(`❌ Failed to store videos:`, error);
      throw new Error(`Failed to store user videos: ${error.message}`);
    }
  }

  async getUserVideos(userRoadmapId, level = null, page = 1, pointId = null) {
    this._checkConnection();
    try {
      console.log(`🔍 Fetching videos for roadmap: ${userRoadmapId}, level: ${level}, page: ${page}, pointId: ${pointId}`);
      
      let result;
      
      if (pointId) {
        // Point-specific query using dedicated point_id column
        result = await this.sql`
          SELECT * 
          FROM user_videos 
          WHERE user_roadmap_id = ${userRoadmapId}
            AND level = ${level}
            AND page_number = ${page}
            AND point_id = ${pointId}
          ORDER BY generation_number DESC, created_at DESC
          LIMIT 1
        `;
        
        // If no point-specific videos found, don't fallback to level videos
        // This ensures each point gets unique videos
        if (result.length === 0) {
          console.log(`📭 No videos found for point ${pointId}, will need to generate new ones`);
          return [];
        }
        
      } else if (level !== null && page !== null) {
        // Legacy level-based query for backward compatibility
        result = await this.sql`
          SELECT * 
          FROM user_videos 
          WHERE user_roadmap_id = ${userRoadmapId}
            AND level = ${level}
            AND page_number = ${page}
          ORDER BY generation_number DESC, created_at DESC
        `;
      } else if (level !== null) {
        result = await this.sql`
          SELECT * 
          FROM user_videos 
          WHERE user_roadmap_id = ${userRoadmapId}
            AND level = ${level}
          ORDER BY generation_number DESC, created_at DESC
        `;
      } else if (page !== null) {
        result = await this.sql`
          SELECT * 
          FROM user_videos 
          WHERE user_roadmap_id = ${userRoadmapId}
            AND page_number = ${page}
          ORDER BY generation_number DESC, created_at DESC
        `;
      } else {
        result = await this.sql`
          SELECT * 
          FROM user_videos 
          WHERE user_roadmap_id = ${userRoadmapId}
          ORDER BY generation_number DESC, created_at DESC
        `;
      }
      
      console.log(`📊 Found ${result.length} video records`);
      
      // Parse video_data if it's a string
      const transformedData = result.map(item => ({
        ...item,
        video_data: typeof item.video_data === 'string' ? JSON.parse(item.video_data) : item.video_data
      }));
      
      return transformedData;
    } catch (error) {
      throw new Error(`Failed to get user videos: ${error.message}`);
    }
  }

  // New method to get videos for all points in a level
  async getAllPointVideosForLevel(userRoadmapId, level, page = 1) {
    this._checkConnection();
    try {
      console.log(`🔍 Fetching all point videos for roadmap: ${userRoadmapId}, level: ${level}, page: ${page}`);
      
      const result = await this.sql`
        SELECT DISTINCT point_id, video_data, generation_number, created_at, updated_at
        FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId}
          AND level = ${level}
          AND page_number = ${page}
          AND point_id IS NOT NULL
        ORDER BY point_id, generation_number DESC, created_at DESC
      `;
      
      // Group by point_id and get the latest generation for each point
      const pointVideos = {};
      
      for (const item of result) {
        if (!pointVideos[item.point_id] || pointVideos[item.point_id].generation_number < item.generation_number) {
          pointVideos[item.point_id] = {
            pointId: item.point_id,
            video_data: typeof item.video_data === 'string' ? JSON.parse(item.video_data) : item.video_data,
            generation_number: item.generation_number,
            created_at: item.created_at,
            updated_at: item.updated_at
          };
        }
      }
      
      console.log(`📊 Found videos for ${Object.keys(pointVideos).length} points in ${level} level`);
      return pointVideos;
    } catch (error) {
      console.error('❌ Error fetching all point videos:', error);
      throw new Error(`Failed to fetch all point videos: ${error.message}`);
    }
  }

  async getNextGenerationNumber(userRoadmapId, level, pageNumber) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT COALESCE(MAX(generation_number), 0) + 1 as next_generation
        FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} AND level = ${level} AND page_number = ${pageNumber}
      `;
      
      return result[0].next_generation;
    } catch (error) {
      throw new Error(`Failed to get next generation number: ${error.message}`);
    }
  }

  // Get the next available step number for a level
  async getNextStepNumber(userRoadmapId, level) {
    this._checkConnection();
    try {
      // First check the roadmap data to see how many steps are defined for this level
      const roadmapResult = await this.sql`
        SELECT roadmap_data
        FROM user_roadmaps 
        WHERE id = ${userRoadmapId}
      `;
      
      let maxStepsInRoadmap = 0;
      if (roadmapResult.length > 0) {
        const roadmapData = typeof roadmapResult[0].roadmap_data === 'string' 
          ? JSON.parse(roadmapResult[0].roadmap_data) 
          : roadmapResult[0].roadmap_data;
          
        if (roadmapData.roadmap && roadmapData.roadmap[level]) {
          // If it's an object with step keys, count them
          if (typeof roadmapData.roadmap[level] === 'object' && !Array.isArray(roadmapData.roadmap[level])) {
            maxStepsInRoadmap = Object.keys(roadmapData.roadmap[level]).length;
          } else if (Array.isArray(roadmapData.roadmap[level])) {
            // If it's still an array, count the items
            maxStepsInRoadmap = roadmapData.roadmap[level].length;
          }
        }
      }
      
      // Then check existing videos to see what's already been generated
      const result = await this.sql`
        SELECT point_id
        FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} 
          AND level = ${level}
          AND point_id LIKE 'step_%'
        ORDER BY 
          CAST(SUBSTRING(point_id FROM 6) AS INTEGER) DESC
        LIMIT 1
      `;
      
      if (result.length === 0) {
        return 1; // First step
      }
      
      // Extract number from step_X and increment
      const lastStepId = result[0].point_id; // e.g., "step_3"
      const lastStepNumber = parseInt(lastStepId.split('_')[1]);
      const nextStepNumber = lastStepNumber + 1;
      
      // Don't exceed the number of steps defined in the roadmap
      return Math.min(nextStepNumber, maxStepsInRoadmap + 1);
      
    } catch (error) {
      console.error('Error getting next step number:', error);
      return 1; // Fallback to first step
    }
  }

  async moveVideosToNextPage(userRoadmapId, level) {
    this._checkConnection();
    try {
      console.log(`🔄 Moving videos to next page for roadmap: ${userRoadmapId}, level: ${level}`);
      
      // First, get all existing videos for this roadmap and level
      const existingVideos = await this.sql`
        SELECT user_roadmap_id, level, page_number, generation_number FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} AND level = ${level}
        ORDER BY page_number DESC, generation_number DESC
      `;
      
      if (existingVideos.length === 0) {
        console.log('📋 No existing videos to move');
        return 0;
      }
      
      // Update page numbers in reverse order to avoid conflicts
      // Start with the highest page number and work backwards
      const sortedVideos = existingVideos.sort((a, b) => b.page_number - a.page_number);
      let updatedCount = 0;
      
      for (const video of sortedVideos) {
        const newPageNumber = video.page_number + 1;
        await this.sql`
          UPDATE user_videos 
          SET page_number = ${newPageNumber}
          WHERE user_roadmap_id = ${video.user_roadmap_id} 
            AND level = ${video.level}
            AND page_number = ${video.page_number}
            AND generation_number = ${video.generation_number}
        `;
        updatedCount++;
      }
      
      console.log(`✅ Successfully moved ${updatedCount} videos to next page`);
      return updatedCount;
    } catch (error) {
      console.error('❌ Failed to move videos to next page:', error);
      throw new Error(`Failed to move videos to next page: ${error.message}`);
    }
  }

  async deleteUserVideos(userRoadmapId, level) {
    this._checkConnection();
    try {
      const result = await this.sql`
        DELETE FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} AND level = ${level}
        RETURNING id
      `;
      
      return result.length > 0;
    } catch (error) {
      throw new Error(`Failed to delete user videos: ${error.message}`);
    }
  }

  async deleteUserRoadmap(roadmapId, userId) {
    this._checkConnection();
    try {
      console.log(`🗑️ Deleting roadmap ${roadmapId} for user ${userId} using Neon database`);
      
      // First, get the user_topic_id for the roadmap to verify ownership
      const ownershipResult = await this.sql`
        SELECT ur.user_topic_id 
        FROM user_roadmaps ur
        JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ur.id = ${roadmapId} AND ut.user_id = ${userId}
      `;
      
      if (ownershipResult.length === 0) {
        throw new Error('Roadmap not found or not owned by user');
      }
      
      const userTopicId = ownershipResult[0].user_topic_id;
      
      // Delete in correct order: child tables first, then parent tables
      
      // 1. Delete roadmap progress
      try {
        await this.sql`DELETE FROM roadmap_progress WHERE roadmap_id = ${roadmapId}`;
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
        await this.sql`DELETE FROM user_videos WHERE user_roadmap_id = ${roadmapId}`;
        console.log('✅ Deleted user videos');
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log('⚠️ user_videos table does not exist, skipping...');
        } else {
          throw error;
        }
      }

      // 3. Delete user roadmap
      await this.sql`DELETE FROM user_roadmaps WHERE id = ${roadmapId}`;
      console.log('✅ Deleted user roadmap');

      // 4. Delete user topic (if no other roadmaps reference it)
      const otherRoadmapsResult = await this.sql`SELECT COUNT(*) as count FROM user_roadmaps WHERE user_topic_id = ${userTopicId}`;
      
      if (otherRoadmapsResult[0].count == 0) {
        await this.sql`DELETE FROM user_topics WHERE id = ${userTopicId}`;
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
  async getUserSettings(userId) {
    this._checkConnection();
    try {
      console.log('🔍 Fetching user settings for user:', userId);
      
      const result = await this.sql`
        SELECT * FROM user_settings 
        WHERE user_id = ${userId}
      `;
      
      console.log('📊 User settings query result:', {
        rowCount: result.length,
        hasRows: result.length > 0
      });
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('❌ Failed to get user settings:', error.message);
      throw new Error(`Failed to get user settings: ${error.message}`);
    }
  }

  async createUserSettings(userId, settings) {
    this._checkConnection();
    try {
      console.log('🔧 Creating user settings for user:', userId);
      
      const {
        full_name,
        about_description,
        theme = 'light',
        default_roadmap_depth = 'detailed',
        default_video_length = 'medium'
      } = settings;

      const result = await this.sql`
        INSERT INTO user_settings (
          user_id, full_name, about_description, theme, 
          default_roadmap_depth, default_video_length
        )
        VALUES (${userId}, ${full_name}, ${about_description}, ${theme}, ${default_roadmap_depth}, ${default_video_length})
        RETURNING *
      `;
      
      console.log('✅ Created user settings successfully');
      return result[0];
    } catch (error) {
      console.error('❌ Failed to create user settings:', error.message);
      throw new Error(`Failed to create user settings: ${error.message}`);
    }
  }

  async updateUserSettings(userId, updates) {
    this._checkConnection();
    try {
      console.log('🔧 Updating user settings for user:', userId);
      
      // Extract fields to update
      const updateFields = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && key !== 'user_id' && key !== 'id') {
          updateFields[key] = value;
        }
      }

      if (Object.keys(updateFields).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Handle different field updates with tagged templates
      let result;
      
      if (updateFields.full_name !== undefined) {
        result = await this.sql`
          UPDATE user_settings 
          SET full_name = ${updateFields.full_name}, updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
      } else if (updateFields.about_description !== undefined) {
        result = await this.sql`
          UPDATE user_settings 
          SET about_description = ${updateFields.about_description}, updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
      } else if (updateFields.theme !== undefined) {
        result = await this.sql`
          UPDATE user_settings 
          SET theme = ${updateFields.theme}, updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
      } else if (updateFields.default_roadmap_depth !== undefined) {
        result = await this.sql`
          UPDATE user_settings 
          SET default_roadmap_depth = ${updateFields.default_roadmap_depth}, updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
      } else if (updateFields.default_video_length !== undefined) {
        result = await this.sql`
          UPDATE user_settings 
          SET default_video_length = ${updateFields.default_video_length}, updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
      } else {
        throw new Error(`Unsupported field update: ${Object.keys(updateFields).join(', ')}`);
      }
      
      if (result.length === 0) {
        throw new Error('No user settings found to update');
      }
      
      console.log('✅ Updated user settings successfully');
      return result[0];
    } catch (error) {
      console.error('❌ Failed to update user settings:', error.message);
      throw new Error(`Failed to update user settings: ${error.message}`);
    }
  }

  async deleteUserSettings(userId) {
    this._checkConnection();
    try {
      console.log('🗑️ Deleting user settings for user:', userId);
      
      const result = await this.sql`DELETE FROM user_settings WHERE user_id = ${userId} RETURNING *`;
      
      console.log('✅ Deleted user settings successfully');
      return result.length > 0;
    } catch (error) {
      console.error('❌ Failed to delete user settings:', error.message);
      throw new Error(`Failed to delete user settings: ${error.message}`);
    }
  }

  async upsertUserSettings(userId, settings) {
    this._checkConnection();
    try {
      console.log('🔧 Upserting user settings for user:', userId);
      
      const {
        full_name,
        about_description,
        theme = 'light',
        default_roadmap_depth = 'detailed',
        default_video_length = 'medium'
      } = settings;

      const result = await this.sql`
        INSERT INTO user_settings (
          user_id, full_name, about_description, theme, 
          default_roadmap_depth, default_video_length
        )
        VALUES (${userId}, ${full_name}, ${about_description}, ${theme}, ${default_roadmap_depth}, ${default_video_length})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          about_description = EXCLUDED.about_description,
          theme = EXCLUDED.theme,
          default_roadmap_depth = EXCLUDED.default_roadmap_depth,
          default_video_length = EXCLUDED.default_video_length,
          updated_at = NOW()
        RETURNING *
      `;
      
      console.log('✅ Upserted user settings successfully');
      return result[0];
    } catch (error) {
      console.error('❌ Failed to upsert user settings:', error.message);
      throw new Error(`Failed to upsert user settings: ${error.message}`);
    }
  }
}

export default new DatabaseService();

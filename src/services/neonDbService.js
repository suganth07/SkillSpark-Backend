import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import crypto from 'crypto';

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

  // Method to get all steps from a roadmap level for video generation
  async getRoadmapSteps(userRoadmapId, level) {
    this._checkConnection();
    try {
      const result = await this.sql`
        SELECT roadmap_data FROM user_roadmaps WHERE id = ${userRoadmapId}
      `;
      
      if (result.length === 0) {
        throw new Error('Roadmap not found');
      }
      
      const roadmapData = typeof result[0].roadmap_data === 'string' 
        ? JSON.parse(result[0].roadmap_data) 
        : result[0].roadmap_data;
      
      const steps = [];
      
      // Check if roadmap has the new step-based structure
      if (roadmapData.roadmap && roadmapData.roadmap[level]) {
        const levelData = roadmapData.roadmap[level];
        
        if (typeof levelData === 'object' && !Array.isArray(levelData)) {
          // New format: object with step keys
          Object.entries(levelData).forEach(([stepId, stepData]) => {
            steps.push({
              pointId: stepId,
              pointTitle: stepData.pointTitle || stepData.title,
              title: stepData.pointTitle || stepData.title,
              level: level,
              description: stepData.description || `Learn about ${stepData.pointTitle || stepData.title}`
            });
          });
        }
      }
      
      // Fallback: check old points structure
      if (steps.length === 0 && roadmapData.points) {
        const levelPoints = roadmapData.points
          .filter(point => point.level === level)
          .sort((a, b) => a.order - b.order);
        
        levelPoints.forEach(point => {
          steps.push({
            pointId: point.id, // This should now be step_X format
            pointTitle: point.title,
            title: point.title,
            level: point.level,
            description: point.description
          });
        });
      }
      
      return steps;
      
    } catch (error) {
      throw new Error(`Failed to get roadmap steps: ${error.message}`);
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

  // Quiz Management Operations
  async createUserQuiz(userRoadmapId, quizData, totalQuestions = 15, difficultyLevel = 'mixed') {
    this._checkConnection();
    try {
      console.log(`🧠 Creating quiz for roadmap: ${userRoadmapId}`);
      
      const result = await this.sql`
        INSERT INTO user_quizzes (user_roadmap_id, quiz_data, total_questions, difficulty_level)
        VALUES (${userRoadmapId}, ${JSON.stringify(quizData)}, ${totalQuestions}, ${difficultyLevel})
        RETURNING id, user_roadmap_id, quiz_data, total_questions, difficulty_level, created_at, updated_at
      `;
      
      console.log('✅ Created quiz successfully');
      return result[0];
    } catch (error) {
      console.error('❌ Failed to create quiz:', error);
      throw new Error(`Failed to create quiz: ${error.message}`);
    }
  }

  async getUserQuiz(userRoadmapId) {
    this._checkConnection();
    try {
      console.log(`🔍 Getting quiz for roadmap: ${userRoadmapId}`);
      
      const result = await this.sql`
        SELECT uq.*, ur.roadmap_data, ut.topic
        FROM user_quizzes uq
        INNER JOIN user_roadmaps ur ON uq.user_roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE uq.user_roadmap_id = ${userRoadmapId}
        ORDER BY uq.created_at DESC
        LIMIT 1
      `;
      
      if (result.length > 0) {
        // Parse quiz_data if it's a string
        const quiz = result[0];
        if (typeof quiz.quiz_data === 'string') {
          quiz.quiz_data = JSON.parse(quiz.quiz_data);
        }
        console.log('✅ Found existing quiz');
        return quiz;
      }
      
      console.log('📭 No quiz found for roadmap');
      return null;
    } catch (error) {
      console.error('❌ Failed to get quiz:', error);
      throw new Error(`Failed to get quiz: ${error.message}`);
    }
  }

  async submitQuizAttempt(userQuizId, userId, userAnswers, score, totalQuestions, percentage, timeInSeconds = null) {
    this._checkConnection();
    try {
      console.log(`📝 Submitting quiz attempt for user: ${userId}, quiz: ${userQuizId}`);
      
      const result = await this.sql`
        INSERT INTO quiz_attempts (user_quiz_id, user_id, user_answers, score, total_questions, percentage, time_taken)
        VALUES (${userQuizId}, ${userId}, ${JSON.stringify(userAnswers)}, ${score}, ${totalQuestions}, ${percentage}, ${timeInSeconds})
        RETURNING id, user_quiz_id, user_id, score, total_questions, percentage, time_taken, completed_at, created_at
      `;
      
      console.log(`✅ Quiz attempt submitted: ${score}/${totalQuestions} (${percentage}%)`);
      return result[0];
    } catch (error) {
      console.error('❌ Failed to submit quiz attempt:', error);
      throw new Error(`Failed to submit quiz attempt: ${error.message}`);
    }
  }

  async getUserQuizAttempts(userId) {
    this._checkConnection();
    try {
      console.log(`📊 Getting all quiz attempts for user: ${userId}`);
      
      const result = await this.sql`
        SELECT qa.*, uq.quiz_data, ur.roadmap_data, ut.topic
        FROM quiz_attempts qa
        INNER JOIN user_quizzes uq ON qa.user_quiz_id = uq.id  
        INNER JOIN user_roadmaps ur ON uq.user_roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE qa.user_id = ${userId}
        ORDER BY qa.completed_at DESC
      `;
      
      // Parse JSON data
      const parsedResults = result.map(item => ({
        ...item,
        user_answers: typeof item.user_answers === 'string' ? JSON.parse(item.user_answers) : item.user_answers,
        quiz_data: typeof item.quiz_data === 'string' ? JSON.parse(item.quiz_data) : item.quiz_data,
        roadmap_data: typeof item.roadmap_data === 'string' ? JSON.parse(item.roadmap_data) : item.roadmap_data
      }));
      
      console.log(`✅ Found ${parsedResults.length} quiz attempts`);
      return parsedResults;
    } catch (error) {
      console.error('❌ Failed to get user quiz attempts:', error);
      throw new Error(`Failed to get user quiz attempts: ${error.message}`);
    }
  }

  async getQuizAttemptsForRoadmap(userId, userRoadmapId) {
    this._checkConnection();
    try {
      console.log(`📊 Getting quiz attempts for user: ${userId}, roadmap: ${userRoadmapId}`);
      
      const result = await this.sql`
        SELECT qa.*, uq.quiz_data
        FROM quiz_attempts qa
        INNER JOIN user_quizzes uq ON qa.user_quiz_id = uq.id
        WHERE qa.user_id = ${userId} AND uq.user_roadmap_id = ${userRoadmapId}
        ORDER BY qa.completed_at DESC
      `;
      
      // Parse JSON data
      const parsedResults = result.map(item => ({
        ...item,
        user_answers: typeof item.user_answers === 'string' ? JSON.parse(item.user_answers) : item.user_answers,
        quiz_data: typeof item.quiz_data === 'string' ? JSON.parse(item.quiz_data) : item.quiz_data
      }));
      
      console.log(`✅ Found ${parsedResults.length} attempts for roadmap`);
      return parsedResults;
    } catch (error) {
      console.error('❌ Failed to get roadmap quiz attempts:', error);
      throw new Error(`Failed to get roadmap quiz attempts: ${error.message}`);
    }
  }

  async getQuizStatistics(userRoadmapId) {
    this._checkConnection();
    try {
      console.log(`📈 Getting quiz statistics for roadmap: ${userRoadmapId}`);
      
      const result = await this.sql`
        SELECT 
          COUNT(*) as total_attempts,
          AVG(percentage) as avg_percentage,
          MAX(percentage) as best_percentage,
          MIN(percentage) as worst_percentage,
          AVG(time_taken) as avg_time_taken
        FROM quiz_attempts qa
        INNER JOIN user_quizzes uq ON qa.user_quiz_id = uq.id
        WHERE uq.user_roadmap_id = ${userRoadmapId}
      `;
      
      const stats = result[0];
      if (stats && stats.total_attempts > 0) {
        // Convert numeric strings to numbers
        const processedStats = {
          totalAttempts: parseInt(stats.total_attempts),
          avgPercentage: parseFloat(stats.avg_percentage) || 0,
          bestPercentage: parseFloat(stats.best_percentage) || 0,
          worstPercentage: parseFloat(stats.worst_percentage) || 0,
          avgTimeInSeconds: parseInt(stats.avg_time_taken) || 0
        };
        
        console.log('✅ Quiz statistics calculated:', processedStats);
        return processedStats;
      }
      
      console.log('📭 No quiz attempts found for statistics');
      return {
        totalAttempts: 0,
        avgPercentage: 0,
        bestPercentage: 0,
        worstPercentage: 0,
        avgTimeInSeconds: 0
      };
    } catch (error) {
      console.error('❌ Failed to get quiz statistics:', error);
      throw new Error(`Failed to get quiz statistics: ${error.message}`);
    }
  }

  async updateUserQuiz(userRoadmapId, quizData, totalQuestions = 15, difficultyLevel = 'mixed') {
    this._checkConnection();
    try {
      console.log(`🔄 Updating quiz for roadmap: ${userRoadmapId}`);
      
      const result = await this.sql`
        UPDATE user_quizzes 
        SET quiz_data = ${JSON.stringify(quizData)}, total_questions = ${totalQuestions}, difficulty_level = ${difficultyLevel}, updated_at = NOW()
        WHERE user_roadmap_id = ${userRoadmapId}
        RETURNING id, user_roadmap_id, quiz_data, total_questions, difficulty_level, created_at, updated_at
      `;
      
      if (result.length > 0) {
        console.log('✅ Quiz updated successfully');
        return result[0];
      } else {
        throw new Error('No quiz found to update');
      }
    } catch (error) {
      console.error('❌ Failed to update quiz:', error);
      throw new Error(`Failed to update quiz: ${error.message}`);
    }
  }

  async deleteQuizData(userRoadmapId) {
    this._checkConnection();
    try {
      console.log(`🗑️ Deleting quiz data for roadmap: ${userRoadmapId}`);
      
      // First delete quiz attempts (foreign key constraint)
      await this.sql`
        DELETE FROM quiz_attempts 
        WHERE user_quiz_id IN (
          SELECT id FROM user_quizzes WHERE user_roadmap_id = ${userRoadmapId}
        )
      `;
      console.log('✅ Deleted quiz attempts');
      
      // Then delete the quiz
      const result = await this.sql`
        DELETE FROM user_quizzes WHERE user_roadmap_id = ${userRoadmapId}
        RETURNING id
      `;
      
      console.log(`✅ Deleted quiz data: ${result.length} quiz(s) removed`);
      return result.length > 0;
    } catch (error) {
      console.error('❌ Failed to delete quiz data:', error);
      throw new Error(`Failed to delete quiz data: ${error.message}`);
    }
  }

  // Quiz Progress Methods
  async saveQuizProgress(userQuizId, userId, questionIndex, selectedOption, timeSpent) {
    this._checkConnection();
    try {
      console.log(`💾 Saving quiz progress: Q${questionIndex + 1} = Option ${selectedOption + 1}`);
      
      const result = await this.sql`
        INSERT INTO quiz_progress (user_quiz_id, user_id, question_index, selected_option, time_spent)
        VALUES (${userQuizId}, ${userId}, ${questionIndex}, ${selectedOption}, ${timeSpent})
        ON CONFLICT (user_quiz_id, question_index)
        DO UPDATE SET 
          selected_option = EXCLUDED.selected_option,
          time_spent = EXCLUDED.time_spent,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, user_quiz_id, user_id, question_index, selected_option, time_spent, created_at, updated_at
      `;
      
      console.log('✅ Quiz progress saved successfully');
      return result[0];
    } catch (error) {
      console.error('❌ Failed to save quiz progress:', error);
      throw new Error(`Failed to save quiz progress: ${error.message}`);
    }
  }

  async getQuizProgress(userQuizId, userId) {
    this._checkConnection();
    try {
      console.log(`📋 Getting quiz progress for quiz: ${userQuizId}`);
      
      const result = await this.sql`
        SELECT question_index, selected_option, time_spent, created_at, updated_at
        FROM quiz_progress
        WHERE user_quiz_id = ${userQuizId} AND user_id = ${userId}
        ORDER BY question_index ASC
      `;
      
      console.log(`✅ Retrieved ${result.length} saved answers`);
      return result;
    } catch (error) {
      console.error('❌ Failed to get quiz progress:', error);
      throw new Error(`Failed to get quiz progress: ${error.message}`);
    }
  }

  async clearQuizProgress(userQuizId, userId) {
    this._checkConnection();
    try {
      console.log(`🧹 Clearing quiz progress for quiz: ${userQuizId}`);
      
      const result = await this.sql`
        DELETE FROM quiz_progress 
        WHERE user_quiz_id = ${userQuizId} AND user_id = ${userId}
        RETURNING id
      `;
      
      console.log(`✅ Cleared ${result.length} progress entries`);
      return result.length;
    } catch (error) {
      console.error('❌ Failed to clear quiz progress:', error);
      throw new Error(`Failed to clear quiz progress: ${error.message}`);
    }
  }

  async generateOrGetQuiz(userRoadmapId, roadmapData) {
    this._checkConnection();
    try {
      console.log(`🎯 Generating or getting quiz for roadmap: ${userRoadmapId}`);
      
      // Check if quiz already exists
      const existingQuiz = await this.getUserQuiz(userRoadmapId);
      if (existingQuiz) {
        console.log('📋 Using existing quiz');
        return existingQuiz;
      }
      
      // Generate new quiz using Gemini AI
      console.log('🧠 Generating new quiz with AI...');
      const geminiService = await import('./geminiService.js');
      const quizData = await geminiService.default.generateQuiz(roadmapData);
      
      // Save quiz to database
      const createdQuiz = await this.createUserQuiz(
        userRoadmapId, 
        quizData, 
        quizData.questions.length,
        'mixed'
      );
      
      console.log('✅ Quiz generated and saved successfully');
      return createdQuiz;
    } catch (error) {
      console.error('❌ Failed to generate or get quiz:', error);
      throw new Error(`Failed to generate or get quiz: ${error.message}`);
    }
  }

  async saveQuiz({ roadmapId, userId, quizData, topic }) {
    this._checkConnection();
    try {
      console.log(`💾 Saving new quiz for roadmap: ${roadmapId}`);
      
      const result = await this.sql`
        INSERT INTO user_quizzes (
          user_roadmap_id, 
          quiz_data, 
          total_questions, 
          difficulty_level,
          created_at,
          updated_at
        ) VALUES (
          ${roadmapId},
          ${JSON.stringify(quizData)},
          ${quizData.questions.length},
          'mixed',
          NOW(),
          NOW()
        )
        RETURNING *
      `;
      
      console.log('✅ Quiz saved successfully');
      return result[0];
    } catch (error) {
      console.error('❌ Failed to save quiz:', error);
      throw new Error(`Failed to save quiz: ${error.message}`);
    }
  }

  async deleteQuizByRoadmap(roadmapId) {
    this._checkConnection();
    try {
      console.log(`🗑️ Deleting quiz and attempts for roadmap: ${roadmapId}`);
      
      // First delete quiz attempts
      await this.sql`
        DELETE FROM quiz_attempts 
        WHERE user_quiz_id IN (
          SELECT id FROM user_quizzes WHERE user_roadmap_id = ${roadmapId}
        )
      `;
      
      // Then delete quiz progress
      await this.sql`
        DELETE FROM quiz_progress 
        WHERE user_quiz_id IN (
          SELECT id FROM user_quizzes WHERE user_roadmap_id = ${roadmapId}
        )
      `;
      
      // Finally delete the quiz itself
      const result = await this.sql`
        DELETE FROM user_quizzes 
        WHERE user_roadmap_id = ${roadmapId}
        RETURNING id
      `;
      
      console.log(`✅ Deleted quiz and ${result.length} records for roadmap: ${roadmapId}`);
      return result.length;
    } catch (error) {
      console.error('❌ Failed to delete quiz by roadmap:', error);
      throw new Error(`Failed to delete quiz by roadmap: ${error.message}`);
    }
  }

  async getQuizResults(roadmapId, userId) {
    this._checkConnection();
    try {
      console.log(`📊 Getting quiz results for roadmap: ${roadmapId}, user: ${userId}`);
      
      // Get roadmap info
      const roadmap = await this.sql`
        SELECT id, topic, roadmap_data 
        FROM user_roadmaps 
        WHERE id = ${roadmapId} AND user_id = ${userId}
      `;
      
      if (roadmap.length === 0) {
        throw new Error('Roadmap not found');
      }
      
      // Get quiz
      const quiz = await this.sql`
        SELECT * FROM user_quizzes 
        WHERE user_roadmap_id = ${roadmapId}
      `;
      
      if (quiz.length === 0) {
        throw new Error('No quiz found for this roadmap');
      }
      
      // Get all attempts
      const attempts = await this.sql`
        SELECT 
          id,
          attempt_number,
          score,
          total_questions,
          percentage,
          time_taken,
          completed_at,
          user_answers
        FROM quiz_attempts 
        WHERE user_quiz_id = ${quiz[0].id}
        ORDER BY attempt_number DESC
      `;
      
      // Calculate statistics
      const statistics = {
        totalAttempts: attempts.length,
        avgPercentage: attempts.length > 0 ? attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length : 0,
        bestPercentage: attempts.length > 0 ? Math.max(...attempts.map(a => a.percentage)) : 0,
        worstPercentage: attempts.length > 0 ? Math.min(...attempts.map(a => a.percentage)) : 0,
        avgTimeInSeconds: attempts.length > 0 ? attempts.reduce((sum, a) => sum + a.time_taken, 0) / attempts.length : 0
      };
      
      const results = {
        roadmap: roadmap[0],
        quiz: quiz[0],
        attempts,
        statistics
      };
      
      console.log(`✅ Retrieved quiz results: ${attempts.length} attempts`);
      return results;
    } catch (error) {
      console.error('❌ Failed to get quiz results:', error);
      throw new Error(`Failed to get quiz results: ${error.message}`);
    }
  }

  async hasQuizAttempts(roadmapId, userId) {
    this._checkConnection();
    try {
      console.log(`🔍 Checking quiz attempts for roadmap: ${roadmapId}, user: ${userId}`);
      
      // Check if there are any attempts for ANY quiz associated with this roadmap
      const attempts = await this.sql`
        SELECT COUNT(*) as count 
        FROM quiz_attempts qa
        JOIN user_quizzes uq ON qa.user_quiz_id = uq.id
        WHERE uq.user_roadmap_id = ${roadmapId}
      `;
      
      const hasAttempts = attempts[0].count > 0;
      console.log(`✅ Quiz attempts check: ${hasAttempts ? 'Found' : 'None'} (${attempts[0].count} attempts) for roadmap ${roadmapId}`);
      return hasAttempts;
    } catch (error) {
      console.error('❌ Failed to check quiz attempts:', error);
      return false;
    }
  }

  // ====== USED QUESTIONS TRACKING METHODS ======
  
  /**
   * Create SHA-256 hash of question text for efficient storage and lookup
   */
  _createQuestionHash(questionText) {
    return crypto.createHash('sha256').update(questionText.toLowerCase().trim()).digest('hex');
  }

  /**
   * Store used questions for a roadmap
   */
  async storeUsedQuestions(userId, userRoadmapId, questions) {
    this._checkConnection();
    try {
      console.log(`📝 Storing ${questions.length} used questions for roadmap: ${userRoadmapId}`);
      console.log(`📝 DEBUG - First question:`, questions[0]);
      console.log(`📝 DEBUG - Questions structure:`, questions.slice(0, 2));
      
      const questionHashes = questions.map(q => {
        const questionText = q.question || q.text || q;
        console.log(`📝 DEBUG - Processing question:`, questionText?.substring(0, 50) + '...');
        return {
          user_id: userId,
          user_roadmap_id: userRoadmapId,
          question_text: questionText,
          question_hash: this._createQuestionHash(questionText)
        };
      });

      console.log(`📝 DEBUG - About to insert ${questionHashes.length} questions`);

      // Insert all questions (ignore conflicts for existing hashes)
      for (const qHash of questionHashes) {
        console.log(`📝 DEBUG - Inserting question: "${qHash.question_text?.substring(0, 30)}..."`);
        await this.sql`
          INSERT INTO user_roadmap_used_questions (user_id, user_roadmap_id, question_text, question_hash)
          VALUES (${qHash.user_id}, ${qHash.user_roadmap_id}, ${qHash.question_text}, ${qHash.question_hash})
          ON CONFLICT (user_id, user_roadmap_id, question_hash) DO NOTHING
        `;
      }

      console.log(`✅ Successfully stored used questions for roadmap: ${userRoadmapId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store used questions:', error);
      throw error;
    }
  }

  /**
   * Get list of used question texts for a user's roadmap (for AI avoidance)
   */
  async getUsedQuestionTexts(userId, userRoadmapId, limit = 20) {
    this._checkConnection();
    try {
      console.log(`🔍 Getting used question texts for roadmap: ${userRoadmapId}`);
      
      const usedQuestions = await this.sql`
        SELECT question_text
        FROM user_roadmap_used_questions
        WHERE user_id = ${userId} AND user_roadmap_id = ${userRoadmapId}
        ORDER BY used_at DESC
        LIMIT ${limit}
      `;

      const questionTexts = usedQuestions.map(q => q.question_text);
      console.log(`✅ Found ${questionTexts.length} used question texts for roadmap: ${userRoadmapId}`);
      return questionTexts;
    } catch (error) {
      console.error('❌ Failed to get used question texts:', error);
      return [];
    }
  }

  /**
   * Get list of used question hashes for a user's roadmap
   */
  async getUsedQuestionHashes(userId, userRoadmapId) {
    this._checkConnection();
    try {
      console.log(`🔍 Getting used question hashes for roadmap: ${userRoadmapId}`);
      
      const usedQuestions = await this.sql`
        SELECT question_hash, question_text, used_at
        FROM user_roadmap_used_questions
        WHERE user_id = ${userId} AND user_roadmap_id = ${userRoadmapId}
        ORDER BY used_at DESC
      `;

      const hashes = usedQuestions.map(q => q.question_hash);
      console.log(`✅ Found ${hashes.length} used questions for roadmap: ${userRoadmapId}`);
      return hashes;
    } catch (error) {
      console.error('❌ Failed to get used question hashes:', error);
      return [];
    }
  }

  /**
   * Filter out questions that have already been used
   */
  filterUnusedQuestions(questions, usedHashes) {
    console.log(`🔍 Filtering ${questions.length} questions against ${usedHashes.length} used hashes`);
    
    const unusedQuestions = questions.filter(question => {
      const questionText = question.question || question.text || question;
      const questionHash = this._createQuestionHash(questionText);
      return !usedHashes.includes(questionHash);
    });

    console.log(`✅ Found ${unusedQuestions.length} unused questions out of ${questions.length} total`);
    return unusedQuestions;
  }

  /**
   * Clear old used questions (keep last 100 per roadmap to prevent unlimited growth)
   */
  async cleanupOldUsedQuestions(userId, userRoadmapId, keepCount = 100) {
    this._checkConnection();
    try {
      console.log(`🧹 Cleaning up old used questions for roadmap: ${userRoadmapId} (keeping ${keepCount})`);
      
      await this.sql`
        DELETE FROM user_roadmap_used_questions
        WHERE user_id = ${userId} 
        AND user_roadmap_id = ${userRoadmapId}
        AND id NOT IN (
          SELECT id FROM user_roadmap_used_questions
          WHERE user_id = ${userId} AND user_roadmap_id = ${userRoadmapId}
          ORDER BY used_at DESC
          LIMIT ${keepCount}
        )
      `;

      console.log(`✅ Cleaned up old used questions for roadmap: ${userRoadmapId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to cleanup old used questions:', error);
      return false;
    }
  }
}

export default new DatabaseService();

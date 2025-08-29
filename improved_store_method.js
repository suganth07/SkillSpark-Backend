  // Improved storeUserVideos method with better regeneration handling
  async storeUserVideos(userRoadmapId, level, videoData, pageNumber = 1, pointId = null, isRegenerate = false) {
    this._checkConnection();
    try {
      console.log('🔍 DEBUG - storeUserVideos called with:', {
        userRoadmapId,
        level, 
        pageNumber,
        pointId,
        pointIdType: typeof pointId,
        isRegenerate,
        videoDataLength: Array.isArray(videoData) ? videoData.length : 'not array'
      });
      
      console.log(`🔄 Storing videos for roadmap: ${userRoadmapId}, level: ${level}, page: ${pageNumber}, pointId: ${pointId}`);

      // Parse videoData if it's a string
      let parsedVideoData;
      if (typeof videoData === 'string') {
        try {
          parsedVideoData = JSON.parse(videoData);
        } catch (parseError) {
          console.error('❌ Error parsing video data:', parseError);
          throw new Error('Invalid video data format');
        }
      } else {
        parsedVideoData = videoData;
      }

      // Add point information to each video
      const videoDataWithPointId = parsedVideoData.map(video => ({
        ...video,
        pointId: pointId,
        generatedAt: new Date().toISOString()
      }));
      
      // For regeneration, always get the next available generation number
      if (isRegenerate && pointId) {
        console.log(`🔄 Handling regeneration for point ${pointId}`);
        return await this.insertRegeneratedVideos(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId);
      }
      
      // For new videos, check if they already exist and handle accordingly
      const existingVideos = await this.sql`
        SELECT * FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} 
          AND level = ${level} 
          AND page_number = ${pageNumber}
          AND point_id = ${pointId}
        ORDER BY generation_number DESC
        LIMIT 1
      `;
      
      if (existingVideos.length > 0) {
        console.log(`📊 Found existing videos for point ${pointId}, creating new generation`);
        const maxGeneration = existingVideos[0].generation_number;
        const newGeneration = maxGeneration + 1;
        
        return await this.insertVideosWithGeneration(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId, newGeneration);
      } else {
        console.log(`🆕 No existing videos found, creating first generation for point ${pointId}`);
        return await this.insertVideosWithGeneration(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId, 1);
      }
      
    } catch (error) {
      console.error('❌ Error storing user videos:', error);
      throw new Error(`Failed to store user videos: ${error.message}`);
    }
  }

  // Helper method for regeneration
  async insertRegeneratedVideos(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId) {
    try {
      // Get the next available generation number for this specific point
      const maxGenResult = await this.sql`
        SELECT COALESCE(MAX(generation_number), 0) as max_gen
        FROM user_videos 
        WHERE user_roadmap_id = ${userRoadmapId} 
          AND level = ${level} 
          AND page_number = ${pageNumber}
          AND point_id = ${pointId}
      `;
      
      const nextGeneration = (maxGenResult[0]?.max_gen || 0) + 1;
      console.log(`🔢 Using generation number ${nextGeneration} for point ${pointId} regeneration`);
      
      return await this.insertVideosWithGeneration(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId, nextGeneration);
      
    } catch (error) {
      console.error(`❌ Error during regeneration for point ${pointId}:`, error);
      
      // If there's still an error, use a timestamp-based approach to ensure uniqueness
      const timestampBasedGeneration = Date.now() % 1000000;
      console.log(`⚠️ Fallback to timestamp-based generation: ${timestampBasedGeneration}`);
      
      return await this.insertVideosWithGeneration(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId, timestampBasedGeneration);
    }
  }

  // Helper method to insert videos with specific generation number
  async insertVideosWithGeneration(userRoadmapId, level, videoDataWithPointId, pageNumber, pointId, generationNumber) {
    try {
      const result = await this.sql`
        INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, point_id, created_at, updated_at)
        VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoDataWithPointId)}, ${pageNumber}, ${generationNumber}, ${pointId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      console.log(`✅ Successfully inserted videos for point ${pointId} with generation ${generationNumber}`);
      return result[0];
      
    } catch (insertError) {
      console.error(`❌ Error inserting videos for point ${pointId} with generation ${generationNumber}:`, insertError);
      
      // If it's a duplicate key error, try with a different generation number
      if (insertError.code === '23505') {
        const randomGeneration = Date.now() % 1000000 + Math.floor(Math.random() * 1000);
        console.log(`🎲 Retry with random generation number: ${randomGeneration}`);
        
        const retryResult = await this.sql`
          INSERT INTO user_videos (user_roadmap_id, level, video_data, page_number, generation_number, point_id, created_at, updated_at)
          VALUES (${userRoadmapId}, ${level}, ${JSON.stringify(videoDataWithPointId)}, ${pageNumber}, ${randomGeneration}, ${pointId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        
        console.log(`✅ Successfully inserted videos with random generation ${randomGeneration}`);
        return retryResult[0];
      }
      
      throw insertError;
    }
  }

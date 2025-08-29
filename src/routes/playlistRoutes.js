import express from "express";
import {
  PlaylistItem,
  PlaylistSuccessResponse,
  ErrorResponse,
  ErrorDetails,
  validatePlaylistRequest,
} from "../models/responseModels.js";
import geminiService from "../services/geminiService.js";
import youtubeService from "../services/youtubeService.js";
import neonDbService from "../services/neonDbService.js";
import { generateId } from "../utils/helpers.js";
import {
  playlistLimiter,
  validatePlaylistInput,
} from "../middleware/security.js";
import { appLogger } from "../utils/logger.js";

const router = express.Router();

// Helper method to generate fallback titles
const generateFallbackTitles = async (
  topic,
  pointTitle,
  userPreferences,
  usedVideoIds
) => {
  const fallbackPatterns = [
    `${pointTitle} ${topic} tutorial`,
    `Learn ${pointTitle} in ${topic}`,
    `${topic} ${pointTitle} complete guide`,
    `${pointTitle} for ${topic} developers`,
    `${topic} ${pointTitle} step by step`,
  ];

  return fallbackPatterns;
};

router.post(
  "/generate",
  playlistLimiter,
  validatePlaylistInput,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { topic, pointTitle, userPreferences, userRoadmapId, level, pointId, userId } = validatePlaylistRequest(
        req.body
      );

      console.log("🔍 DEBUG - Extracted values:", {
        topic,
        pointTitle,
        userRoadmapId,
        level,
        pointId,
        pointIdType: typeof pointId,
        userId
      });

      appLogger.info("Generating playlists", {
        topic,
        pointTitle,
        userPreferences,
        userRoadmapId,
        level,
        pointId,
        userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Get user settings to use as preferences if userId is provided
      let finalUserPreferences = userPreferences || {};
      
      if (userId) {
        try {
          const userSettings = await neonDbService.getUserSettings(userId);
          
          // Use user settings as default preferences, but allow override from request
          finalUserPreferences = {
            default_roadmap_depth: userPreferences?.default_roadmap_depth || userSettings.default_roadmap_depth || 'detailed',
            default_video_length: userPreferences?.default_video_length || userSettings.default_video_length || 'medium'
          };
          
          appLogger.info("Using user settings for playlist generation", {
            userId,
            finalUserPreferences,
            ip: req.ip,
          });
        } catch (settingsError) {
          appLogger.warn("Could not fetch user settings for playlist generation, using defaults", {
            userId,
            error: settingsError.message,
            ip: req.ip,
          });
          
          // Fall back to request preferences or defaults
          finalUserPreferences = {
            default_roadmap_depth: userPreferences?.default_roadmap_depth || 'detailed',
            default_video_length: userPreferences?.default_video_length || 'medium'
          };
        }
      }

      let playlists = [];

      // Check if videos already exist in database for this level and point
      if (userRoadmapId && level) {
        try {
          const existingVideos = await neonDbService.getUserVideos(userRoadmapId, level, 1, pointId);
          if (existingVideos.length > 0) {
            appLogger.info("Found existing videos in database", {
              userRoadmapId,
              level,
              videoCount: existingVideos.length,
              ip: req.ip,
            });

            // Convert stored video data to playlist format
            playlists = existingVideos[0].video_data.map(video => new PlaylistItem(video));
            
            const processingTime = Date.now() - startTime;
            appLogger.info("Playlists retrieved from database", {
              topic,
              pointTitle,
              level,
              videoCount: playlists.length,
              processingTime: `${processingTime}ms`,
              ip: req.ip,
            });

            const response = new PlaylistSuccessResponse(playlists);
            return res.json(response);
          }
        } catch (error) {
          appLogger.warn("Error retrieving existing videos, proceeding with generation", {
            error: error.message,
            userRoadmapId,
            level,
            ip: req.ip,
          });
        }
      }

      // Generate new videos if none exist
      const videoTitles = await geminiService.generateVideoTitles(
        topic,
        pointTitle,
        finalUserPreferences
      );

      appLogger.info("Generated video titles", {
        topic,
        pointTitle,
        titlesCount: videoTitles.length,
        titles: videoTitles,
        userPreferences: finalUserPreferences,
        ip: req.ip,
      });

      // Use the improved searchMultipleVideos method
      const videoResults = await youtubeService.searchMultipleVideos(
        videoTitles,
        finalUserPreferences
      );

      playlists = [];
      const usedVideoIds = new Set();
      const usedTitles = new Set();

      for (const result of videoResults) {
        // Additional deduplication check
        if (
          !usedVideoIds.has(result.videoId) &&
          !usedTitles.has(result.title.toLowerCase())
        ) {
          const playlistItem = new PlaylistItem({
            id: generateId("playlist"),
            title: result.title,
            videoUrl: `https://youtube.com/watch?v=${result.videoId}`,
            duration: result.duration || "N/A",
            durationMinutes: result.durationMinutes || null,
            description: result.description || "No description available",
            channelTitle: result.channelTitle || null,
            publishedAt: result.publishedAt || null,
          });

          playlists.push(playlistItem);
          usedVideoIds.add(result.videoId);
          usedTitles.add(result.title.toLowerCase());
        }
      }

      // If we don't have enough videos, try with fallback search terms
      if (playlists.length < 3) {
        appLogger.info("Insufficient videos found, trying fallback search", {
          topic,
          pointTitle,
          currentCount: playlists.length,
          ip: req.ip,
        });

        const fallbackTitles = await generateFallbackTitles(
          topic,
          pointTitle,
          finalUserPreferences,
          usedVideoIds
        );

        const fallbackResults = await youtubeService.searchMultipleVideos(
          fallbackTitles,
          finalUserPreferences
        );

        for (const result of fallbackResults) {
          if (
            !usedVideoIds.has(result.videoId) &&
            !usedTitles.has(result.title.toLowerCase()) &&
            playlists.length < 5
          ) {
            const playlistItem = new PlaylistItem({
              id: generateId("playlist"),
              title: result.title,
              videoUrl: `https://youtube.com/watch?v=${result.videoId}`,
              duration: result.duration || "N/A",
              durationMinutes: result.durationMinutes || null,
              description: result.description || "No description available",
              channelTitle: result.channelTitle || null,
              publishedAt: result.publishedAt || null,
            });

            playlists.push(playlistItem);
            usedVideoIds.add(result.videoId);
            usedTitles.add(result.title.toLowerCase());
          }
        }
      }

      const processingTime = Date.now() - startTime;

      appLogger.info("Playlists generated successfully", {
        topic,
        pointTitle,
        totalRequested: videoTitles.length,
        successCount: playlists.length,
        processingTime: `${processingTime}ms`,
        userPreferences: finalUserPreferences,
        ip: req.ip,
      });

      // Store videos in database if userRoadmapId and level are provided
      if (userRoadmapId && level && playlists.length > 0) {
        try {
          await neonDbService.storeUserVideos(userRoadmapId, level, playlists, 1, pointId);
          appLogger.info("Videos stored in database", {
            userRoadmapId,
            level,
            videoCount: playlists.length,
            ip: req.ip,
          });
        } catch (error) {
          appLogger.error("Failed to store videos in database", error, {
            userRoadmapId,
            level,
            videoCount: playlists.length,
            ip: req.ip,
          });
          // Continue with response even if storage fails
        }
      }

      const response = new PlaylistSuccessResponse(playlists);
      res.json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error generating playlists", error, {
        topic: req.body?.topic,
        pointTitle: req.body?.pointTitle,
        userPreferences: req.body?.userPreferences,
        userId: req.body?.userId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "GENERATION_FAILED",
          "Failed to generate playlists",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// Route for regenerating videos (replacing existing ones)
router.post(
  "/regenerate",
  playlistLimiter,
  validatePlaylistInput,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { topic, pointTitle, userPreferences, userRoadmapId, level, pointId, userId } = validatePlaylistRequest(
        req.body
      );

      // Validate required parameters for regeneration
      if (!userRoadmapId || !level) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "MISSING_PARAMETERS",
            "userRoadmapId and level are required for video regeneration",
            "Please provide both userRoadmapId and level in the request body"
          )
        );
        return res.status(400).json(errorResponse);
      }

      appLogger.info("Regenerating playlists", {
        topic,
        pointTitle,
        userPreferences,
        userRoadmapId,
        level,
        pointId,
        userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Get user settings to use as preferences if userId is provided
      let finalUserPreferences = userPreferences || {};
      
      if (userId) {
        try {
          const userSettings = await neonDbService.getUserSettings(userId);
          
          // Use user settings as default preferences, but allow override from request
          finalUserPreferences = {
            defaultRoadmapDepth: userPreferences?.defaultRoadmapDepth || userSettings.default_roadmap_depth || 'detailed',
            defaultVideoLength: userPreferences?.defaultVideoLength || userSettings.default_video_length || 'medium'
          };
          
          appLogger.info("Using user settings for playlist regeneration", {
            userId,
            finalUserPreferences,
            ip: req.ip,
          });
        } catch (settingsError) {
          appLogger.warn("Could not fetch user settings for playlist regeneration, using defaults", {
            userId,
            error: settingsError.message,
            ip: req.ip,
          });
          
          // Fall back to request preferences or defaults
          finalUserPreferences = {
            defaultRoadmapDepth: userPreferences?.defaultRoadmapDepth || 'detailed',
            defaultVideoLength: userPreferences?.defaultVideoLength || 'medium'
          };
        }
      }

      // Generate new videos
      const videoTitles = await geminiService.generateVideoTitles(
        topic,
        pointTitle,
        finalUserPreferences
      );

      appLogger.info("Generated video titles for regeneration", {
        topic,
        pointTitle,
        titlesCount: videoTitles.length,
        titles: videoTitles,
        userPreferences: finalUserPreferences,
        ip: req.ip,
      });

      // Use the improved searchMultipleVideos method
      const videoResults = await youtubeService.searchMultipleVideos(
        videoTitles,
        finalUserPreferences
      );

      const playlists = [];
      const usedVideoIds = new Set();
      const usedTitles = new Set();

      for (const result of videoResults) {
        // Additional deduplication check
        if (
          !usedVideoIds.has(result.videoId) &&
          !usedTitles.has(result.title.toLowerCase())
        ) {
          const playlistItem = new PlaylistItem({
            id: generateId("playlist"),
            title: result.title,
            videoUrl: `https://youtube.com/watch?v=${result.videoId}`,
            duration: result.duration || "N/A",
            durationMinutes: result.durationMinutes || null,
            description: result.description || "No description available",
            channelTitle: result.channelTitle || null,
            publishedAt: result.publishedAt || null,
          });

          playlists.push(playlistItem);
          usedVideoIds.add(result.videoId);
          usedTitles.add(result.title.toLowerCase());
        }
      }

      // If we don't have enough videos, try with fallback search terms
      if (playlists.length < 3) {
        appLogger.info("Insufficient videos found during regeneration, trying fallback search", {
          topic,
          pointTitle,
          currentCount: playlists.length,
          ip: req.ip,
        });

        const fallbackTitles = await generateFallbackTitles(
          topic,
          pointTitle,
          finalUserPreferences,
          usedVideoIds
        );

        const fallbackResults = await youtubeService.searchMultipleVideos(
          fallbackTitles,
          finalUserPreferences
        );

        for (const result of fallbackResults) {
          if (
            !usedVideoIds.has(result.videoId) &&
            !usedTitles.has(result.title.toLowerCase()) &&
            playlists.length < 5
          ) {
            const playlistItem = new PlaylistItem({
              id: generateId("playlist"),
              title: result.title,
              videoUrl: `https://youtube.com/watch?v=${result.videoId}`,
              duration: result.duration || "N/A",
              durationMinutes: result.durationMinutes || null,
              description: result.description || "No description available",
              channelTitle: result.channelTitle || null,
              publishedAt: result.publishedAt || null,
            });

            playlists.push(playlistItem);
            usedVideoIds.add(result.videoId);
            usedTitles.add(result.title.toLowerCase());
          }
        }
      }

      const processingTime = Date.now() - startTime;

      appLogger.info("Playlists regenerated successfully", {
        topic,
        pointTitle,
        totalRequested: videoTitles.length,
        successCount: playlists.length,
        processingTime: `${processingTime}ms`,
        userPreferences: finalUserPreferences,
        ip: req.ip,
      });

      // Store new videos in database with pagination (move old videos to next page)
      try {
        await neonDbService.storeUserVideos(userRoadmapId, level, playlists, 1, pointId, true); // pageNumber = 1, pointId, isRegenerate = true
        appLogger.info("Regenerated videos stored in database", {
          userRoadmapId,
          level,
          videoCount: playlists.length,
          ip: req.ip,
        });
      } catch (error) {
        appLogger.error("Failed to store regenerated videos in database", error, {
          userRoadmapId,
          level,
          videoCount: playlists.length,
          ip: req.ip,
        });
        // Return error if storage fails during regeneration
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "STORAGE_FAILED",
            "Failed to store regenerated videos",
            process.env.NODE_ENV === "production"
              ? "Please try again later"
              : error.message
          )
        );
        return res.status(500).json(errorResponse);
      }

      const response = new PlaylistSuccessResponse(playlists);
      res.json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error regenerating playlists", error, {
        topic: req.body?.topic,
        pointTitle: req.body?.pointTitle,
        userPreferences: req.body?.userPreferences,
        userRoadmapId: req.body?.userRoadmapId,
        level: req.body?.level,
        userId: req.body?.userId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "REGENERATION_FAILED",
          "Failed to regenerate playlists",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// Route for bulk generation of videos for all points in a level (NEW VERSION - extracts from roadmap)
router.post(
  "/generate-bulk-from-roadmap",
  playlistLimiter,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { 
        topic, 
        level, 
        userRoadmapId, 
        userId,
        userPreferences 
      } = req.body;

      // Validate required parameters
      if (!topic || !level || !userRoadmapId) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "MISSING_PARAMETERS",
            "Missing required parameters for bulk generation",
            "topic, level, and userRoadmapId are required"
          )
        );
        return res.status(400).json(errorResponse);
      }

      // Get roadmap data to extract points
      const roadmapData = await neonDbService.getUserRoadmaps(userId);
      const currentRoadmap = roadmapData.find(r => r.id == userRoadmapId);
      
      if (!currentRoadmap) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "ROADMAP_NOT_FOUND",
            "Roadmap not found",
            "The specified roadmap does not exist"
          )
        );
        return res.status(404).json(errorResponse);
      }

      // Migrate roadmap if needed and extract points for the specified level
      let points = [];
      const roadmapContent = typeof currentRoadmap.roadmap_data === 'string' 
        ? JSON.parse(currentRoadmap.roadmap_data) 
        : currentRoadmap.roadmap_data;

      if (roadmapContent.roadmap && roadmapContent.roadmap[level]) {
        const levelData = roadmapContent.roadmap[level];
        
        // If it's still in array format, migrate it first
        if (Array.isArray(levelData)) {
          console.log(`🔄 Migrating roadmap ${userRoadmapId} to use step IDs`);
          await neonDbService.migrateRoadmapToStepIds(userRoadmapId);
          
          // Extract points from migrated roadmap
          const migratedRoadmap = await neonDbService.getUserRoadmaps(userId);
          const updatedRoadmap = migratedRoadmap.find(r => r.id == userRoadmapId);
          const updatedContent = typeof updatedRoadmap.roadmap_data === 'string' 
            ? JSON.parse(updatedRoadmap.roadmap_data) 
            : updatedRoadmap.roadmap_data;
            
          points = Object.values(updatedContent.roadmap[level]);
        } else {
          // Already in object format with step IDs
          points = Object.values(levelData);
        }
      }

      if (points.length === 0) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "NO_POINTS_FOUND",
            "No points found for this level",
            `No learning points found for ${level} level`
          )
        );
        return res.status(404).json(errorResponse);
      }

      console.log(`🚀 Starting bulk video generation for ${points.length} points from roadmap`);
      
      // Get user preferences
      let finalUserPreferences = {
        defaultRoadmapDepth: 'detailed',
        defaultVideoLength: 'medium'
      };

      if (userId) {
        try {
          const userSettings = await supabaseService.getUserSettings(userId);
          finalUserPreferences = {
            defaultRoadmapDepth: userSettings.default_roadmap_depth || 'detailed',
            defaultVideoLength: userSettings.default_video_length || 'medium'
          };
        } catch (settingsError) {
          console.log("Using default preferences for bulk generation");
        }
      }

      const results = [];
      const errors = [];

      // Generate videos for each point using the step IDs from roadmap
      for (const point of points) {
        const stepId = point.pointId; // Use the step ID from roadmap
        
        try {
          console.log(`📹 Generating videos for ${stepId}: ${point.pointTitle || point.title}`);
          
          // Check if videos already exist for this step
          const existingVideos = await neonDbService.getUserVideos(userRoadmapId, level, 1, stepId);
          if (existingVideos.length > 0) {
            console.log(`📹 Videos already exist for ${stepId}, skipping`);
            
            // Convert stored video data to playlist format
            const playlists = existingVideos[0].video_data.map(video => new PlaylistItem(video));
            results.push({
              pointId: stepId,
              pointTitle: point.pointTitle || point.title,
              videoCount: playlists.length,
              status: 'existing'
            });
            continue;
          }

          // Generate video titles for this specific point
          const videoTitles = await geminiService.generateVideoTitles(
            topic,
            point.pointTitle || point.title,
            finalUserPreferences
          );

          // Search for videos
          const videoResults = await youtubeService.searchMultipleVideos(
            videoTitles,
            finalUserPreferences
          );

          // Create playlist items
          const playlists = [];
          const usedVideoIds = new Set();

          for (const result of videoResults) {
            if (result && result.videoId && !usedVideoIds.has(result.videoId)) {
              const playlistItem = new PlaylistItem({
                id: result.videoId,
                title: result.title,
                description: result.description,
                duration: result.duration,
                channelTitle: result.channelTitle,
                publishedAt: result.publishedAt || null,
              });

              playlists.push(playlistItem);
              usedVideoIds.add(result.videoId);
            }
          }

          // Store videos in database with step ID from roadmap
          if (playlists.length > 0) {
            await neonDbService.storeUserVideos(userRoadmapId, level, playlists, 1, stepId);
            
            results.push({
              pointId: stepId,
              pointTitle: point.pointTitle || point.title,
              videoCount: playlists.length,
              status: 'generated'
            });

            console.log(`✅ Generated ${playlists.length} videos for ${stepId}: ${point.pointTitle || point.title}`);
          } else {
            errors.push({
              pointId: stepId,
              pointTitle: point.pointTitle || point.title,
              error: 'No videos found'
            });
          }

        } catch (pointError) {
          console.error(`❌ Error generating videos for ${stepId}:`, pointError);
          errors.push({
            pointId: stepId,
            pointTitle: point.pointTitle || point.title,
            error: pointError.message
          });
        }
      }

      const processingTime = Date.now() - startTime;

      appLogger.info("Bulk video generation from roadmap completed", {
        topic,
        level,
        totalPoints: points.length,
        successCount: results.length,
        errorCount: errors.length,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      const response = {
        success: true,
        data: {
          results,
          errors,
          summary: {
            totalPoints: points.length,
            generated: results.filter(r => r.status === 'generated').length,
            existing: results.filter(r => r.status === 'existing').length,
            failed: errors.length,
            processingTime: `${processingTime}ms`
          }
        }
      };

      res.json(response);

    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error in bulk video generation from roadmap", error, {
        topic: req.body?.topic,
        level: req.body?.level,
        userRoadmapId: req.body?.userRoadmapId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "BULK_GENERATION_FAILED",
          "Failed to generate videos from roadmap",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// Route for bulk generation of videos for all points in a level
router.post(
  "/generate-bulk",
  playlistLimiter,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { 
        topic, 
        level, 
        userRoadmapId, 
        userId, 
        points, // Array of {pointId, pointTitle} objects
        userPreferences 
      } = req.body;

      // Validate required parameters
      if (!topic || !level || !userRoadmapId || !points || !Array.isArray(points)) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "MISSING_PARAMETERS",
            "Missing required parameters for bulk generation",
            "topic, level, userRoadmapId, and points array are required"
          )
        );
        return res.status(400).json(errorResponse);
      }

      console.log(`🚀 Starting bulk video generation for ${points.length} points`);
      
      // Get user preferences
      let finalUserPreferences = {
        defaultRoadmapDepth: 'detailed',
        defaultVideoLength: 'medium'
      };

      if (userId) {
        try {
          const userSettings = await supabaseService.getUserSettings(userId);
          finalUserPreferences = {
            defaultRoadmapDepth: userSettings.default_roadmap_depth || 'detailed',
            defaultVideoLength: userSettings.default_video_length || 'medium'
          };
        } catch (settingsError) {
          console.log("Using default preferences for bulk generation");
        }
      }

      const results = [];
      const errors = [];

      // Get the starting step number for this level
      let currentStepNumber = await neonDbService.getNextStepNumber(userRoadmapId, level);

      // Generate videos for each point with sequential step numbering
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const stepId = `step_${currentStepNumber + i}`;
        
        try {
          console.log(`📹 Generating videos for ${stepId}: ${point.pointTitle || point.title}`);
          
          // Check if videos already exist for this step
          const existingVideos = await neonDbService.getUserVideos(userRoadmapId, level, 1, stepId);
          if (existingVideos.length > 0) {
            console.log(`📹 Videos already exist for ${stepId}, skipping`);
            
            // Convert stored video data to playlist format
            const playlists = existingVideos[0].video_data.map(video => new PlaylistItem(video));
            results.push({
              pointId: stepId,
              pointTitle: point.pointTitle || point.title,
              videoCount: playlists.length,
              status: 'existing'
            });
            continue;
          }

          // Generate video titles for this specific point
          const videoTitles = await geminiService.generateVideoTitles(
            topic,
            point.pointTitle || point.title,
            finalUserPreferences
          );

          // Search for videos
          const videoResults = await youtubeService.searchMultipleVideos(
            videoTitles,
            finalUserPreferences
          );

          // Create playlist items
          const playlists = [];
          const usedVideoIds = new Set();

          for (const result of videoResults) {
            if (!usedVideoIds.has(result.videoId)) {
              const playlistItem = new PlaylistItem({
                id: generateId("playlist"),
                title: result.title,
                videoUrl: `https://youtube.com/watch?v=${result.videoId}`,
                duration: result.duration || "N/A",
                durationMinutes: result.durationMinutes || null,
                description: result.description || "No description available",
                channelTitle: result.channelTitle || null,
                publishedAt: result.publishedAt || null,
              });

              playlists.push(playlistItem);
              usedVideoIds.add(result.videoId);
            }
          }

          // Store videos in database with sequential step ID
          if (playlists.length > 0) {
            await neonDbService.storeUserVideos(userRoadmapId, level, playlists, 1, stepId);
            
            results.push({
              pointId: stepId,
              pointTitle: point.pointTitle || point.title,
              videoCount: playlists.length,
              status: 'generated'
            });

            console.log(`✅ Generated ${playlists.length} videos for ${stepId}: ${point.pointTitle || point.title}`);
          } else {
            errors.push({
              pointId: stepId,
              pointTitle: point.pointTitle || point.title,
              error: 'No videos found'
            });
          }

        } catch (pointError) {
          console.error(`❌ Error generating videos for ${stepId}:`, pointError);
          errors.push({
            pointId: stepId,
            pointTitle: point.pointTitle || point.title,
            error: pointError.message
          });
        }
      }

      const processingTime = Date.now() - startTime;

      appLogger.info("Bulk video generation completed", {
        topic,
        level,
        totalPoints: points.length,
        successCount: results.length,
        errorCount: errors.length,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      const response = {
        success: true,
        data: {
          results,
          errors,
          summary: {
            totalPoints: points.length,
            generated: results.filter(r => r.status === 'generated').length,
            existing: results.filter(r => r.status === 'existing').length,
            failed: errors.length,
            processingTime: `${processingTime}ms`
          }
        }
      };

      res.json(response);

    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error in bulk video generation", error, {
        topic: req.body?.topic,
        level: req.body?.level,
        userRoadmapId: req.body?.userRoadmapId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "BULK_GENERATION_FAILED",
          "Failed to generate videos for multiple points",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// New endpoint to get all point videos for a level
router.get('/point-videos/:userRoadmapId/:level', async (req, res) => {
  try {
    const { userRoadmapId, level } = req.params;
    const { page = 1 } = req.query;
    
    if (!userRoadmapId || !level) {
      return res.status(400).json({ 
        error: 'Missing required parameters: userRoadmapId and level' 
      });
    }
    
    console.log(`📋 Fetching all point videos for roadmap: ${userRoadmapId}, level: ${level}, page: ${page}`);
    
    const pointVideos = await neonDbService.getAllPointVideosForLevel(userRoadmapId, level, parseInt(page));
    
    res.status(200).json({
      success: true,
      data: pointVideos,
      count: Object.keys(pointVideos).length,
      userRoadmapId,
      level,
      page: parseInt(page)
    });

  } catch (error) {
    console.error('❌ Error fetching point videos:', error);
    res.status(500).json({ 
      error: 'Failed to fetch point videos',
      details: error.message 
    });
  }
});

export default router;

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
import supabaseService from "../services/supabaseService.js";
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
      const { topic, pointTitle, userPreferences, userRoadmapId, level, userId } = validatePlaylistRequest(
        req.body
      );

      appLogger.info("Generating playlists", {
        topic,
        pointTitle,
        userPreferences,
        userRoadmapId,
        level,
        userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Get user settings to use as preferences if userId is provided
      let finalUserPreferences = userPreferences || {};
      
      if (userId) {
        try {
          const userSettings = await supabaseService.getUserSettings(userId);
          
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

      // Check if videos already exist in Supabase for this level
      if (userRoadmapId && level) {
        try {
          const existingVideos = await supabaseService.getUserVideos(userRoadmapId, level);
          if (existingVideos.length > 0) {
            appLogger.info("Found existing videos in Supabase", {
              userRoadmapId,
              level,
              videoCount: existingVideos.length,
              ip: req.ip,
            });

            // Convert stored video data to playlist format
            playlists = existingVideos[0].video_data.map(video => new PlaylistItem(video));
            
            const processingTime = Date.now() - startTime;
            appLogger.info("Playlists retrieved from Supabase", {
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

      // Store videos in Supabase if userRoadmapId and level are provided
      if (userRoadmapId && level && playlists.length > 0) {
        try {
          await supabaseService.storeUserVideos(userRoadmapId, level, playlists);
          appLogger.info("Videos stored in Supabase", {
            userRoadmapId,
            level,
            videoCount: playlists.length,
            ip: req.ip,
          });
        } catch (error) {
          appLogger.error("Failed to store videos in Supabase", error, {
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
      const { topic, pointTitle, userPreferences, userRoadmapId, level, userId } = validatePlaylistRequest(
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
        userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Get user settings to use as preferences if userId is provided
      let finalUserPreferences = userPreferences || {};
      
      if (userId) {
        try {
          const userSettings = await supabaseService.getUserSettings(userId);
          
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

      // Store new videos in Supabase with pagination (move old videos to next page)
      try {
        await supabaseService.storeUserVideos(userRoadmapId, level, playlists, 1, true); // pageNumber = 1, isRegenerate = true
        appLogger.info("Regenerated videos stored in Supabase", {
          userRoadmapId,
          level,
          videoCount: playlists.length,
          ip: req.ip,
        });
      } catch (error) {
        appLogger.error("Failed to store regenerated videos in Supabase", error, {
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

export default router;

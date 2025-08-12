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
      const { topic, pointTitle, userPreferences } = validatePlaylistRequest(
        req.body
      );

      appLogger.info("Generating playlists", {
        topic,
        pointTitle,
        userPreferences,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const videoTitles = await geminiService.generateVideoTitles(
        topic,
        pointTitle,
        userPreferences
      );

      appLogger.info("Generated video titles", {
        topic,
        pointTitle,
        titlesCount: videoTitles.length,
        titles: videoTitles,
        ip: req.ip,
      });

      // Use the improved searchMultipleVideos method
      const videoResults = await youtubeService.searchMultipleVideos(
        videoTitles,
        userPreferences
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
        appLogger.info("Insufficient videos found, trying fallback search", {
          topic,
          pointTitle,
          currentCount: playlists.length,
          ip: req.ip,
        });

        const fallbackTitles = await generateFallbackTitles(
          topic,
          pointTitle,
          userPreferences,
          usedVideoIds
        );

        const fallbackResults = await youtubeService.searchMultipleVideos(
          fallbackTitles,
          userPreferences
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
        ip: req.ip,
      });

      const response = new PlaylistSuccessResponse(playlists);
      res.json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error generating playlists", error, {
        topic: req.body?.topic,
        pointTitle: req.body?.pointTitle,
        userPreferences: req.body?.userPreferences,
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

export default router;

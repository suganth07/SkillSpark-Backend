import express from "express";
import {
  PointResponse,
  ProgressResponse,
  RoadmapDataResponse,
  SuccessResponse,
  ErrorResponse,
  ErrorDetails,
  validateRoadmapRequest,
} from "../models/responseModels.js";
import geminiService from "../services/geminiService.js";
import neonDbService from "../services/neonDbService.js";
import {
  generateId,
  getCurrentTimestamp,
  capitalizeWords,
} from "../utils/helpers.js";
import {
  roadmapLimiter,
  validateRoadmapInput,
} from "../middleware/security.js";
import { appLogger } from "../utils/logger.js";

const router = express.Router();

router.post(
  "/generate",
  roadmapLimiter,
  validateRoadmapInput,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { topic, userPreferences, userId } = validateRoadmapRequest(req.body);

      appLogger.info("Generating roadmap", {
        topic,
        userId,
        userPreferences,
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
          
          appLogger.info("Using user settings for roadmap generation", {
            userId,
            finalUserPreferences,
            ip: req.ip,
          });
        } catch (settingsError) {
          appLogger.warn("Could not fetch user settings, using defaults", {
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

      const roadmapData = await geminiService.generateRoadmap(
        topic,
        finalUserPreferences
      );

      const extractedTopic = roadmapData.extractedTopic || "programming";
      const roadmap = roadmapData.roadmap || {};

      const points = [];
      let order = 1;

      for (const level of ["beginner", "intermediate", "advanced"]) {
        if (roadmap[level] && Array.isArray(roadmap[level])) {
          for (const pointTitle of roadmap[level]) {
            const point = new PointResponse({
              id: generateId("point"),
              title: pointTitle,
              description: `Master ${pointTitle.toLowerCase()} concepts and patterns`,
              level: level,
              order: order,
              playlists: null,
              isCompleted: false,
            });
            points.push(point);
            order++;
          }
        }
      }

      const timestamp = getCurrentTimestamp();

      const roadmapResponse = new SuccessResponse(
        new RoadmapDataResponse({
          id: generateId("roadmap"),
          topic: extractedTopic,
          title: `${capitalizeWords(extractedTopic)} Development Roadmap`,
          description: `Complete learning path for ${extractedTopic} development`,
          createdAt: timestamp,
          updatedAt: timestamp,
          points: points,
          progress: new ProgressResponse({
            completedPoints: 0,
            totalPoints: points.length,
            percentage: 0,
          }),
        })
      );

      const processingTime = Date.now() - startTime;

      appLogger.info("Roadmap generated successfully", {
        topic: extractedTopic,
        pointsCount: points.length,
        processingTime: `${processingTime}ms`,
        userPreferences: finalUserPreferences,
        ip: req.ip,
      });

      res.json(roadmapResponse);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error generating roadmap", error, {
        topic: req.body?.topic,
        userId: req.body?.userId,
        userPreferences: req.body?.userPreferences,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "GENERATION_FAILED",
          "Failed to generate roadmap for the given topic",
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

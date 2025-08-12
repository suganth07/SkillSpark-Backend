import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  async generateRoadmap(
    topic,
    userPreferences = { depth: "Balanced", videoLength: "Medium" }
  ) {
    try {
      // Map user preferences to generation parameters
      const depthMapping = {
        Fast: { points: 3, detail: "concise" },
        Balanced: { points: 4, detail: "balanced" },
        Detailed: { points: 5, detail: "comprehensive" },
      };

      const currentDepth =
        depthMapping[userPreferences.depth] || depthMapping["Balanced"];

      const prompt = `
        Create a comprehensive learning roadmap for: "${topic}"
        
        User preferences:
        - Depth: ${userPreferences.depth} (${currentDepth.detail} approach)
        - Video Length Preference: ${userPreferences.videoLength}
        
        First, extract the main technology/topic from the query "${topic}". For example:
        - "help me learning with java" -> "java"
        - "I want to learn React Native" -> "react native"
        - "machine learning tutorial" -> "machine learning"
        
        Then provide a structured roadmap divided into 3 levels:
        1. beginner: ${currentDepth.points} fundamental topics for beginners
        2. intermediate: ${
          currentDepth.points
        } topics for intermediate learners  
        3. advanced: ${currentDepth.points} topics for advanced learners
        
        Each level should contain only the topic names as strings, no descriptions or additional information.
        Make the topics ${
          currentDepth.detail
        } and appropriate for someone who prefers ${userPreferences.videoLength.toLowerCase()} learning sessions.
        
        Format the response as a JSON structure with the following schema:
        {
            "extractedTopic": "main_technology_name",
            "roadmap": {
                "beginner": ["topic1", "topic2", "topic3", ...],
                "intermediate": ["topic1", "topic2", "topic3", ...],
                "advanced": ["topic1", "topic2", "topic3", ...]
            }
        }
        
        Make sure topics are progressive and build upon each other.
        Return only the JSON, no additional text.
      `;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text;

      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{.*\}/s);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const roadmapData = JSON.parse(jsonMatch[0]);

      if (!roadmapData.extractedTopic || !roadmapData.roadmap) {
        throw new Error("Invalid roadmap structure received");
      }

      return roadmapData;
    } catch (error) {
      console.error("Error generating roadmap:", error);
      throw new Error(`Failed to generate roadmap: ${error.message}`);
    }
  }

  async generateVideoTitles(
    topic,
    pointTitle,
    userPreferences = { depth: "Balanced", videoLength: "Medium" }
  ) {
    try {
      const videoLengthMapping = {
        Short: {
          duration: "8-15 minutes",
          type: "focused tutorials, quick guides, or essential concepts",
          keywords: "tutorial, guide, explained, basics, intro, quick",
        },
        Medium: {
          duration: "15-30 minutes",
          type: "comprehensive tutorials with examples and practice",
          keywords:
            "complete guide, full tutorial, step by step, masterclass, course",
        },
        Long: {
          duration: "30+ minutes",
          type: "in-depth courses, complete walkthroughs, or project-based learning",
          keywords:
            "complete course, full project, masterclass, bootcamp, comprehensive",
        },
      };

      const depthMapping = {
        Fast: {
          approach: "quick overview with key points",
          complexity: "beginner-friendly with clear examples",
          focus: "essential concepts and practical application",
        },
        Balanced: {
          approach: "thorough coverage with examples and practice",
          complexity: "intermediate level with real-world scenarios",
          focus: "balanced theory and hands-on practice",
        },
        Detailed: {
          approach: "comprehensive deep-dive with advanced concepts",
          complexity:
            "detailed explanations with edge cases and best practices",
          focus: "complete understanding with advanced techniques",
        },
      };

      const videoLength =
        videoLengthMapping[userPreferences.videoLength] ||
        videoLengthMapping["Medium"];
      const depth =
        depthMapping[userPreferences.depth] || depthMapping["Balanced"];

      const prompt = `
        Generate 5 diverse and specific YouTube video titles for learning "${pointTitle}" in the context of "${topic}".
        
        Requirements:
        - Each title should be UNIQUE and cover DIFFERENT ASPECTS of "${pointTitle}"
        - Target ${videoLength.duration} videos (${videoLength.type})
        - Approach: ${depth.approach}
        - Focus: ${depth.focus}
        - Include variety: ${videoLength.keywords}
        
        Make titles that would attract videos with substantial content (minimum ${videoLength.duration}):
        
        Examples of good title patterns:
        - "Complete ${pointTitle} Tutorial for ${topic} - ${depth.complexity}"
        - "${pointTitle} in ${topic}: ${depth.focus}"
        - "Master ${pointTitle} for ${topic} Development - Full Course"
        - "${topic} ${pointTitle}: ${depth.approach} with Examples"
        - "Learn ${pointTitle} in ${topic} - ${videoLength.type}"
        
        Generate titles that are:
        1. Specific to "${pointTitle}" and "${topic}"
        2. Sound like real YouTube titles that would have ${videoLength.duration} content
        3. Use different approaches (tutorial, course, guide, masterclass, etc.)
        4. Include relevant keywords that indicate substantial content
        5. Are diverse enough to return different videos when searched
        
        Return exactly 5 titles in this JSON format:
        [
          "Title 1",
          "Title 2", 
          "Title 3",
          "Title 4",
          "Title 5"
        ]
        
        No additional text, just the JSON array.
      `;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text;

      // Extract JSON array from the response
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (!jsonMatch) {
        throw new Error("No valid JSON array found in response");
      }

      const videoTitles = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(videoTitles) || videoTitles.length === 0) {
        throw new Error("Invalid video titles array received");
      }

      return videoTitles;
    } catch (error) {
      console.error("Error generating video titles:", error);
      throw new Error(`Failed to generate video titles: ${error.message}`);
    }
  }
}

export default new GeminiService();

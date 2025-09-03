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
    userPreferences = { default_roadmap_depth: "detailed", default_video_length: "medium" }
  ) {
    try {
      // Map new user preferences structure to generation parameters
      const depthMapping = {
        basic: { points: 3, detail: "concise", approach: "Fast" },
        detailed: { points: 4, detail: "balanced", approach: "Balanced" },
        comprehensive: { points: 6, detail: "comprehensive", approach: "Detailed" },
      };

      const videoLengthMapping = {
        short: "Short",
        medium: "Medium", 
        long: "Long"
      };

      const currentDepth =
        depthMapping[userPreferences.default_roadmap_depth] || depthMapping["detailed"];
      const videoLength = 
        videoLengthMapping[userPreferences.default_video_length] || "Medium";

      const prompt = `
        Create a comprehensive learning roadmap for: "${topic}"
        
        User preferences:
        - Depth: ${currentDepth.approach} (${currentDepth.detail} approach with ${currentDepth.points} main points)
        - Video Length Preference: ${videoLength}
        
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
        } and appropriate for someone who prefers ${videoLength.toLowerCase()} learning sessions.
        
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

      // Clean up the response text and extract JSON
      console.log("🔍 Raw Gemini response:", responseText);
      
      // Try to find JSON between triple backticks or directly
      let jsonText = responseText;
      
      // Remove code block markers if present
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{.*\})\s*```/s);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }
      
      console.log("🔍 Extracted JSON text:", jsonText);
      
      if (!jsonText || jsonText.trim() === '') {
        throw new Error("No valid JSON found in response");
      }
      
      // Clean up common JSON issues
      jsonText = jsonText
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log("🔍 Cleaned JSON text:", jsonText);

      const roadmapData = JSON.parse(jsonText);

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
    userPreferences = { default_roadmap_depth: "detailed", default_video_length: "medium" }
  ) {
    try {
      const videoLengthMapping = {
        short: {
          duration: "8-15 minutes",
          type: "focused tutorials, quick guides, or essential concepts",
          keywords: "tutorial, guide, explained, basics, intro, quick",
        },
        medium: {
          duration: "15-30 minutes",
          type: "comprehensive tutorials with examples and practice",
          keywords:
            "complete guide, full tutorial, step by step, masterclass, course",
        },
        long: {
          duration: "30+ minutes",
          type: "in-depth courses, complete walkthroughs, or project-based learning",
          keywords:
            "complete course, full project, masterclass, bootcamp, comprehensive",
        },
      };

      const depthMapping = {
        basic: {
          approach: "quick overview with key points",
          complexity: "beginner-friendly with clear examples",
          focus: "essential concepts and practical application",
        },
        detailed: {
          approach: "thorough coverage with examples and practice",
          complexity: "intermediate level with real-world scenarios",
          focus: "balanced theory and hands-on practice",
        },
        comprehensive: {
          approach: "comprehensive deep-dive with advanced concepts",
          complexity:
            "detailed explanations with edge cases and best practices",
          focus: "complete understanding with advanced techniques",
        },
      };

      const videoLength =
        videoLengthMapping[userPreferences.default_video_length] ||
        videoLengthMapping["medium"];
      const depth =
        depthMapping[userPreferences.default_roadmap_depth] || depthMapping["detailed"];

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

  async generateQuiz(
    roadmapData,
    userPreferences = { default_roadmap_depth: "detailed", default_video_length: "medium" },
    usedQuestions = []
  ) {
    try {
      // Extract topic and roadmap structure
      const topic = roadmapData.extractedTopic || roadmapData.topic || "General Programming";
      const roadmap = roadmapData.roadmap || {};
      
      // Collect all learning points from all levels
      const allPoints = [];
      ['beginner', 'intermediate', 'advanced'].forEach(level => {
        if (roadmap[level]) {
          if (Array.isArray(roadmap[level])) {
            // Old format: array of strings
            roadmap[level].forEach((point, index) => {
              allPoints.push({
                title: typeof point === 'string' ? point : point.title || point.pointTitle,
                level: level,
                stepId: `step_${index + 1}`
              });
            });
          } else if (typeof roadmap[level] === 'object') {
            // New format: object with step keys
            Object.entries(roadmap[level]).forEach(([stepId, stepData]) => {
              allPoints.push({
                title: stepData.pointTitle || stepData.title || stepData,
                level: level,
                stepId: stepId
              });
            });
          }
        }
      });

      // Create used questions section for the prompt (limit to prevent overload)
      let usedQuestionsSection = '';
      if (usedQuestions && usedQuestions.length > 0) {
        // Limit to 5 most recent questions to avoid API overload
        const recentQuestions = usedQuestions.slice(-5);
        usedQuestionsSection = `
        
        IMPORTANT - GENERATE FRESH QUESTIONS:
        You have generated ${usedQuestions.length} questions before for this roadmap. 
        Most recent questions to avoid similar patterns:
        ${recentQuestions.map((q, index) => `${index + 1}. ${q.substring(0, 100)}...`).join('\n')}
        
        Generate completely NEW questions with different approaches, scenarios, and perspectives.
        `;
      }

      const prompt = `
        Generate 15 multiple choice questions for "${topic}" quiz.

        Topics to cover:
        ${allPoints.slice(0, 10).map(point => `- ${point.title}`).join('\n')}
        ${usedQuestionsSection}

        Requirements:
        - 5 beginner + 5 intermediate + 5 advanced questions
        - 4 options each (A,B,C,D) with explanations
        - Practical, scenario-based questions preferred
        ${usedQuestions.length > 0 ? '- Generate FRESH questions different from previous ones' : ''}

        JSON format:
        {
          "questions": [
            {
              "id": "q1",
              "question": "Question text here?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswer": 1,
              "explanation": "Why this answer is correct",
              "difficulty": "beginner"
            }
          ],
          "metadata": {
            "topic": "${topic}",
            "totalQuestions": 15,
            "difficultyDistribution": {"beginner": 5, "intermediate": 5, "advanced": 5}
          }
        }

        Return only the JSON object, no additional text or formatting.
      `;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text;

      // Clean up the response text and extract JSON
      console.log("🔍 Raw Gemini quiz response:", responseText);
      
      let jsonText = responseText;
      
      // Remove code block markers if present
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{.*\})\s*```/s);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }
      
      console.log("🔍 Extracted quiz JSON text:", jsonText);
      
      if (!jsonText || jsonText.trim() === '') {
        throw new Error("No valid JSON found in quiz response");
      }
      
      // Clean up common JSON issues
      jsonText = jsonText
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log("🔍 Cleaned quiz JSON text:", jsonText);

      const quizData = JSON.parse(jsonText);

      // Validate quiz structure
      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error("Invalid quiz structure: questions array missing");
      }

      if (quizData.questions.length !== 15) {
        console.warn(`Expected 15 questions, got ${quizData.questions.length}`);
      }

      // Validate each question
      quizData.questions.forEach((question, index) => {
        if (!question.question || !question.options || !Array.isArray(question.options)) {
          throw new Error(`Invalid question structure at index ${index}`);
        }
        if (question.options.length !== 4) {
          throw new Error(`Question ${index + 1} must have exactly 4 options`);
        }
        if (typeof question.correctAnswer !== 'number' || question.correctAnswer < 0 || question.correctAnswer > 3) {
          throw new Error(`Question ${index + 1} has invalid correctAnswer index`);
        }
      });

      // Add metadata if missing
      if (!quizData.metadata) {
        quizData.metadata = {
          topic: topic,
          totalQuestions: quizData.questions.length,
          difficultyDistribution: {
            beginner: quizData.questions.filter(q => q.difficulty === 'beginner').length,
            intermediate: quizData.questions.filter(q => q.difficulty === 'intermediate').length,
            advanced: quizData.questions.filter(q => q.difficulty === 'advanced').length
          },
          generatedAt: new Date().toISOString()
        };
      }

      console.log("✅ Generated quiz successfully:", {
        topic: quizData.metadata.topic,
        totalQuestions: quizData.questions.length,
        distribution: quizData.metadata.difficultyDistribution
      });

      return quizData;
    } catch (error) {
      console.error("Error generating quiz:", error);
      
      // If it's a 503 (service overloaded) and we had used questions, retry without them
      if (error.message.includes('503') && usedQuestions && usedQuestions.length > 0) {
        console.log("🔄 Retrying quiz generation without used questions due to service overload...");
        try {
          // Retry with empty used questions to reduce prompt size
          return await this.generateQuiz(roadmapData, userPreferences, []);
        } catch (retryError) {
          console.error("Retry also failed:", retryError);
          throw new Error(`Failed to generate quiz after retry: ${retryError.message}`);
        }
      }
      
      throw new Error(`Failed to generate quiz: ${error.message}`);
    }
  }
}

export default new GeminiService();

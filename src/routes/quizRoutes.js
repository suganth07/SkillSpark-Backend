import express from "express";
import neonDbService from "../services/neonDbService.js";
import {
  QuizSuccessResponse,
  ErrorResponse,
  ErrorDetails,
} from "../models/responseModels.js";
import {
  quizLimiter,
  quizProgressLimiter,
  validateQuizInput,
} from "../middleware/security.js";
import { appLogger } from "../utils/logger.js";

const router = express.Router();

// Generate or get quiz for a roadmap
router.post(
  "/generate/:roadmapId",
  quizLimiter,
  async (req, res) => {
    const startTime = Date.now();
    const { roadmapId } = req.params;
    const { userId } = req.body;

    console.log('🚀 DEBUG - Quiz generation request received:');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request body:', req.body);
    console.log('📋 Request body type:', typeof req.body);
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    console.log('📋 Request headers:', req.headers);
    console.log('📋 Content-Type:', req.get('content-type'));
    console.log('📋 RoadmapId:', roadmapId);
    console.log('📋 UserId:', userId);
    console.log('📋 UserId from body direct:', req.body.userId);
    console.log('📋 Raw body:', JSON.stringify(req.body));

    try {
      if (!roadmapId || !userId) {
        console.log('❌ Missing parameters - RoadmapId:', roadmapId, 'UserId:', userId);
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "MISSING_PARAMETERS",
            "Missing required parameters",
            "roadmapId and userId are required"
          )
        );
        return res.status(400).json(errorResponse);
      }

      appLogger.info("Generating quiz for roadmap", {
        roadmapId,
        userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // First, try direct roadmap lookup to debug
      console.log(`🔍 Looking for roadmap: ${roadmapId} for user: ${userId}`);
      
      // Get the roadmap data directly
      let roadmap;
      try {
        const directResult = await neonDbService.sql`
          SELECT 
            ur.id,
            ur.roadmap_data,
            ur.created_at,
            ur.updated_at,
            ut.user_id,
            ut.topic
          FROM user_roadmaps ur
          INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
          WHERE ur.id = ${roadmapId} AND ut.user_id = ${userId}
          LIMIT 1
        `;
        
        if (directResult.length > 0) {
          roadmap = directResult[0];
          console.log(`✅ Found roadmap directly: ${roadmap.topic}`);
        } else {
          console.log(`❌ No roadmap found with direct query`);
          
          // Try alternate lookup - maybe roadmap exists without topic relation
          const alternateResult = await neonDbService.sql`
            SELECT ur.*, 'Unknown Topic' as topic
            FROM user_roadmaps ur
            WHERE ur.id = ${roadmapId}
            LIMIT 1
          `;
          
          if (alternateResult.length > 0) {
            console.log(`⚠️ Found roadmap without topic relation`);
            roadmap = alternateResult[0];
          }
        }
      } catch (lookupError) {
        console.error(`❌ Error in direct roadmap lookup:`, lookupError);
      }

      if (!roadmap) {
        console.log(`🔍 Fallback: Trying getUserRoadmaps method...`);
        const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
        console.log(`📊 Found ${userRoadmaps.length} roadmaps via getUserRoadmaps`);
        roadmap = userRoadmaps.find(r => r.id === roadmapId);
      }

      if (!roadmap) {
        console.error(`❌ Roadmap not found: ${roadmapId} for user: ${userId}`);
        
        // Additional debugging information
        const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
        console.log(`📋 Debug info - User has ${userRoadmaps.length} total roadmaps`);
        if (userRoadmaps.length > 0) {
          console.log(`🗂️ Available roadmap IDs:`, userRoadmaps.map(r => r.id));
        }
        
        // Ensure user exists in database
        try {
          await neonDbService.ensureUserExists(userId);
          console.log(`✅ User exists in database`);
        } catch (userError) {
          console.error(`❌ User creation failed:`, userError.message);
        }
        
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "ROADMAP_NOT_FOUND",
            "Roadmap not found",
            userRoadmaps.length === 0 
              ? "No roadmaps found for this user. Please create a roadmap first."
              : `The specified roadmap does not exist. Available roadmaps: ${userRoadmaps.map(r => r.id).join(', ')}`
          )
        );
        return res.status(404).json(errorResponse);
      }

      console.log(`✅ Using roadmap: ${roadmap.id} (${roadmap.topic || 'No topic'})`);
      
      // Generate or get existing quiz
      const quiz = await neonDbService.generateOrGetQuiz(roadmapId, roadmap.roadmap_data || roadmap.roadmapData);

      const processingTime = Date.now() - startTime;

      appLogger.info("Quiz generated successfully", {
        roadmapId,
        userId,
        quizId: quiz.id,
        totalQuestions: quiz.total_questions,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      const response = new QuizSuccessResponse(quiz);
      res.json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error generating quiz", error, {
        roadmapId,
        userId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "QUIZ_GENERATION_FAILED",
          "Failed to generate quiz",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// Check if roadmap has quiz attempts (for enabling Results button)
router.get("/attempts/check/:roadmapId", async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { userId } = req.query;

    if (!roadmapId || !userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "MISSING_REQUIRED_FIELDS",
          "Roadmap ID and User ID are required",
          "Please provide both roadmapId and userId"
        )
      );
      return res.status(400).json(errorResponse);
    }

    const hasAttempts = await neonDbService.hasQuizAttempts(roadmapId, userId);
    
    appLogger.info('Quiz attempts check completed', { 
      roadmapId, 
      userId, 
      hasAttempts 
    });

    res.json(new QuizSuccessResponse({ hasAttempts }));
  } catch (error) {
    appLogger.error('Quiz attempts check failed', {
      error: error.message, 
      roadmapId: req.params.roadmapId, 
      userId: req.query.userId 
    });
    
    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "QUIZ_ATTEMPTS_CHECK_FAILED",
        "Failed to check quiz attempts",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get existing quiz for a roadmap
router.get("/:roadmapId", async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { userId } = req.query;

    if (!roadmapId || !userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "MISSING_PARAMETERS",
          "Missing required parameters",
          "roadmapId and userId are required"
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info("Getting quiz for roadmap", {
      roadmapId,
      userId,
      ip: req.ip,
    });

    // Verify roadmap belongs to user with better error handling
    console.log(`🔍 Looking for roadmap: ${roadmapId} for user: ${userId}`);
    
    let roadmap;
    try {
      // Try direct roadmap lookup first
      const directResult = await neonDbService.sql`
        SELECT 
          ur.id,
          ur.roadmap_data,
          ur.created_at,
          ur.updated_at,
          ut.user_id,
          ut.topic
        FROM user_roadmaps ur
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ur.id = ${roadmapId} AND ut.user_id = ${userId}
        LIMIT 1
      `;
      
      if (directResult.length > 0) {
        roadmap = directResult[0];
        console.log(`✅ Found roadmap directly: ${roadmap.topic}`);
      } else {
        console.log(`🔍 Fallback: Trying getUserRoadmaps method...`);
        const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
        console.log(`📊 Found ${userRoadmaps.length} roadmaps via getUserRoadmaps`);
        roadmap = userRoadmaps.find(r => r.id === roadmapId);
      }
    } catch (lookupError) {
      console.error(`❌ Error in roadmap lookup:`, lookupError);
    }

    if (!roadmap) {
      console.error(`❌ Roadmap not found: ${roadmapId} for user: ${userId}`);
      
      // Additional debugging information
      const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
      console.log(`📋 Debug info - User has ${userRoadmaps.length} total roadmaps`);
      if (userRoadmaps.length > 0) {
        console.log(`🗂️ Available roadmap IDs:`, userRoadmaps.map(r => r.id));
      }
      
      // Ensure user exists in database
      try {
        await neonDbService.ensureUserExists(userId);
        console.log(`✅ User exists in database`);
      } catch (userError) {
        console.error(`❌ User creation failed:`, userError.message);
      }
      
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "ROADMAP_NOT_FOUND",
          "Roadmap not found",
          userRoadmaps.length === 0 
            ? "No roadmaps found for this user. Please create a roadmap first."
            : `The specified roadmap does not exist. Available roadmaps: ${userRoadmaps.map(r => r.id).join(', ')}`
        )
      );
      return res.status(404).json(errorResponse);
    }

    const quiz = await neonDbService.getUserQuiz(roadmapId);

    if (!quiz) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "QUIZ_NOT_FOUND",
          "Quiz not found",
          "No quiz exists for this roadmap. Generate one first."
        )
      );
      return res.status(404).json(errorResponse);
    }

    appLogger.info("Quiz retrieved successfully", {
      roadmapId,
      userId,
      quizId: quiz.id,
      ip: req.ip,
    });

    const response = new QuizSuccessResponse(quiz);
    res.json(response);
  } catch (error) {
    appLogger.error("Error getting quiz", error, {
      roadmapId: req.params.roadmapId,
      userId: req.query.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "QUIZ_RETRIEVAL_FAILED",
        "Failed to retrieve quiz",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Submit quiz attempt
router.post(
  "/:quizId/attempt",
  quizLimiter,
  validateQuizInput,
  async (req, res) => {
    const startTime = Date.now();
    const { quizId } = req.params;
    const { userId, answers, timeInSeconds } = req.body;

    console.log('🚀 DEBUG - Quiz attempt submission request received:');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request body:', req.body);
    console.log('📋 Request body type:', typeof req.body);
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    console.log('📋 Request headers:', req.headers);
    console.log('📋 Content-Type:', req.get('content-type'));
    console.log('📋 QuizId:', quizId);
    console.log('📋 UserId:', userId);
    console.log('📋 Answers:', answers);
    console.log('📋 Answers type:', typeof answers);
    console.log('📋 Answers isArray:', Array.isArray(answers));
    console.log('📋 TimeInSeconds:', timeInSeconds);
    console.log('📋 Raw body:', JSON.stringify(req.body));

    try {
      if (!quizId || !userId || !answers || !Array.isArray(answers)) {
        console.log('❌ Missing parameters:');
        console.log('  - QuizId:', !!quizId);
        console.log('  - UserId:', !!userId);
        console.log('  - Answers:', !!answers);
        console.log('  - Answers isArray:', Array.isArray(answers));
        
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "MISSING_PARAMETERS",
            "Missing required parameters",
            "quizId, userId, and answers array are required"
          )
        );
        return res.status(400).json(errorResponse);
      }

      appLogger.info("Submitting quiz attempt", {
        quizId,
        userId,
        answersCount: answers.length,
        timeInSeconds,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Get the quiz to validate answers
      const quiz = await neonDbService.sql`
        SELECT uq.*, ur.id as roadmap_id
        FROM user_quizzes uq
        INNER JOIN user_roadmaps ur ON uq.user_roadmap_id = ur.id
        INNER JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE uq.id = ${quizId} AND ut.user_id = ${userId}
      `;

      if (quiz.length === 0) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "QUIZ_NOT_FOUND",
            "Quiz not found",
            "The specified quiz does not exist or doesn't belong to the user"
          )
        );
        return res.status(404).json(errorResponse);
      }

      const quizData = typeof quiz[0].quiz_data === 'string' 
        ? JSON.parse(quiz[0].quiz_data) 
        : quiz[0].quiz_data;

      // Calculate score
      let score = 0;
      const userAnswers = {
        answers: [],
        metadata: {
          startedAt: new Date(Date.now() - (timeInSeconds * 1000 || 0)).toISOString(),
          completedAt: new Date().toISOString(),
          totalTimeSpent: timeInSeconds || 0
        }
      };

      answers.forEach((answer, index) => {
        const question = quizData.questions[index];
        const isCorrect = question && question.correctAnswer === answer.selectedOption;
        
        if (isCorrect) score++;

        userAnswers.answers.push({
          questionId: question?.id || `q${index + 1}`,
          selectedOption: answer.selectedOption,
          isCorrect: isCorrect,
          timeSpent: answer.timeSpent || 0
        });
      });

      const totalQuestions = quizData.questions.length;
      const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

      // Save the attempt
      const attempt = await neonDbService.submitQuizAttempt(
        quizId,
        userId,
        userAnswers,
        score,
        totalQuestions,
        percentage,
        timeInSeconds
      );

      // Clear quiz progress since quiz is completed successfully
      try {
        await neonDbService.clearQuizProgress(quizId, userId);
        appLogger.info('Quiz progress cleared after successful submission', { quizId, userId });
      } catch (clearError) {
        appLogger.warn('Failed to clear quiz progress after submission', { 
          quizId, 
          userId, 
          error: clearError.message 
        });
        // Don't fail the request if we can't clear progress
      }

      const processingTime = Date.now() - startTime;

      appLogger.info("Quiz attempt submitted successfully", {
        quizId,
        userId,
        score,
        totalQuestions,
        percentage,
        timeInSeconds,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      // Return result with quiz data for review
      const response = {
        success: true,
        data: {
          attempt: attempt,
          results: {
            score: score,
            totalQuestions: totalQuestions,
            percentage: percentage,
            timeInSeconds: timeInSeconds,
            passed: percentage >= 70 // 70% passing grade
          },
          quiz: quizData, // Include quiz data for answer review
          userAnswers: userAnswers.answers
        }
      };

      res.json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error submitting quiz attempt", error, {
        quizId,
        userId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "QUIZ_SUBMISSION_FAILED",
          "Failed to submit quiz attempt",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// Get user's quiz attempts
router.get("/attempts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { roadmapId } = req.query;

    if (!userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "MISSING_PARAMETERS",
          "Missing required parameters",
          "userId is required"
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info("Getting user quiz attempts", {
      userId,
      roadmapId,
      ip: req.ip,
    });

    let attempts;
    if (roadmapId) {
      attempts = await neonDbService.getQuizAttemptsForRoadmap(userId, roadmapId);
    } else {
      attempts = await neonDbService.getUserQuizAttempts(userId);
    }

    appLogger.info("Quiz attempts retrieved successfully", {
      userId,
      roadmapId,
      attemptsCount: attempts.length,
      ip: req.ip,
    });

    const response = {
      success: true,
      data: attempts
    };

    res.json(response);
  } catch (error) {
    appLogger.error("Error getting quiz attempts", error, {
      userId: req.params.userId,
      roadmapId: req.query.roadmapId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "ATTEMPTS_RETRIEVAL_FAILED",
        "Failed to retrieve quiz attempts",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get quiz results for a specific roadmap (with all attempts)
router.get("/results/:roadmapId", async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { userId } = req.query;

    if (!roadmapId || !userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "MISSING_PARAMETERS",
          "Missing required parameters",
          "roadmapId and userId are required"
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info("Getting quiz results for roadmap", {
      roadmapId,
      userId,
      ip: req.ip,
    });

    // Verify roadmap belongs to user
    const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
    const roadmap = userRoadmaps.find(r => r.id === roadmapId);

    if (!roadmap) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "ROADMAP_NOT_FOUND",
          "Roadmap not found",
          "The specified roadmap does not exist or doesn't belong to the user"
        )
      );
      return res.status(404).json(errorResponse);
    }

    // Get quiz for this roadmap
    const quiz = await neonDbService.getUserQuiz(roadmapId);
    if (!quiz) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "QUIZ_NOT_FOUND",
          "No quiz found",
          "No quiz has been generated for this roadmap yet"
        )
      );
      return res.status(404).json(errorResponse);
    }

    // Get all attempts for this roadmap
    const attempts = await neonDbService.getQuizAttemptsForRoadmap(userId, roadmapId);

    // Get quiz statistics
    const statistics = await neonDbService.getQuizStatistics(roadmapId);

    appLogger.info("Quiz results retrieved successfully", {
      roadmapId,
      userId,
      attemptsCount: attempts.length,
      ip: req.ip,
    });

    const response = {
      success: true,
      data: {
        roadmap: {
          id: roadmap.id,
          topic: roadmap.topic,
          roadmapData: roadmap.roadmapData
        },
        quiz: quiz,
        attempts: attempts,
        statistics: statistics
      }
    };

    res.json(response);
  } catch (error) {
    appLogger.error("Error getting quiz results", error, {
      roadmapId: req.params.roadmapId,
      userId: req.query.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "RESULTS_RETRIEVAL_FAILED",
        "Failed to retrieve quiz results",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get quiz statistics
router.get("/stats/:roadmapId", async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { userId } = req.query;

    if (!roadmapId || !userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "MISSING_PARAMETERS",
          "Missing required parameters",
          "roadmapId and userId are required"
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info("Getting quiz statistics", {
      roadmapId,
      userId,
      ip: req.ip,
    });

    // Verify roadmap belongs to user
    const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
    const roadmap = userRoadmaps.find(r => r.id === roadmapId);

    if (!roadmap) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "ROADMAP_NOT_FOUND",
          "Roadmap not found",
          "The specified roadmap does not exist or doesn't belong to the user"
        )
      );
      return res.status(404).json(errorResponse);
    }

    const statistics = await neonDbService.getQuizStatistics(roadmapId);

    appLogger.info("Quiz statistics retrieved successfully", {
      roadmapId,
      userId,
      totalAttempts: statistics.totalAttempts,
      ip: req.ip,
    });

    const response = {
      success: true,
      data: statistics
    };

    res.json(response);
  } catch (error) {
    appLogger.error("Error getting quiz statistics", error, {
      roadmapId: req.params.roadmapId,
      userId: req.query.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "STATISTICS_RETRIEVAL_FAILED",
        "Failed to retrieve quiz statistics",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Regenerate quiz
router.post(
  "/regenerate/:roadmapId",
  quizLimiter,
  validateQuizInput,
  async (req, res) => {
    const startTime = Date.now();
    const { roadmapId } = req.params;
    const { userId } = req.body;

    try {
      if (!roadmapId || !userId) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "MISSING_PARAMETERS",
            "Missing required parameters",
            "roadmapId and userId are required"
          )
        );
        return res.status(400).json(errorResponse);
      }

      appLogger.info("Regenerating quiz for roadmap", {
        roadmapId,
        userId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Get the roadmap data
      const userRoadmaps = await neonDbService.getUserRoadmaps(userId);
      const roadmap = userRoadmaps.find(r => r.id === roadmapId);

      if (!roadmap) {
        const errorResponse = new ErrorResponse(
          new ErrorDetails(
            "ROADMAP_NOT_FOUND",
            "Roadmap not found",
            "The specified roadmap does not exist or doesn't belong to the user"
          )
        );
        return res.status(404).json(errorResponse);
      }

      // Generate new quiz using Gemini AI
      const geminiService = await import('../services/geminiService.js');
      const quizData = await geminiService.default.generateQuiz(roadmap.roadmapData);

      // Update existing quiz or create new one
      let quiz;
      try {
        quiz = await neonDbService.updateUserQuiz(
          roadmapId,
          quizData,
          quizData.questions.length,
          'mixed'
        );
      } catch (updateError) {
        // If no quiz exists to update, create a new one
        quiz = await neonDbService.createUserQuiz(
          roadmapId,
          quizData,
          quizData.questions.length,
          'mixed'
        );
      }

      const processingTime = Date.now() - startTime;

      appLogger.info("Quiz regenerated successfully", {
        roadmapId,
        userId,
        quizId: quiz.id,
        totalQuestions: quiz.total_questions,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
      });

      const response = new QuizSuccessResponse(quiz);
      res.json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      appLogger.error("Error regenerating quiz", error, {
        roadmapId,
        userId,
        processingTime: `${processingTime}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "QUIZ_REGENERATION_FAILED",
          "Failed to regenerate quiz",
          process.env.NODE_ENV === "production"
            ? "Please try again later"
            : error.message
        )
      );

      res.status(500).json(errorResponse);
    }
  }
);

// Route 7: Save quiz progress (individual answers)
router.post('/:quizId/progress', quizProgressLimiter, validateQuizInput, async (req, res) => {
  const startTime = Date.now();
  const { quizId } = req.params;
  const { userId, questionIndex, selectedOption, timeSpent } = req.body;
  
  console.log('🚀 DEBUG - Quiz progress save request:');
  console.log('📋 Request params:', req.params);
  console.log('📋 Request body:', req.body);
  console.log('📋 Request body keys:', Object.keys(req.body || {}));
  console.log('📋 Content-Type:', req.get('content-type'));
  console.log('📋 Raw extracted values:', { quizId, userId, questionIndex, selectedOption, timeSpent });
  
  try {
    appLogger.info('Saving quiz progress', { 
      quizId, 
      userId, 
      questionIndex, 
      selectedOption,
      ip: req.ip 
    });

    // Validate input
    if (!userId || questionIndex === undefined || selectedOption === undefined || timeSpent === undefined) {
      return res.status(400).json(
        new ErrorResponse('Missing required fields: userId, questionIndex, selectedOption, timeSpent')
      );
    }

    // Validate ranges
    if (questionIndex < 0 || questionIndex > 14) {
      return res.status(400).json(
        new ErrorResponse('Question index must be between 0 and 14')
      );
    }

    if (selectedOption < 0 || selectedOption > 3) {
      return res.status(400).json(
        new ErrorResponse('Selected option must be between 0 and 3')
      );
    }

    if (timeSpent < 0) {
      return res.status(400).json(
        new ErrorResponse('Time spent must be non-negative')
      );
    }

    // Save progress
    const progress = await neonDbService.saveQuizProgress(
      quizId, 
      userId, 
      questionIndex, 
      selectedOption, 
      timeSpent
    );

    const duration = Date.now() - startTime;
    appLogger.info('Quiz progress saved successfully', { 
      quizId, 
      questionIndex, 
      duration: `${duration}ms` 
    });

    res.json(new QuizSuccessResponse(progress));
  } catch (error) {
    const duration = Date.now() - startTime;
    appLogger.error('Quiz progress save failed', { 
      error: error.message, 
      quizId, 
      userId,
      duration: `${duration}ms` 
    });
    
    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "QUIZ_PROGRESS_SAVE_FAILED",
        "Failed to save quiz progress",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Route 8: Get quiz progress
router.get('/:quizId/progress', quizProgressLimiter, async (req, res) => {
  const startTime = Date.now();
  const { quizId } = req.params;
  const { userId } = req.query;
  
  console.log('🚀 DEBUG - Quiz progress retrieval request:');
  console.log('📋 Request params:', req.params);
  console.log('📋 Request query:', req.query);
  console.log('📋 Request query keys:', Object.keys(req.query || {}));
  console.log('📋 Raw extracted values:', { quizId, userId });
  
  try {
    appLogger.info('Retrieving quiz progress', { quizId, userId, ip: req.ip });

    if (!userId) {
      return res.status(400).json(
        new ErrorResponse('Missing required parameter: userId')
      );
    }

    // Get progress
    const progress = await neonDbService.getQuizProgress(quizId, userId);

    const duration = Date.now() - startTime;
    appLogger.info('Quiz progress retrieved successfully', { 
      quizId, 
      progressCount: progress.length,
      duration: `${duration}ms` 
    });

    res.json(new QuizSuccessResponse(progress));
  } catch (error) {
    const duration = Date.now() - startTime;
    appLogger.error('Quiz progress retrieval failed', {
      error: error.message, 
      quizId, 
      userId,
      duration: `${duration}ms` 
    });
    
    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "QUIZ_PROGRESS_FETCH_FAILED",
        "Failed to retrieve quiz progress",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Regenerate quiz for a roadmap (delete existing and create new)
router.post("/regenerate/:roadmapId", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { roadmapId } = req.params;
    const { userId } = req.body;

    if (!roadmapId || !userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "MISSING_REQUIRED_FIELDS",
          "Roadmap ID and User ID are required",
          "Please provide both roadmapId and userId"
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info('Starting quiz regeneration', { roadmapId, userId });

    // First, check if roadmap exists
    const roadmap = await neonDbService.getUserRoadmap(roadmapId, userId);
    if (!roadmap) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "ROADMAP_NOT_FOUND",
          "Roadmap not found",
          "The specified roadmap does not exist"
        )
      );
      return res.status(404).json(errorResponse);
    }

    // Delete existing quiz and attempts for this roadmap
    await neonDbService.deleteQuizByRoadmap(roadmapId);
    appLogger.info('Existing quiz deleted for regeneration', { roadmapId });

    // Generate new quiz using the roadmap data
    const roadmapData = roadmap.roadmap_data;
    const topic = roadmap.topic;

    appLogger.info('Generating new quiz via Gemini service', { 
      roadmapId,
      topic,
      roadmapStructure: roadmapData ? Object.keys(roadmapData).length : 0
    });

    const quizData = await geminiService.generateQuiz(roadmapData, topic);
    
    if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          "INVALID_QUIZ_DATA",
          "Generated quiz data is invalid",
          "The AI service returned invalid quiz structure"
        )
      );
      return res.status(500).json(errorResponse);
    }

    // Save the new quiz
    const newQuiz = await neonDbService.saveQuiz({
      roadmapId,
      userId,
      quizData,
      topic
    });

    const processingTime = Date.now() - startTime;
    
    appLogger.info('Quiz regenerated successfully', {
      roadmapId,
      userId,
      newQuizId: newQuiz.id,
      questionsCount: quizData.questions.length,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json(new QuizSuccessResponse(newQuiz));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    appLogger.error('Quiz regeneration failed', {
      error: error.message,
      stack: error.stack,
      roadmapId: req.params.roadmapId,
      userId: req.body.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        "QUIZ_REGENERATION_FAILED",
        "Failed to regenerate quiz",
        process.env.NODE_ENV === "production"
          ? "Please try again later"
          : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

export default router;

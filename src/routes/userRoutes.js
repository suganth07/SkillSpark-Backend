import express from 'express';
import { body, validationResult } from 'express-validator';
import supabaseService from '../services/supabaseService.js';
import { SuccessResponse, ErrorResponse, ErrorDetails } from '../models/responseModels.js';
import { appLogger } from '../utils/logger.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: new ErrorDetails(
      'RATE_LIMIT_EXCEEDED',
      'Too many authentication attempts',
      'Please try again later'
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation middleware
const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const validateLogin = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'VALIDATION_ERROR',
        'Invalid input data',
        errors.array().map(error => error.msg).join(', ')
      )
    );
    return res.status(400).json(errorResponse);
  }
  next();
};

// Register endpoint
router.post('/register', authLimiter, validateRegister, handleValidationErrors, async (req, res) => {
  const startTime = Date.now();

  try {
    const { username, password } = req.body;

    appLogger.info('User registration attempt', {
      username,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Check if user already exists
    const userExists = await supabaseService.checkUserExists(username);
    if (userExists) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          'USER_EXISTS',
          'Username already exists',
          'Please choose a different username'
        )
      );
      return res.status(409).json(errorResponse);
    }

    // Create new user
    const user = await supabaseService.createUser(username, password);

    const processingTime = Date.now() - startTime;

    appLogger.info('User registered successfully', {
      userId: user.id,
      username: user.username,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      id: user.id,
      username: user.username,
      message: 'User registered successfully',
    });

    res.status(201).json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('User registration failed', error, {
      username: req.body?.username,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'REGISTRATION_FAILED',
        'Failed to register user',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Login endpoint
router.post('/login', authLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  const startTime = Date.now();

  try {
    const { username, password } = req.body;

    appLogger.info('User login attempt', {
      username,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Authenticate user
    const user = await supabaseService.getUserByCredentials(username, password);
    if (!user) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          'INVALID_CREDENTIALS',
          'Invalid username or password',
          'Please check your credentials and try again'
        )
      );
      return res.status(401).json(errorResponse);
    }

    const processingTime = Date.now() - startTime;

    appLogger.info('User login successful', {
      userId: user.id,
      username: user.username,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      id: user.id,
      username: user.username,
      message: 'Login successful',
    });

    res.json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('User login failed', error, {
      username: req.body?.username,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'LOGIN_FAILED',
        'Failed to login',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Create user topic endpoint
router.post('/topics', async (req, res) => {
  try {
    const { userId, topic } = req.body;

    appLogger.info('Creating user topic', {
      userId,
      topic,
      ip: req.ip,
    });

    const topicData = await supabaseService.createUserTopic(userId, topic);

    const successResponse = new SuccessResponse(topicData);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to create user topic', error, {
      userId: req.body?.userId,
      topic: req.body?.topic,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'CREATE_TOPIC_FAILED',
        'Failed to create user topic',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get user topics endpoint
router.get('/topics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    appLogger.info('Fetching user topics', {
      userId,
      ip: req.ip,
    });

    const topics = await supabaseService.getUserTopics(userId);

    const successResponse = new SuccessResponse(topics);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to fetch user topics', error, {
      userId: req.params?.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'FETCH_TOPICS_FAILED',
        'Failed to fetch user topics',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Create user roadmap endpoint
router.post('/roadmaps', async (req, res) => {
  try {
    const { userId, topic, roadmapData } = req.body;

    appLogger.info('Creating user roadmap', {
      userId,
      topic,
      ip: req.ip,
    });

    // First, get or create the user topic
    let userTopic = await supabaseService.getUserTopicByName(userId, topic);
    if (!userTopic) {
      userTopic = await supabaseService.createUserTopic(userId, topic);
    }

    // Then create the roadmap with the topic ID
    const roadmap = await supabaseService.createUserRoadmap(userTopic.id, roadmapData);

    const successResponse = new SuccessResponse(roadmap);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to create user roadmap', error, {
      userId: req.body?.userId,
      topic: req.body?.topic,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'CREATE_ROADMAP_FAILED',
        'Failed to create user roadmap',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get user roadmaps endpoint
router.get('/roadmaps/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    appLogger.info('Fetching user roadmaps', {
      userId,
      ip: req.ip,
    });

    const roadmaps = await supabaseService.getUserRoadmaps(userId);

    const successResponse = new SuccessResponse(roadmaps);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to fetch user roadmaps', error, {
      userId: req.params?.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'FETCH_ROADMAPS_FAILED',
        'Failed to fetch user roadmaps',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

export default router;

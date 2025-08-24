import express from 'express';
import { body, validationResult } from 'express-validator';
import neonDbService from '../services/neonDbService.js';
import { SuccessResponse, ErrorResponse, ErrorDetails } from '../models/responseModels.js';
import { appLogger } from '../utils/logger.js';
import { userDataLimiter } from '../middleware/security.js';

const router = express.Router();

// Rate limiter for auth endpoints
const authLimiter = userDataLimiter;

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
    const userExists = await neonDbService.checkUserExists(username);
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
    const user = await neonDbService.createUser(username, password);

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
    const user = await neonDbService.getUserByCredentials(username, password);
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

    const topicData = await neonDbService.createUserTopic(userId, topic);

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

    const topics = await neonDbService.getUserTopics(userId);

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

// Create or update user roadmap endpoint
router.post('/roadmaps', async (req, res) => {
  try {
    const { userId, topic, roadmapData } = req.body;

    appLogger.info('Creating/updating user roadmap', {
      userId,
      topic,
      roadmapId: roadmapData?.id,
      ip: req.ip,
    });

    // Ensure user exists in database before creating topics
    await neonDbService.ensureUserExists(userId);

    // First, get or create the user topic
    let userTopic = await neonDbService.getUserTopicByName(userId, topic);
    if (!userTopic) {
      console.log(`📝 Creating new topic '${topic}' for user ${userId}`);
      userTopic = await neonDbService.createUserTopic(userId, topic);
    } else {
      console.log(`📋 Found existing topic '${topic}' for user ${userId}`);
    }

    // Check if roadmap already exists for this user and topic
    const existingRoadmaps = await neonDbService.getUserRoadmaps(userId);
    console.log(`🔍 User ${userId} has ${existingRoadmaps.length} existing roadmaps`);
    
    // Check for exact roadmap ID match first (for updates)
    let existingRoadmap = existingRoadmaps.find(rm => rm.id === roadmapData.id);
    
    // If no exact ID match, check for same topic (to prevent duplicates)
    if (!existingRoadmap) {
      existingRoadmap = existingRoadmaps.find(rm => rm.topic === topic);
    }

    let roadmap;
    if (existingRoadmap) {
      // Update existing roadmap
      console.log(`🔄 Updating existing roadmap ${existingRoadmap.id} for user ${userId}`);
      roadmap = await neonDbService.updateUserRoadmap(existingRoadmap.id, roadmapData);
      appLogger.info('Updated existing roadmap', {
        userId,
        roadmapId: existingRoadmap.id,
        topic,
        ip: req.ip,
      });
    } else {
      // Create new roadmap
      console.log(`➕ Creating new roadmap for topic '${topic}' for user ${userId}`);
      roadmap = await neonDbService.createUserRoadmap(userTopic.id, roadmapData);
      appLogger.info('Created new roadmap', {
        userId,
        roadmapId: roadmap.id,
        topic,
        ip: req.ip,
      });
    }

    const successResponse = new SuccessResponse(roadmap);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to create/update user roadmap', error, {
      userId: req.body?.userId,
      topic: req.body?.topic,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'ROADMAP_OPERATION_FAILED',
        'Failed to save user roadmap',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get user roadmaps endpoint
router.get('/roadmaps/:userId', userDataLimiter, async (req, res) => {
  try {
    const { userId } = req.params;

    appLogger.info('Fetching user roadmaps', {
      userId,
      ip: req.ip,
    });

    console.log('🔍 Fetching roadmaps for user ID:', userId);

    const roadmaps = await neonDbService.getUserRoadmaps(userId);

    console.log('📊 Found roadmaps for user:', roadmaps.length);
    console.log('📋 Roadmap details:', roadmaps.map(rm => ({ 
      id: rm.id, 
      topic: rm.topic, 
      userId: rm.userId 
    })));

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

// Update user roadmap endpoint
router.put('/roadmaps/:roadmapId', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { roadmapData } = req.body;

    appLogger.info('Updating user roadmap', {
      roadmapId,
      ip: req.ip,
    });

    const updatedRoadmap = await neonDbService.updateUserRoadmap(roadmapId, roadmapData);

    const successResponse = new SuccessResponse(updatedRoadmap);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to update user roadmap', error, {
      roadmapId: req.params?.roadmapId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'UPDATE_ROADMAP_FAILED',
        'Failed to update user roadmap',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Mark roadmap point as complete/incomplete
router.post('/roadmaps/:roadmapId/progress/:pointId', async (req, res) => {
  try {
    const { roadmapId, pointId } = req.params;
    const { userId, isCompleted } = req.body;

    if (!userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          'MISSING_USER_ID',
          'User ID is required',
          'Please provide a valid user ID'
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info('Updating roadmap point progress', {
      roadmapId,
      pointId,
      userId,
      isCompleted,
      ip: req.ip,
    });

    const progressRecord = await neonDbService.markRoadmapPointComplete(
      userId, 
      roadmapId, 
      pointId, 
      isCompleted
    );

    const successResponse = new SuccessResponse({
      message: `Roadmap point ${isCompleted ? 'completed' : 'marked as incomplete'}`,
      progress: progressRecord
    });

    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to update roadmap point progress', error, {
      roadmapId: req.params?.roadmapId,
      pointId: req.params?.pointId,
      userId: req.body?.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'UPDATE_PROGRESS_FAILED',
        'Failed to update roadmap point progress',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get roadmap progress for a specific roadmap
router.get('/roadmaps/:roadmapId/progress', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          'MISSING_USER_ID',
          'User ID is required',
          'Please provide a valid user ID in query parameters'
        )
      );
      return res.status(400).json(errorResponse);
    }

    appLogger.info('Fetching roadmap progress', {
      roadmapId,
      userId,
      ip: req.ip,
    });

    const progress = await neonDbService.getRoadmapProgress(userId, roadmapId);

    const successResponse = new SuccessResponse(progress);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to fetch roadmap progress', error, {
      roadmapId: req.params?.roadmapId,
      userId: req.query?.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'FETCH_PROGRESS_FAILED',
        'Failed to fetch roadmap progress',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get all roadmap progress for a user
router.get('/progress/:userId', userDataLimiter, async (req, res) => {
  try {
    const { userId } = req.params;

    appLogger.info('Fetching all user roadmap progress', {
      userId,
      ip: req.ip,
    });

    const allProgress = await neonDbService.getAllUserRoadmapProgress(userId);

    const successResponse = new SuccessResponse(allProgress);
    res.json(successResponse);
  } catch (error) {
    appLogger.error('Failed to fetch all user roadmap progress', error, {
      userId: req.params?.userId,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'FETCH_ALL_PROGRESS_FAILED',
        'Failed to fetch user progress',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Get user videos for a specific roadmap and level
router.get('/videos/:roadmapId', userDataLimiter, async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { level, userId, page = 1 } = req.query;

    if (!roadmapId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Roadmap ID and User ID are required' 
      });
    }

    appLogger.info('Getting user videos', {
      roadmapId,
      level: level || 'all',
      userId,
      page: parseInt(page),
      ip: req.ip,
    });

    // Verify that the roadmap belongs to the user
    const roadmaps = await neonDbService.getUserRoadmaps(userId);
    const roadmap = roadmaps.find(rm => rm.id === roadmapId);
    
    if (!roadmap) {
      return res.status(404).json({ 
        success: false, 
        error: 'Roadmap not found or does not belong to user' 
      });
    }

    const videos = await neonDbService.getUserVideos(roadmapId, level, parseInt(page));
    
    console.log(`✅ Found ${videos.length} video records for roadmap: ${roadmapId}, page: ${page}`);

    // Check if there are more pages by trying to fetch the next page
    let hasMore = false;
    try {
      const nextPageVideos = await neonDbService.getUserVideos(roadmapId, level, parseInt(page) + 1);
      hasMore = nextPageVideos.length > 0;
    } catch (error) {
      // If error fetching next page, assume no more pages
      hasMore = false;
    }

    const successResponse = new SuccessResponse({
      videos: videos.length > 0 ? videos[0].video_data : [],
      page: parseInt(page),
      hasMore: hasMore
    });

    res.json(successResponse);

  } catch (error) {
    appLogger.error('Failed to get user videos', error, {
      roadmapId: req.params?.roadmapId,
      level: req.query?.level,
      userId: req.query?.userId,
      page: req.query?.page,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'GET_VIDEOS_FAILED',
        'Failed to get user videos',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Test endpoint to check video storage functionality
router.get('/test-videos/:roadmapId', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    
    // Test storing some sample videos
    const sampleVideos = [
      {
        id: 'test1',
        title: 'Test Video 1',
        videoUrl: 'https://youtube.com/watch?v=test1',
        duration: '10:30',
        description: 'Test video description'
      }
    ];

    console.log(`🧪 Testing video storage for roadmap: ${roadmapId}`);
    
    const stored = await neonDbService.storeUserVideos(roadmapId, 'beginner', sampleVideos);
    const retrieved = await neonDbService.getUserVideos(roadmapId, 'beginner');
    
    res.json({
      success: true,
      message: 'Video storage test completed',
      stored: stored,
      retrieved: retrieved
    });

  } catch (error) {
    console.error('❌ Video storage test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete roadmap endpoint
router.delete('/roadmaps/:roadmapId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { roadmapId } = req.params;
    const { userId } = req.query;

    appLogger.info('Deleting roadmap', {
      roadmapId,
      userId,
      ip: req.ip
    });

    if (!userId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails('MISSING_USER_ID', 'User ID is required', 'userId query parameter is missing')
      );
      return res.status(400).json(errorResponse);
    }

    if (!roadmapId) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails('MISSING_ROADMAP_ID', 'Roadmap ID is required', 'roadmapId parameter is missing')
      );
      return res.status(400).json(errorResponse);
    }

    // Delete the roadmap
    await neonDbService.deleteUserRoadmap(roadmapId, userId);
    
    const successResponse = new SuccessResponse({
      message: 'Roadmap deleted successfully',
      roadmapId: roadmapId
    });
    
    const endTime = Date.now();
    res.set('Server-Timing', `db;dur=${endTime - startTime}`);
    res.json(successResponse);

  } catch (error) {
    console.error('Error deleting roadmap:', error);
    appLogger.error('Error deleting roadmap', {
      error: error.message,
      roadmapId: req.params.roadmapId,
      userId: req.query.userId,
      ip: req.ip
    });

    if (error.message.includes('not found') || error.message.includes('not owned')) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails('ROADMAP_NOT_FOUND', 'Roadmap not found or access denied', error.message)
      );
      return res.status(404).json(errorResponse);
    }

    const errorResponse = new ErrorResponse(
      new ErrorDetails('DELETE_ROADMAP_FAILED', 'Failed to delete roadmap', error.message)
    );
    res.status(500).json(errorResponse);
  }
});

// User Settings Endpoints

// Get user settings
router.get('/settings/:userId', userDataLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;

    appLogger.info('Fetching user settings', {
      userId,
      ip: req.ip,
    });

    const settings = await neonDbService.getUserSettings(userId);
    
    // If no settings found, return default settings structure
    const defaultSettings = {
      user_id: userId,
      full_name: null,
      about_description: null,
      theme: 'light',
      default_roadmap_depth: 'detailed',
      default_video_length: 'medium'
    };

    const processingTime = Date.now() - startTime;

    appLogger.info('User settings fetched successfully', {
      userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse(settings || defaultSettings);
    res.json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('Failed to fetch user settings', error, {
      userId: req.params?.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'FETCH_SETTINGS_FAILED',
        'Failed to fetch user settings',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Update user settings
router.put('/settings/:userId', userDataLimiter, [
  body('full_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must be less than 100 characters'),
  body('about_description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('About description must be less than 1000 characters'),
  body('theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Theme must be "light" or "dark"'),
  body('default_roadmap_depth')
    .optional()
    .isIn(['basic', 'detailed', 'comprehensive'])
    .withMessage('Default roadmap depth must be "basic", "detailed", or "comprehensive"'),
  body('default_video_length')
    .optional()
    .isIn(['short', 'medium', 'long'])
    .withMessage('Default video length must be "short", "medium", or "long"'),
], handleValidationErrors, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const settings = req.body;

    appLogger.info('Updating user settings', {
      userId,
      settingsFields: Object.keys(settings),
      ip: req.ip,
    });

    // Check if settings exist, if not create them first
    const existingSettings = await neonDbService.getUserSettings(userId);
    
    let updatedSettings;
    if (!existingSettings) {
      // Create new settings
      updatedSettings = await neonDbService.createUserSettings(userId, settings);
    } else {
      // Update existing settings
      updatedSettings = await neonDbService.updateUserSettings(userId, settings);
    }

    const processingTime = Date.now() - startTime;

    appLogger.info('User settings updated successfully', {
      userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      message: 'Settings updated successfully',
      settings: updatedSettings
    });

    res.json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('Failed to update user settings', error, {
      userId: req.params?.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'UPDATE_SETTINGS_FAILED',
        'Failed to update user settings',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Create user settings (for initialization)
router.post('/settings/:userId', userDataLimiter, [
  body('full_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must be less than 100 characters'),
  body('about_description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('About description must be less than 1000 characters'),
  body('theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Theme must be "light" or "dark"'),
  body('default_roadmap_depth')
    .optional()
    .isIn(['basic', 'detailed', 'comprehensive'])
    .withMessage('Default roadmap depth must be "basic", "detailed", or "comprehensive"'),
  body('default_video_length')
    .optional()
    .isIn(['short', 'medium', 'long'])
    .withMessage('Default video length must be "short", "medium", or "long"'),
], handleValidationErrors, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const settings = req.body;

    appLogger.info('Creating user settings', {
      userId,
      settingsFields: Object.keys(settings),
      ip: req.ip,
    });

    const newSettings = await neonDbService.createUserSettings(userId, settings);

    const processingTime = Date.now() - startTime;

    appLogger.info('User settings created successfully', {
      userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      message: 'Settings created successfully',
      settings: newSettings
    });

    res.status(201).json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('Failed to create user settings', error, {
      userId: req.params?.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'CREATE_SETTINGS_FAILED',
        'Failed to create user settings',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Delete user settings
router.delete('/settings/:userId', userDataLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;

    appLogger.info('Deleting user settings', {
      userId,
      ip: req.ip,
    });

    const deleted = await neonDbService.deleteUserSettings(userId);

    if (!deleted) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          'SETTINGS_NOT_FOUND',
          'User settings not found',
          'No settings found for this user'
        )
      );
      return res.status(404).json(errorResponse);
    }

    const processingTime = Date.now() - startTime;

    appLogger.info('User settings deleted successfully', {
      userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      message: 'Settings deleted successfully'
    });

    res.json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('Failed to delete user settings', error, {
      userId: req.params?.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'DELETE_SETTINGS_FAILED',
        'Failed to delete user settings',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Clear all user data endpoint
router.delete('/clear-data/:userId', userDataLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;

    appLogger.info('Clearing all user data', {
      userId,
      ip: req.ip,
    });

    // Delete all user data in correct order (child tables first)
    
    // 1. Delete roadmap progress
    await neonDbService.sql`DELETE FROM roadmap_progress WHERE user_id = ${userId}`;
    
    // 2. Delete user videos (via roadmaps)
    await neonDbService.sql`
      DELETE FROM user_videos 
      WHERE user_roadmap_id IN (
        SELECT ur.id FROM user_roadmaps ur
        JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = ${userId}
      )
    `;
    
    // 3. Delete user roadmaps
    await neonDbService.sql`
      DELETE FROM user_roadmaps 
      WHERE user_topic_id IN (
        SELECT id FROM user_topics WHERE user_id = ${userId}
      )
    `;
    
    // 4. Delete user topics
    await neonDbService.sql`DELETE FROM user_topics WHERE user_id = ${userId}`;
    
    // 5. Delete user settings
    await neonDbService.sql`DELETE FROM user_settings WHERE user_id = ${userId}`;

    const processingTime = Date.now() - startTime;

    appLogger.info('All user data cleared successfully', {
      userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      message: 'All user data cleared successfully'
    });

    res.json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('Failed to clear user data', error, {
      userId: req.params?.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'CLEAR_DATA_FAILED',
        'Failed to clear user data',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

// Delete user account endpoint
router.delete('/account/:userId', userDataLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;

    appLogger.info('Deleting user account', {
      userId,
      ip: req.ip,
    });

    // Delete all user data first (same as clear data)
    
    // 1. Delete roadmap progress
    await neonDbService.sql`DELETE FROM roadmap_progress WHERE user_id = ${userId}`;
    
    // 2. Delete user videos
    await neonDbService.sql`
      DELETE FROM user_videos 
      WHERE user_roadmap_id IN (
        SELECT ur.id FROM user_roadmaps ur
        JOIN user_topics ut ON ur.user_topic_id = ut.id
        WHERE ut.user_id = ${userId}
      )
    `;
    
    // 3. Delete user roadmaps
    await neonDbService.sql`
      DELETE FROM user_roadmaps 
      WHERE user_topic_id IN (
        SELECT id FROM user_topics WHERE user_id = ${userId}
      )
    `;
    
    // 4. Delete user topics
    await neonDbService.sql`DELETE FROM user_topics WHERE user_id = ${userId}`;
    
    // 5. Delete user settings
    await neonDbService.sql`DELETE FROM user_settings WHERE user_id = ${userId}`;
    
    // 6. Finally delete the user account
    const userResult = await neonDbService.sql`DELETE FROM users WHERE id = ${userId} RETURNING username`;
    
    if (userResult.length === 0) {
      const errorResponse = new ErrorResponse(
        new ErrorDetails(
          'USER_NOT_FOUND',
          'User account not found',
          'The user account may have already been deleted'
        )
      );
      return res.status(404).json(errorResponse);
    }

    const processingTime = Date.now() - startTime;

    appLogger.info('User account deleted successfully', {
      userId,
      username: userResult.rows[0].username,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const successResponse = new SuccessResponse({
      message: 'User account deleted successfully'
    });

    res.json(successResponse);
  } catch (error) {
    const processingTime = Date.now() - startTime;

    appLogger.error('Failed to delete user account', error, {
      userId: req.params?.userId,
      processingTime: `${processingTime}ms`,
      ip: req.ip,
    });

    const errorResponse = new ErrorResponse(
      new ErrorDetails(
        'DELETE_ACCOUNT_FAILED',
        'Failed to delete user account',
        process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
      )
    );

    res.status(500).json(errorResponse);
  }
});

export default router;

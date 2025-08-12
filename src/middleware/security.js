import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";

export const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests from this IP, please try again later.",
        details: "Rate limit exceeded",
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  });
};

export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

export const roadmapLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
});

export const playlistLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
});

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://generativelanguage.googleapis.com",
        "https://www.googleapis.com",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export const validateRoadmapInput = [
  body("topic")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Topic must be between 1 and 500 characters"),
  body("userPreferences")
    .optional()
    .isObject()
    .withMessage("User preferences must be an object"),
  body("userPreferences.depth")
    .optional()
    .isIn(["Fast", "Balanced", "Detailed"])
    .withMessage("Depth must be Fast, Balanced, or Detailed"),
  body("userPreferences.videoLength")
    .optional()
    .isIn(["Short", "Medium", "Long"])
    .withMessage("Video length must be Short, Medium, or Long"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input data",
          details: errors
            .array()
            .map((err) => `${err.path}: ${err.msg}`)
            .join(", "),
        },
      });
    }
    next();
  },
];

export const validatePlaylistInput = [
  body("topic")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Topic must be between 1 and 500 characters"),
  body("pointTitle")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Point title must be between 1 and 500 characters"),
  body("userPreferences")
    .optional()
    .isObject()
    .withMessage("User preferences must be an object"),
  body("userPreferences.depth")
    .optional()
    .isIn(["Fast", "Balanced", "Detailed"])
    .withMessage("Depth must be Fast, Balanced, or Detailed"),
  body("userPreferences.videoLength")
    .optional()
    .isIn(["Short", "Medium", "Long"])
    .withMessage("Video length must be Short, Medium, or Long"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input data",
          details: errors
            .array()
            .map((err) => `${err.path}: ${err.msg}`)
            .join(", "),
        },
      });
    }
    next();
  },
];

export const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].replace(/\0/g, "");
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
};

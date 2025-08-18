import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import roadmapRoutes from "./src/routes/roadmapRoutes.js";
import playlistRoutes from "./src/routes/playlistRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import supabaseService from "./src/services/supabaseService.js";
import {
  helmetConfig,
  generalLimiter,
  sanitizeRequest,
} from "./src/middleware/security.js";
import {
  productionLogger,
  developmentLogger,
  errorLogger,
  requestTimer,
  appLogger,
} from "./src/utils/logger.js";
import { validateEnvironmentVariables } from "./src/utils/helpers.js";

dotenv.config();

try {
  validateEnvironmentVariables(["GEMINI_API_KEY", "YOUTUBE_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]);
} catch (error) {
  console.error("Environment validation failed:", error.message);
  process.exit(1);
}

const app = express();
const PORT = 8001;
const NODE_ENV = process.env.NODE_ENV || "development";

app.set("trust proxy", 1);

app.use(helmetConfig);
app.use(compression());

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["http://localhost:8081", "http://127.0.0.1:8081", "http://localhost:19000", "http://127.0.0.1:19000"],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestTimer);
app.use(sanitizeRequest);

if (NODE_ENV === "production") {
  app.use(productionLogger);
} else {
  app.use(developmentLogger);
}

app.use(generalLimiter);

app.use("/api/roadmaps", roadmapRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/users", userRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "operational",
      services: {
        gemini: !!process.env.GEMINI_API_KEY,
        youtube: !!process.env.YOUTUBE_API_KEY,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

app.use(errorLogger);
app.use((err, req, res, next) => {
  appLogger.error("Unhandled error", err, {
    method: req.method,
    url: req.url,
    userAgent: req.get("user-agent"),
    ip: req.ip,
  });

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message:
        NODE_ENV === "production" ? "Something went wrong!" : err.message,
      details:
        NODE_ENV === "production" ? "Please try again later" : err.message,
    },
  });
});

app.use("*", (req, res) => {
  appLogger.warn("Route not found", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      details: `The route ${req.originalUrl} does not exist`,
    },
  });
});

process.on("SIGTERM", async () => {
  appLogger.info("SIGTERM received, shutting down gracefully");
  await supabaseService.closePool();
  process.exit(0);
});

process.on("SIGINT", async () => {
  appLogger.info("SIGINT received, shutting down gracefully");
  await supabaseService.closePool();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  appLogger.error("Uncaught Exception:", error);
  await supabaseService.closePool();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, promise) => {
  appLogger.error("Unhandled Rejection at:", promise, "reason:", reason);
  await supabaseService.closePool();
  process.exit(1);
});

app.listen(PORT, "localhost", () => {
  console.log(`🚀 Server started successfully on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`📝 Logging to files: ${process.cwd()}/logs/`);

  appLogger.info(`Server started successfully`, {
    port: PORT,
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });

  appLogger.info("Testing logging system", { test: true });
});

export default app;

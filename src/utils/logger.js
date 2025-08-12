import morgan from "morgan";
import fs from "fs";
import path from "path";

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create write streams for log files
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});

const errorLogStream = fs.createWriteStream(path.join(logsDir, "error.log"), {
  flags: "a",
});

// Custom token for response time
morgan.token("response-time-ms", (req, res) => {
  return `${(res.responseTime || 0).toFixed(2)}ms`;
});

// Custom token for user IP (considering proxies)
morgan.token("real-ip", (req) => {
  return (
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip
  );
});

// Custom format for detailed logging
const detailedFormat =
  ':real-ip - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms';

// Production logging middleware
export const productionLogger = morgan(detailedFormat, {
  stream: accessLogStream,
});

// Development logging middleware - also log to file in development
export const developmentLogger = morgan("dev", {
  stream: {
    write: (message) => {
      // Log to console
      process.stdout.write(message);
      // Also log to file in development
      accessLogStream.write(message);
    },
  },
});

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ERROR - ${req.method} ${req.url} - ${err.message}\n${err.stack}\n\n`;

  // Write to error log file
  errorLogStream.write(logEntry);

  // Also log to console in development
  console.error("Error Details:", {
    timestamp,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    error: err.message,
    stack: err.stack,
  });

  next(err);
};

// Request timing middleware
export const requestTimer = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    res.responseTime = Date.now() - start;
  });

  next();
};

// Custom logger for application events
export const appLogger = {
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - INFO - ${message} ${JSON.stringify(
      meta
    )}\n`;

    // Always log to console
    console.log(logEntry.trim());

    // Also write to access log file
    accessLogStream.write(logEntry);
  },

  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - WARN - ${message} ${JSON.stringify(
      meta
    )}\n`;

    // Always log to console
    console.warn(logEntry.trim());

    // Also write to access log file
    accessLogStream.write(logEntry);
  },

  error: (message, error = null, meta = {}) => {
    const timestamp = new Date().toISOString();
    const errorDetails = error
      ? { message: error.message, stack: error.stack }
      : {};
    const logEntry = `${timestamp} - ERROR - ${message} ${JSON.stringify({
      ...errorDetails,
      ...meta,
    })}\n`;

    // Always log to console
    console.error(logEntry.trim());

    // Write to both error log and access log
    errorLogStream.write(logEntry);
    accessLogStream.write(logEntry);
  },
};

export default {
  productionLogger,
  developmentLogger,
  errorLogger,
  requestTimer,
  appLogger,
};

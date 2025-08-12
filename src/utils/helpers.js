import { v4 as uuidv4 } from "uuid";

/**
 * Generate a unique ID with optional prefix
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Generated unique ID
 */
export const generateId = (prefix = "") => {
  const uuid = uuidv4().replace(/-/g, "").substring(0, 10);
  return prefix ? `${prefix}_${uuid}` : uuid;
};

/**
 * Generate current timestamp in ISO format
 * @returns {string} Current timestamp
 */
export const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalizeWords = (str) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

/**
 * Clean and normalize topic string
 * @param {string} topic - Topic string to clean
 * @returns {string} Cleaned topic string
 */
export const cleanTopic = (topic) => {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
};

/**
 * Calculate progress percentage
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 * @returns {number} Progress percentage (0-100)
 */
export const calculateProgress = (completed, total) => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
};

/**
 * Validate environment variables
 * @param {string[]} requiredVars - Array of required environment variable names
 * @throws {Error} If any required environment variables are missing
 */
export const validateEnvironmentVariables = (requiredVars) => {
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
};

/**
 * Create a delay for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after the delay
 */
export const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

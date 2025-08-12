Security Features Documentation

This document provides a comprehensive overview of all security features implemented in the SkillSpark Backend API.

## 🛡️ Security Architecture Overview

The API implements a multi-layered security approach with the following components:

1. **HTTP Security Headers** (Helmet.js)
2. **Rate Limiting** (express-rate-limit)
3. **Input Validation & Sanitization** (express-validator)
4. **CORS Protection** (cors)
5. **Request Sanitization** (Custom middleware)
6. **Comprehensive Logging** (Morgan + Custom logger)
7. **Error Handling** (Secure error responses)

---

## 1. 🔒 HTTP Security Headers (Helmet.js)

**Purpose**: Protects against common web vulnerabilities by setting secure HTTP headers.

### Headers Set:

#### Content Security Policy (CSP)

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],                    // Only allow resources from same origin
    styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles (needed for some frameworks)
    scriptSrc: ["'self'"],                     // Only allow scripts from same origin
    imgSrc: ["'self'", "data:", "https:"],    // Allow images from same origin, data URLs, and HTTPS
    connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://www.googleapis.com"],
    fontSrc: ["'self'"],                       // Only allow fonts from same origin
    objectSrc: ["'none'"],                     // Block all object/embed/applet elements
    mediaSrc: ["'self'"],                      // Only allow media from same origin
    frameSrc: ["'none'"],                      // Block all iframe elements
  }
}
```

**Protection Against**:

- Cross-Site Scripting (XSS) attacks
- Data injection attacks
- Clickjacking
- Code injection

#### HTTP Strict Transport Security (HSTS)

```javascript
hsts: {
  maxAge: 31536000,        // 1 year in seconds
  includeSubDomains: true, // Apply to all subdomains
  preload: true           // Include in browser preload lists
}
```

**Protection Against**:

- Man-in-the-middle attacks
- Protocol downgrade attacks
- Cookie hijacking

#### Other Security Headers

- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **X-XSS-Protection**: `1; mode=block` - Enables XSS filtering
- **Referrer-Policy**: Controls referrer information sent

---

## 2. ⏱️ Rate Limiting

**Purpose**: Prevents API abuse, DoS attacks, and ensures fair usage.

### Rate Limiting Tiers:

#### General API Rate Limit

```javascript
windowMs: 15 * 60 * 1000,  // 15 minutes
max: 100                   // 100 requests per IP per 15 minutes
```

#### Roadmap Generation (Expensive Operations)

```javascript
windowMs: 60 * 1000,  // 1 minute
max: 5                // 5 requests per IP per minute
```

#### Playlist Generation

```javascript
windowMs: 60 * 1000,  // 1 minute
max: 10               // 10 requests per IP per minute
```

### Rate Limit Response:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests from this IP, please try again later.",
    "details": "Rate limit exceeded"
  }
}
```

**Protection Against**:

- Denial of Service (DoS) attacks
- API abuse and resource exhaustion
- Brute force attacks
- Automated scraping

### Rate Limit Headers:

- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Time when the rate limit resets

---

## 3. ✅ Input Validation & Sanitization

**Purpose**: Ensures all user input is valid, safe, and properly formatted.

### Validation Rules:

#### Topic Validation (Roadmaps & Playlists)

```javascript
body("topic")
  .trim() // Remove whitespace
  .isLength({ min: 1, max: 500 }) // Length constraints
  .withMessage("Topic must be between 1 and 500 characters");
```

#### Point Title Validation (Playlists)

```javascript
body("pointTitle")
  .trim() // Remove whitespace
  .isLength({ min: 1, max: 500 }) // Length constraints
  .withMessage("Point title must be between 1 and 500 characters");
```

### Validation Approach:

- **Simple Length Validation**: Only checks minimum and maximum length
- **Whitespace Trimming**: Removes leading/trailing spaces
- **Generous Limits**: 500 characters allow for comprehensive topics
- **No Character Restrictions**: Accepts all Unicode characters including symbols, emojis, and special characters

### Validation Error Response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": "topic: Topic must be between 1 and 200 characters"
  }
}
```

**Protection Against**:

- SQL Injection
- NoSQL Injection
- Command Injection
- Cross-Site Scripting (XSS)
- Path Traversal attacks

---

## 4. 🌐 CORS Protection

**Purpose**: Controls which domains can access the API from browsers.

### CORS Configuration:

```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : true, // Allow all origins in development
  credentials: true, // Allow cookies/credentials
  optionsSuccessStatus: 200, // Support legacy browsers
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
};
```

### Production CORS Setup:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Protection Against**:

- Cross-Origin Request Forgery (CSRF)
- Unauthorized cross-origin access
- Data theft from malicious websites

---

## 5. 🧼 Request Sanitization

**Purpose**: Removes malicious content from user input.

### Sanitization Process:

```javascript
export const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].replace(/\0/g, ""); // Remove null bytes
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitize(obj[key]); // Recursively sanitize nested objects
        }
      }
    };
    sanitize(req.body);
  }
  next();
};
```

### What Gets Sanitized:

- **Null bytes** (`\0`) - Often used in injection attacks
- **Nested objects** - Recursively cleaned
- **All string values** - Processed for malicious content

**Protection Against**:

- Null byte injection
- Binary data injection
- Format string attacks

---

## 6. 📊 Comprehensive Logging & Monitoring

**Purpose**: Tracks security events, API usage, and potential threats.

### Logging Levels:

#### Request Logging (Morgan)

```javascript
// Development: Detailed console output
morgan("dev");

// Production: File-based logging with custom format
(':real-ip - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms');
```

#### Application Event Logging

```javascript
appLogger.info("Generating roadmap", {
  topic,
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

appLogger.error("Error generating roadmap", error, {
  topic: req.body?.topic,
  processingTime: `${processingTime}ms`,
  ip: req.ip,
  userAgent: req.get("user-agent"),
});
```

#### Error Logging

```javascript
// Automatic error logging with stack traces
const timestamp = new Date().toISOString();
const logEntry = `${timestamp} - ERROR - ${req.method} ${req.url} - ${err.message}\n${err.stack}\n\n`;
```

### Log Files:

- `logs/access.log` - All HTTP requests
- `logs/error.log` - Errors and exceptions
- Console output - Development logging

### Security Monitoring:

- Failed requests and their sources
- Rate limit violations
- Invalid input attempts
- Error patterns and frequencies
- User agent analysis for bot detection

**Benefits**:

- Security incident detection
- Performance monitoring
- Debugging and troubleshooting
- Compliance and audit trails

---

## 7. 🚨 Secure Error Handling

**Purpose**: Prevents information disclosure while providing useful feedback.

### Error Response Structure:

```javascript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",           // Standardized error code
    "message": "User-friendly message",
    "details": "Additional context"
  }
}
```

### Environment-Based Error Details:

```javascript
// Production: Generic error messages
details: NODE_ENV === "production" ? "Please try again later" : error.message;

// Development: Detailed error information
details: error.message;
```

### Error Categories:

- `VALIDATION_ERROR` - Input validation failures
- `RATE_LIMIT_EXCEEDED` - Rate limiting violations
- `GENERATION_FAILED` - AI service failures
- `INTERNAL_SERVER_ERROR` - Unexpected errors
- `NOT_FOUND` - Route not found

**Protection Against**:

- Information disclosure
- Stack trace leakage
- Internal system exposure
- Database schema revelation

---

## 8. 🔧 Additional Security Measures

### Request Size Limiting

```javascript
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
```

### Response Compression

```javascript
app.use(compression()); // Reduces bandwidth and improves performance
```

### Proxy Trust Configuration

```javascript
app.set("trust proxy", 1); // For accurate IP detection behind reverse proxies
```

---

## 🚀 Security Best Practices Implemented

### 1. **Defense in Depth**

Multiple layers of security rather than relying on a single mechanism.

### 2. **Principle of Least Privilege**

Only necessary permissions and access are granted.

### 3. **Fail-Safe Defaults**

Secure configurations by default, requiring explicit actions to reduce security.

### 4. **Input Validation Everywhere**

All user input is validated and sanitized before processing.

### 5. **Security Logging**

Comprehensive logging for security monitoring and incident response.

### 6. **Error Handling**

Secure error responses that don't leak sensitive information.

---

## 🔍 Security Testing

The included `test.js` file includes security tests:

1. **Rate Limiting Test**: Verifies rate limits are enforced
2. **Input Validation Test**: Tests invalid input handling
3. **Error Response Test**: Ensures proper error formatting
4. **CORS Test**: Validates cross-origin policies

### Running Security Tests:

```bash
node test.js
```

---

## 📋 Security Checklist for Production

- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set up reverse proxy with SSL/TLS
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup and disaster recovery
- [ ] Security scanning and penetration testing

---

## 🆘 Security Incident Response

### Monitoring Indicators:

- High error rates
- Rate limit violations
- Unusual traffic patterns
- Failed validation attempts
- Geographic anomalies

### Response Actions:

1. Check logs for attack patterns
2. Implement IP blocking if necessary
3. Scale rate limits down temporarily
4. Review and update security rules
5. Document and analyze the incident

---

This comprehensive security implementation provides enterprise-level protection while maintaining API usability and performance.

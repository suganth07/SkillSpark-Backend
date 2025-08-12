# SkillSpark Backend API

A secure and scalable Express.js API for generating learning roadmaps and YouTube playlists using Google's Gemini AI and YouTube Data API.

## Features

- 🛣️ **Learning Roadmap Generation**: Create structured learning paths using Gemini AI
- 📺 **YouTube Playlist Generation**: Find relevant YouTube videos for learning topics
- 📊 **Comprehensive Logging**: Request logging, error tracking, and monitoring

## Security Features

- **Rate Limiting**: Prevents API abuse with configurable limits
- **Input Validation**: Sanitizes and validates all user inputs
- **Security Headers**: Uses Helmet.js for security headers
- **CORS Protection**: Configurable cross-origin resource sharing
- **Request Sanitization**: Removes malicious content from requests
- **Comprehensive Logging**: Tracks all requests and errors

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Cloud Platform account
- YouTube Data API v3 enabled

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd skillspark-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Test the API**
   ```bash
   curl http://localhost:8001/health
   ```

## API Documentation

### Base URL

```
http://localhost:8001/api
```

### Endpoints

#### Generate Learning Roadmap

```http
POST /api/roadmaps/generate
Content-Type: application/json

{
  "topic": "React Native development"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "roadmap_abc123",
    "topic": "react native",
    "title": "React Native Development Roadmap",
    "description": "Complete learning path for react native development",
    "points": [...],
    "progress": {
      "completedPoints": 0,
      "totalPoints": 12,
      "percentage": 0
    }
  }
}
```

#### Generate YouTube Playlists

```http
POST /api/playlists/generate
Content-Type: application/json

{
  "topic": "React Native",
  "pointTitle": "State Management"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "playlist_xyz789",
      "title": "React Native State Management Tutorial",
      "videoUrl": "https://youtube.com/watch?v=...",
      "duration": "N/A",
      "description": "Learn state management in React Native..."
    }
  ]
}
```

#### Health Check

```http
GET /health
```

#### API Status

```http
GET /api/status
```

## Configuration

### Environment Variables

| Variable          | Required | Default     | Description                                  |
| ----------------- | -------- | ----------- | -------------------------------------------- |
| `GEMINI_API_KEY`  | Yes      | -           | Google Gemini AI API key                     |
| `YOUTUBE_API_KEY` | Yes      | -           | YouTube Data API v3 key                      |
| `PORT`            | No       | 8001        | Server port                                  |
| `NODE_ENV`        | No       | development | Environment mode                             |
| `ALLOWED_ORIGINS` | No       | -           | Comma-separated list of allowed CORS origins |

### Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Roadmap Generation**: 5 requests per minute per IP
- **Playlist Generation**: 10 requests per minute per IP

### Security Headers

The API automatically sets security headers including:

- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

## Development

### Project Structure

```
src/
├── middleware/     # Security and validation middleware
├── models/         # Data models and validation
├── routes/         # API route handlers
├── services/       # External service integrations
└── utils/          # Utility functions and helpers
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload

### Error Handling

All errors are consistently formatted:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Additional error details"
  }
}
```

### Logging

Logs are written to:

- Console (development)
- `logs/access.log` (access logs)
- `logs/error.log` (error logs)

## Production Deployment

### Environment Setup

```bash
export NODE_ENV=production
export GEMINI_API_KEY=your_production_key
export YOUTUBE_API_KEY=your_production_key
export ALLOWED_ORIGINS=https://yourdomain.com
```

### Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set up reverse proxy (nginx/Apache)
- [ ] Configure SSL/TLS certificates
- [ ] Set up log rotation
- [ ] Configure monitoring and alerts

### Reverse Proxy Configuration

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Keys Setup

### Google Gemini AI API

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add the key to your `.env` file

### YouTube Data API v3

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials (API key)
5. Add the key to your `.env` file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support, please create an issue in the repository or contact the development team.

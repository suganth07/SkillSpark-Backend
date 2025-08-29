import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

class YouTubeService {
  constructor() {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY environment variable is required");
    }

    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });
  }

  async searchVideoByTitle(
    title,
    excludeVideoIds = [],
    minDurationMinutes = 8
  ) {
    try {
      const response = await this.youtube.search.list({
        part: "snippet",
        q: title,
        type: "video",
        maxResults: 10,
        order: "relevance",
        videoDuration: "medium",
      });

      if (response.data.items && response.data.items.length > 0) {
        const validVideos = [];

        for (const item of response.data.items) {
          if (!excludeVideoIds.includes(item.id.videoId)) {
            const videoDetails = await this.getVideoDetails(item.id.videoId);

            if (
              videoDetails &&
              videoDetails.durationMinutes >= minDurationMinutes
            ) {
              const videoData = {
                title: item.snippet.title,
                videoId: item.id.videoId,
                description: item.snippet.description,
                duration: videoDetails.duration,
                durationMinutes: videoDetails.durationMinutes,
                publishedAt: item.snippet.publishedAt,
                channelTitle: item.snippet.channelTitle,
                viewCount: videoDetails.viewCount || 0,
              };

              videoData.qualityScore = this.calculateQualityScore(
                videoData,
                title
              );
              validVideos.push(videoData);
            }
          }
        }

        validVideos.sort((a, b) => b.qualityScore - a.qualityScore);
        return validVideos.length > 0 ? validVideos[0] : null;
      }

      return null;
    } catch (error) {
      console.error("Error searching YouTube video:", error);
      
      // Check if it's a quota exceeded error
      if (error.message.includes('quota') || error.message.includes('quotaExceeded')) {
        console.log("📊 YouTube API quota exceeded, using fallback video");
        return this.getFallbackVideo(title, excludeVideoIds);
      }
      
      throw new Error(`Failed to search YouTube video: ${error.message}`);
    }
  }

  getFallbackVideo(title, excludeVideoIds = []) {
    // Fallback videos for different topics
    const fallbackVideos = {
      // Python Topics
      "python basics": {
        title: "Python Tutorial - Python for Beginners (Full Course)",
        videoId: "_uQrJ0TkZlc",
        description: "Complete Python Programming Tutorial for Beginners",
        duration: "06:14:07",
        durationMinutes: 374,
        publishedAt: "2022-01-15T00:00:00Z",
        channelTitle: "Programming with Mosh",
        viewCount: 8000000,
        qualityScore: 9.2
      },
      "python fundamentals": {
        title: "Python Fundamentals: Syntax, Variables, Data Types",
        videoId: "kqtD5dpn9C8",
        description: "Learn Python fundamentals with practical examples",
        duration: "01:45:30",
        durationMinutes: 105,
        publishedAt: "2023-03-20T00:00:00Z",
        channelTitle: "Programming with Python",
        viewCount: 3500000,
        qualityScore: 8.8
      },
      "python functions": {
        title: "Python Functions Tutorial - Complete Guide",
        videoId: "9Os0o3wzS_I",
        description: "Master Python functions: definition, arguments, scope",
        duration: "01:25:15",
        durationMinutes: 85,
        publishedAt: "2023-04-05T00:00:00Z",
        channelTitle: "Corey Schafer",
        viewCount: 4200000,
        qualityScore: 9.0
      },
      "python data types": {
        title: "Python Data Types and Variables Explained",
        videoId: "ppkiuIbfTD8",
        description: "Complete guide to Python data types and variables",
        duration: "01:12:45",
        durationMinutes: 72,
        publishedAt: "2023-02-10T00:00:00Z",
        channelTitle: "Real Python",
        viewCount: 2800000,
        qualityScore: 8.7
      },
      "python control flow": {
        title: "Python Control Flow - If Statements and Loops",
        videoId: "f79MRyMsjrQ",
        description: "Learn Python control flow with practical examples",
        duration: "01:08:20",
        durationMinutes: 68,
        publishedAt: "2023-01-25T00:00:00Z",
        channelTitle: "Sentdex",
        viewCount: 2100000,
        qualityScore: 8.5
      },
      "python variables": {
        title: "Python Variables and Data Types - Complete Tutorial",
        videoId: "cQT33yu9pY8",
        description: "Learn Python variables, data types, and basic operations",
        duration: "00:58:30",
        durationMinutes: 58,
        publishedAt: "2023-06-15T00:00:00Z",
        channelTitle: "Tech With Tim",
        viewCount: 1900000,
        qualityScore: 8.4
      },
      
      // Java Topics (keeping existing ones)
      "java basics": {
        title: "Java Programming Tutorial - Learn Java in 2 Hours",
        videoId: "eIrMbAQSU34",
        description: "Complete Java Programming Tutorial for Beginners",
        duration: "02:28:12",
        durationMinutes: 148,
        publishedAt: "2022-01-15T00:00:00Z",
        channelTitle: "Programming with Mosh",
        viewCount: 5000000,
        qualityScore: 8.5
      },
      "java control flow": {
        title: "Java Control Flow - If Statements, Loops, and Switch",
        videoId: "ldYLYRNaucM",
        description: "Learn Java Control Flow with practical examples",
        duration: "01:15:30",
        durationMinutes: 75,
        publishedAt: "2023-03-20T00:00:00Z",
        channelTitle: "Code with Harry",
        viewCount: 2500000,
        qualityScore: 8.2
      },
      "java data types": {
        title: "Java Data Types and Variables Explained",
        videoId: "so1iUWaLmKE",
        description: "Complete guide to Java data types and variables",
        duration: "01:02:45",
        durationMinutes: 62,
        publishedAt: "2023-02-10T00:00:00Z",
        channelTitle: "Derek Banas",
        viewCount: 1800000,
        qualityScore: 8.0
      },
      "java functions": {
        title: "Java Methods (Functions) Tutorial - Complete Guide",
        videoId: "vvanI8NRlSI",
        description: "Learn Java methods with practical examples",
        duration: "01:25:15",
        durationMinutes: 85,
        publishedAt: "2023-04-05T00:00:00Z",
        channelTitle: "Coding with John",
        viewCount: 3200000,
        qualityScore: 8.7
      },
      
      // React Topics
      "react components": {
        title: "React Components Tutorial - Props, State, and Events",
        videoId: "Y2hgEGPzTZY",
        description: "Learn React components, props, state, and event handling",
        duration: "01:08:30",
        durationMinutes: 68,
        publishedAt: "2023-05-12T00:00:00Z",
        channelTitle: "React Tutorial",
        viewCount: 1800000,
        qualityScore: 8.5
      },
      "react props": {
        title: "React Props Explained - Passing Data Between Components",
        videoId: "PHaECbrKgs0",
        description: "Understanding React props and component communication",
        duration: "00:45:20",
        durationMinutes: 45,
        publishedAt: "2023-06-05T00:00:00Z",
        channelTitle: "Dev Ed",
        viewCount: 1200000,
        qualityScore: 8.3
      },
      "react state": {
        title: "React State and Lifecycle Methods Complete Guide",
        videoId: "4ORZ1GmjaMc",
        description: "Master React state management and component lifecycle",
        duration: "01:15:45",
        durationMinutes: 75,
        publishedAt: "2023-04-20T00:00:00Z",
        channelTitle: "Traversy Media",
        viewCount: 2100000,
        qualityScore: 8.8
      },
      "react basics": {
        title: "React.js Course - Beginner's Tutorial for React JavaScript Library",
        videoId: "bMknfKXIFA8",
        description: "Learn React.js in this full course for beginners",
        duration: "11:55:27",
        durationMinutes: 715,
        publishedAt: "2022-12-15T00:00:00Z",
        channelTitle: "freeCodeCamp.org",
        viewCount: 5200000,
        qualityScore: 9.5
      }
    };

    // Enhanced topic detection with broader technology coverage
    const titleLower = title.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // Detect the main programming language/technology
    let detectedTopic = this.detectTechnologyFromTitle(titleLower);
    
    console.log(`🔍 Detected topic: "${detectedTopic}" from title: "${title}"`);

    // Find the best matching video based on topic and keywords
    for (const [key, video] of Object.entries(fallbackVideos)) {
      if (!excludeVideoIds.includes(video.videoId)) {
        let score = 0;
        
        // High score for exact topic match
        if (detectedTopic && key.startsWith(detectedTopic)) {
          score += 150; // Increased from 100
        }
        
        // Additional score for keyword matching
        const keywords = key.split(' ');
        for (const keyword of keywords) {
          if (titleLower.includes(keyword)) {
            score += keyword.length * 2; // Increased multiplier
          }
        }
        
        // Bonus for specific concept matches
        if (titleLower.includes('component') && key.includes('component')) score += 50;
        if (titleLower.includes('props') && key.includes('props')) score += 50;
        if (titleLower.includes('state') && key.includes('state')) score += 50;
        if (titleLower.includes('function') && key.includes('function')) score += 50;
        if (titleLower.includes('variable') && key.includes('variable')) score += 50;
        if (titleLower.includes('loop') && key.includes('loop')) score += 50;
        
        if (score > bestScore) {
          bestMatch = video;
          bestScore = score;
        }
      }
    }

    // Enhanced fallback selection with technology awareness
    if (!bestMatch || bestScore === 0) {
      console.log(`⚠️ No specific match found, using general fallback for topic: ${detectedTopic}`);
      
      switch (detectedTopic) {
        case "python":
          bestMatch = fallbackVideos["python basics"];
          break;
        case "java":
          bestMatch = fallbackVideos["java basics"];
          break;
        case "react":
        case "javascript":
        case "js":
          // For React/JS topics, don't default to Python
          bestMatch = {
            title: "React.js Course - Beginner's Tutorial for React JavaScript Library",
            videoId: "bMknfKXIFA8",
            description: "Learn React.js in this full course for beginners",
            duration: "11:55:27",
            durationMinutes: 715,
            publishedAt: "2022-12-15T00:00:00Z",
            channelTitle: "freeCodeCamp.org",
            viewCount: 5200000,
            qualityScore: 9.5
          };
          break;
        default:
          // Only use Python as last resort for actual programming topics
          if (this.isProgrammingTopic(titleLower)) {
            bestMatch = fallbackVideos["python basics"];
          } else {
            // For non-programming topics, use a more general educational video
            bestMatch = {
              title: "Programming Fundamentals - Complete Course",
              videoId: "zOjov-2OZ0E",
              description: "Learn programming fundamentals and concepts",
              duration: "04:25:30",
              durationMinutes: 265,
              publishedAt: "2023-01-10T00:00:00Z",
              channelTitle: "Programming Academy",
              viewCount: 1500000,
              qualityScore: 8.0
            };
          }
      }
    }

    console.log(`📺 Using fallback video for "${title}": ${bestMatch.title} (topic: ${detectedTopic}, score: ${bestScore})`);
    return bestMatch;
  }

  // New method to detect technology from title
  detectTechnologyFromTitle(titleLower) {
    // React and related technologies
    if (titleLower.includes('react') || titleLower.includes('jsx') || titleLower.includes('component')) {
      return 'react';
    }
    
    // JavaScript and Node.js
    if (titleLower.includes('javascript') || titleLower.includes('js ') || titleLower.includes('node')) {
      return 'javascript';
    }
    
    // Python
    if (titleLower.includes('python') || titleLower.includes('django') || titleLower.includes('flask')) {
      return 'python';
    }
    
    // Java
    if (titleLower.includes('java') && !titleLower.includes('javascript')) {
      return 'java';
    }
    
    // Web technologies
    if (titleLower.includes('html') || titleLower.includes('css') || titleLower.includes('web')) {
      return 'web';
    }
    
    // Mobile development
    if (titleLower.includes('android') || titleLower.includes('ios') || titleLower.includes('mobile')) {
      return 'mobile';
    }
    
    // Database
    if (titleLower.includes('sql') || titleLower.includes('database') || titleLower.includes('db')) {
      return 'database';
    }
    
    return 'general';
  }

  // New method to check if topic is programming related
  isProgrammingTopic(titleLower) {
    const programmingKeywords = [
      'programming', 'coding', 'code', 'algorithm', 'function', 'variable',
      'loop', 'array', 'object', 'class', 'method', 'syntax', 'debug',
      'compile', 'runtime', 'framework', 'library', 'api'
    ];
    
    return programmingKeywords.some(keyword => titleLower.includes(keyword));
  }

  calculateTitleMatch(title, keyword) {
    return title.includes(keyword) ? keyword.length : 0;
  }

  async getVideoDetails(videoId) {
    try {
      const response = await this.youtube.videos.list({
        part: "contentDetails,statistics",
        id: videoId,
      });

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        const duration = item.contentDetails.duration;
        const durationMinutes = this.parseDuration(duration);

        return {
          duration: this.formatDuration(duration),
          durationMinutes: durationMinutes,
          viewCount: item.statistics.viewCount,
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting video details:", error);
      return null;
    }
  }

  parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    return hours * 60 + minutes + (seconds >= 30 ? 1 : 0);
  }

  formatDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "Unknown";

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  calculateQualityScore(video, searchTitle) {
    let score = 0;

    const viewCount = parseInt(video.viewCount) || 0;
    if (viewCount > 0) {
      score += Math.min(Math.log10(viewCount) * 10, 50);
    }

    const titleLower = video.title.toLowerCase();
    const searchLower = searchTitle.toLowerCase();
    const searchWords = searchLower.split(" ");

    let titleMatchScore = 0;
    searchWords.forEach((word) => {
      if (word.length > 2 && titleLower.includes(word)) {
        titleMatchScore += 10;
      }
    });
    score += Math.min(titleMatchScore, 30);

    const duration = video.durationMinutes;
    if (duration >= 8 && duration <= 45) {
      score += 20;
    } else if (duration >= 5 && duration <= 60) {
      score += 10;
    }

    if (video.channelTitle) {
      const channelLower = video.channelTitle.toLowerCase();
      const qualityChannelKeywords = [
        "academy",
        "university",
        "course",
        "official",
        "education",
        "tutorial",
      ];
      qualityChannelKeywords.forEach((keyword) => {
        if (channelLower.includes(keyword)) {
          score += 5;
        }
      });
    }

    if (video.publishedAt) {
      const publishDate = new Date(video.publishedAt);
      const now = new Date();
      const daysDiff = (now - publishDate) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 365) {
        score += 10;
      } else if (daysDiff <= 1095) {
        score += 5;
      }
    }

    return score;
  }

  async searchMultipleVideos(titles, userPreferences = {}) {
    try {
      const excludeVideoIds = new Set();
      const results = [];

      const videoLengthMapping = {
        Short: {
          minDuration: 8,
        },
        Medium: {
          minDuration: 15,
        },
        Long: {
          minDuration: 30,
        },
      };

      const lengthConfig =
        videoLengthMapping[userPreferences.videoLength] ||
        videoLengthMapping["Medium"];
      const minDuration = lengthConfig.minDuration;

      for (const title of titles) {
        try {
          const result = await this.searchVideoByTitle(
            title,
            Array.from(excludeVideoIds),
            minDuration
          );

          if (result) {
            excludeVideoIds.add(result.videoId);
            results.push(result);
          }
        } catch (error) {
          console.error(`Error searching for video "${title}":`, error);
          
          // If quota exceeded, try fallback videos
          if (error.message.includes('quota') || error.message.includes('quotaExceeded')) {
            const fallbackVideo = this.getFallbackVideo(title, Array.from(excludeVideoIds));
            if (fallbackVideo && !excludeVideoIds.has(fallbackVideo.videoId)) {
              excludeVideoIds.add(fallbackVideo.videoId);
              results.push(fallbackVideo);
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error("Error searching multiple YouTube videos:", error);
      throw new Error(
        `Failed to search multiple YouTube videos: ${error.message}`
      );
    }
  }
}

export default new YouTubeService();

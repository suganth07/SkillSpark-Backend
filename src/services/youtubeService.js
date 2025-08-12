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
      throw new Error(`Failed to search YouTube video: ${error.message}`);
    }
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

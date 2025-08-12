import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

class SupabaseService {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.warn('Supabase configuration missing - user features will be disabled');
      this.supabase = null;
      return;
    }

    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      console.log('✅ Supabase client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error.message);
      this.supabase = null;
    }
  }

  _checkConnection() {
    if (!this.supabase) {
      throw new Error('Supabase is not configured. Please set up your Supabase credentials.');
    }
  }

  // User management
  async createUser(username, password) {
    this._checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([{ username, password }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getUserByCredentials(username, password) {
    this._checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (error.code === 'PGRST116') {
        return null; // No user found
      }
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async checkUserExists(username) {
    this._checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data !== null;
    } catch (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  // User Topics
  async createUserTopic(userId, topic) {
    try {
      const { data, error } = await this.supabase
        .from('user_topics')
        .insert([{ user_id: userId, topic }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to create user topic: ${error.message}`);
    }
  }

  async getUserTopics(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_topics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get user topics: ${error.message}`);
    }
  }

  async getUserTopicByName(userId, topicName) {
    try {
      const { data, error } = await this.supabase
        .from('user_topics')
        .select('*')
        .eq('user_id', userId)
        .eq('topic', topicName)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data || null;
    } catch (error) {
      throw new Error(`Failed to get user topic by name: ${error.message}`);
    }
  }

  // User Roadmaps
  async createUserRoadmap(userTopicId, roadmapData) {
    try {
      const { data, error } = await this.supabase
        .from('user_roadmaps')
        .insert([{ 
          user_topic_id: userTopicId, 
          roadmap_data: roadmapData 
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to create user roadmap: ${error.message}`);
    }
  }

  async getUserRoadmaps(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_roadmaps')
        .select(`
          id,
          roadmap_data,
          created_at,
          updated_at,
          user_topics!inner(
            user_id,
            topic
          )
        `)
        .eq('user_topics.user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match frontend expectations
      const transformedData = (data || []).map(item => ({
        id: item.id,
        userId: item.user_topics.user_id,
        topic: item.user_topics.topic,
        roadmapData: item.roadmap_data,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
      
      return transformedData;
    } catch (error) {
      throw new Error(`Failed to get user roadmaps: ${error.message}`);
    }
  }

  async updateUserRoadmap(roadmapId, roadmapData) {
    try {
      const { data, error } = await this.supabase
        .from('user_roadmaps')
        .update({ 
          roadmap_data: roadmapData,
          updated_at: new Date().toISOString()
        })
        .eq('id', roadmapId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to update user roadmap: ${error.message}`);
    }
  }

  // User Videos
  async createUserVideos(userRoadmapId, level, videoData) {
    try {
      const { data, error } = await this.supabase
        .from('user_videos')
        .insert([{ 
          user_roadmap_id: userRoadmapId, 
          level,
          video_data: videoData 
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to create user videos: ${error.message}`);
    }
  }

  async getUserVideos(userRoadmapId, level = null) {
    try {
      let query = this.supabase
        .from('user_videos')
        .select('*')
        .eq('user_roadmap_id', userRoadmapId);

      if (level) {
        query = query.eq('level', level);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get user videos: ${error.message}`);
    }
  }
}

export default new SupabaseService();

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const videoApi = {
  // Upload a video file
  uploadVideo: async (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return response.data;
  },

  // Create WebSocket connection for progress updates
  createWebSocket: (videoId) => {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/${videoId}`;
    return new WebSocket(wsUrl);
  },

  // Search for frames
  searchFrames: async (query, topK = 5, videoId = null, searchType = 'hybrid') => {
    const requestBody = {
      query,
      top_k: topK,
      search_type: searchType,
    };

    if (videoId) {
      requestBody.video_id = videoId;
    }

    const response = await api.post('/search', requestBody);

    return response.data;
  },

  // Get all uploaded videos
  getUploadedVideos: async () => {
    const response = await api.get('/videos');
    return response.data;
  },

  // Get video metadata
  getVideoMetadata: async (videoId) => {
    const response = await api.get(`/video/${videoId}/metadata`);
    return response.data;
  },

  // Delete video
  deleteVideo: async (videoId) => {
    const response = await api.delete(`/video/${videoId}`);
    return response.data;
  },

  // Get frame image URL
  getFrameUrl: (framePath) => {
    if (framePath.startsWith('/frames')) {
      return `${API_BASE_URL}${framePath}`;
    }
    return `${API_BASE_URL}/frames/${framePath}`;
  },
};

// --- SMCEA Project API ---
export const projectApi = {
  listProjects: async () => {
    const { data } = await api.get('/projects');
    return data.projects ?? data;
  },

  getProjectWorkspace: async (projectId) => {
    const { data } = await api.get(`/projects/${projectId}`);
    return data;
  },

  searchMoments: async (projectId, query, topK = 10) => {
    const { data } = await api.post(`/projects/${projectId}/search`, { query, top_k: topK });
    return data;
  },

  submitFeedback: async (projectId, feedback) => {
    const { data } = await api.post(`/projects/${projectId}/feedback`, feedback);
    return data;
  },

  uploadStyleReference: async (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    await api.post(`/projects/${projectId}/style-reference`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  updateClipCaption: async (projectId, clipId, caption) => {
    await api.patch(`/projects/${projectId}/cuts/${clipId}`, { suggested_caption: caption });
  },

  updateClipStatus: async (projectId, clipId, status) => {
    await api.patch(`/projects/${projectId}/cuts/${clipId}/status`, { status });
  },

  publishClips: async (projectId, clipIds) => {
    const { data } = await api.post(`/projects/${projectId}/publish`, { clip_ids: clipIds });
    return data;
  },

  regenerate: async (projectId) => {
    await api.post(`/projects/${projectId}/regenerate`);
  },

  createAgentWebSocket: (projectId) => {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/agent/${projectId}`;
    return new WebSocket(wsUrl);
  },

  getFrameUrl: (path) => {
    if (path.startsWith('/frames') || path.startsWith('/uploads')) {
      return `${API_BASE_URL}${path}`;
    }
    return `${API_BASE_URL}/frames/${path}`;
  },
};

export default api;

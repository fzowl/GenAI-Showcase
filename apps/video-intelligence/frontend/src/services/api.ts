import axios, { AxiosInstance } from 'axios';
import type {
  Project, ProjectWorkspaceData, SearchResponse,
  FeedbackEntry, FeedbackSubmission, SuggestedCaption
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const projectApi = {
  listProjects: async (): Promise<Project[]> => {
    const { data } = await api.get('/projects');
    return data.projects ?? data;
  },

  getProjectWorkspace: async (projectId: string): Promise<ProjectWorkspaceData> => {
    const { data } = await api.get(`/projects/${projectId}`);
    return data;
  },

  searchMoments: async (projectId: string, query: string, topK = 10): Promise<SearchResponse> => {
    const { data } = await api.post(`/projects/${projectId}/search`, { query, top_k: topK });
    return data;
  },

  submitFeedback: async (projectId: string, feedback: FeedbackSubmission): Promise<FeedbackEntry> => {
    const { data } = await api.post(`/projects/${projectId}/feedback`, feedback);
    return data;
  },

  uploadStyleReference: async (projectId: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    await api.post(`/projects/${projectId}/style-reference`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  updateClipCaption: async (projectId: string, clipId: string, caption: SuggestedCaption): Promise<void> => {
    await api.patch(`/projects/${projectId}/cuts/${clipId}`, { suggested_caption: caption });
  },

  updateClipStatus: async (projectId: string, clipId: string, status: 'approved' | 'rejected'): Promise<void> => {
    await api.patch(`/projects/${projectId}/cuts/${clipId}/status`, { status });
  },

  publishClips: async (projectId: string, clipIds: string[]): Promise<{ published_count: number; message: string }> => {
    const { data } = await api.post(`/projects/${projectId}/publish`, { clip_ids: clipIds });
    return data;
  },

  regenerate: async (projectId: string): Promise<void> => {
    await api.post(`/projects/${projectId}/regenerate`);
  },

  createAgentWebSocket: (projectId: string): WebSocket => {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/agent/${projectId}`;
    return new WebSocket(wsUrl);
  },

  getFrameUrl: (path: string): string => {
    if (path.startsWith('/frames') || path.startsWith('/uploads')) {
      return `${API_BASE_URL}${path}`;
    }
    return `${API_BASE_URL}/frames/${path}`;
  },
};

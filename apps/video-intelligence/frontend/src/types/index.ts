// --- Project ---
export interface SegmentBoundary {
  start: number;
  end: number;
  speaker: string;
}

export interface SuggestedCaption {
  linkedin: string;
  reels: string;
  twitter?: string;
}

export interface SuggestedHashtags {
  linkedin: string[];
  reels: string[];
}

export interface SuggestedClip {
  clip_id: string;
  start_time: number;
  end_time: number;
  thumbnail_path?: string;
  transcript_excerpt: string;
  speaker: string;
  suggested_caption: SuggestedCaption;
  suggested_hashtags: SuggestedHashtags;
  asset_recommendation: string;
  memory_notes: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface StyleReference {
  pacing?: string;
  hook_structure?: string;
  caption_tone?: string;
  format_notes?: string;
}

export interface Project {
  project_id: string;
  title: string;
  video_id?: string;
  video_path?: string;
  campaign_id: string;
  status: 'draft' | 'in_progress' | 'published';
  duration?: number;
  segment_boundaries: SegmentBoundary[];
  recommended_cuts: SuggestedClip[];
  style_reference?: StyleReference;
  created_at?: string;
  last_agent_run?: string;
}

// --- Feedback ---
export interface TimestampRange {
  start: number;
  end: number;
}

export interface FeedbackEntry {
  feedback_id: string;
  project_id: string;
  video_id?: string;
  timestamp_range: TimestampRange;
  author: string;
  comment_text: string;
  created_at?: string;
}

export interface FeedbackSubmission {
  author: string;
  comment_text: string;
  playhead_time: number;
}

// --- Memory ---
export interface PreferredClipLengths {
  reels: number;
  linkedin: number;
  twitter: number;
}

export interface StyleMemory {
  user_id: string;
  preferred_clip_lengths: PreferredClipLengths;
  pacing: string;
  hook_style: string;
  feedback_patterns: string[];
  accepted_cuts: string[];
  rejected_cuts: string[];
  updated_at?: string;
}

export interface SpeakerProfile {
  preferred_angle?: string;
  voice_notes: string;
  quirks: string[];
}

export interface ProjectMemory {
  campaign_id: string;
  event_name: string;
  brand_voice_rules: string;
  previous_campaigns: string[];
  target_platforms: string[];
  speaker_profiles: Record<string, SpeakerProfile>;
}

// --- API Responses ---
export interface ProjectWorkspaceData {
  project: Project;
  feedback: FeedbackEntry[];
  style_memory?: StyleMemory;
  project_memory?: ProjectMemory;
}

export interface SearchResult {
  frame_number: number;
  timestamp: number;
  description: string;
  transcript?: string;
  transcript_summary?: string;
  speaker_label?: string;
  similarity_score: number;
  thumbnail_path: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
}

export interface ConflictInfo {
  timestamp: string;
  authors: string[];
  positions: string[];
}

// --- WebSocket Messages ---
export interface AgentClipMessage {
  type: 'clip';
  data: SuggestedClip;
}

export interface AgentConflictsMessage {
  type: 'conflicts';
  data: ConflictInfo[];
}

export interface AgentFeedbackPatternsMessage {
  type: 'feedback_patterns';
  data: string[];
}

export interface AgentStatusMessage {
  type: 'status';
  message: string;
}

export interface AgentErrorMessage {
  type: 'error';
  message: string;
}

export interface AgentCompleteMessage {
  type: 'complete';
}

export type AgentMessage =
  | AgentClipMessage
  | AgentConflictsMessage
  | AgentFeedbackPatternsMessage
  | AgentStatusMessage
  | AgentErrorMessage
  | AgentCompleteMessage;

# Sub-Agent F: Frontend Pages + Core Components (TypeScript)

## Role
Build the TypeScript React frontend foundation: type definitions, two pages (ProjectList + ProjectWorkspace), and the three core interactive components (SearchBar, VideoTimeline, FeedbackPanel). Convert existing JS files to TypeScript.

## Ownership
- `frontend/tsconfig.json` (new)
- `frontend/src/types/index.ts` (new)
- `frontend/src/App.tsx` (replace existing App.js)
- `frontend/src/services/api.ts` (replace existing api.js)
- `frontend/src/pages/ProjectList.tsx` (new)
- `frontend/src/pages/ProjectWorkspace.tsx` (new)
- `frontend/src/components/SearchBar.tsx` (new)
- `frontend/src/components/VideoTimeline.tsx` (new)
- `frontend/src/components/FeedbackPanel.tsx` (new)

## Prerequisites
- Sub-Agent A (project structure exists)
- Sub-Agent B (API endpoints for projects exist, seed data loaded)

## IMPORTANT: TypeScript Only
**ALL frontend code MUST be TypeScript (.tsx/.ts). No JavaScript (.jsx/.js) is allowed.**
- Delete all existing .js/.jsx files after converting to .ts/.tsx
- Use strict TypeScript configuration
- All props, state, API responses must have explicit type definitions
- No `any` types unless absolutely necessary (and document why)

## Tasks

### 1. Add TypeScript to the project

Update `frontend/package.json` — add TypeScript + types:
```json
{
  "dependencies": {
    "react-router-dom": "^6.20.0",
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/node": "^20.0.0"
  }
}
```

Create `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### 2. Create `frontend/src/types/index.ts`

All shared type definitions mirroring backend schemas:

```typescript
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

export interface AgentCompleteMessage {
  type: 'complete';
  conflicts?: ConflictInfo[];
  feedback_patterns?: string[];
}

export type AgentMessage = AgentClipMessage | AgentCompleteMessage;
```

### 3. Create `frontend/src/services/api.ts`

Replace existing `api.js` with typed TypeScript version:

```typescript
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
    return data;
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
```

### 4. Create `frontend/src/App.tsx`

Replace App.js with TypeScript router-based app:

```tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectWorkspace from './pages/ProjectWorkspace';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
```

### 5. Create `frontend/src/pages/ProjectList.tsx`

Home screen showing 4 project cards.

**Layout:** Grid of cards showing project_id, title, status, campaign_id.
- Published projects show a "Published" badge
- In-progress projects show "In Progress" badge
- Clicking a card navigates to `/project/{project_id}`
- Cards show: title, status badge, campaign_id, number of recommended_cuts

### 6. Create `frontend/src/pages/ProjectWorkspace.tsx`

Main workspace — 4-zone layout per spec section 10:
1. **Top:** SearchBar (query input + thumbnail strip results)
2. **Left:** Video player (VideoTimeline) + FeedbackPanel below it
3. **Right top:** CutListPanel (clip cards)
4. **Right bottom:** MemorySidebar

State management:
- Load project workspace data on mount via `projectApi.getProjectWorkspace(projectId)`
- Track current playhead time (shared between VideoTimeline and FeedbackPanel)
- Track search results
- Track conflicts from agent
- WebSocket connection for streaming cut generation

### 7. Create `frontend/src/components/SearchBar.tsx`

**Props:** `projectId: string`, `onResultSelect: (result: SearchResult) => void`

**Behavior:**
- Text input for natural language queries
- Submit triggers `projectApi.searchMoments()`
- Results displayed as horizontal thumbnail strip above video player
- Clicking a result seeks the video to that timestamp and optionally adds segment to candidate clip list

### 8. Create `frontend/src/components/VideoTimeline.tsx`

**Props:** `videoPath: string`, `segmentBoundaries: SegmentBoundary[]`, `feedback: FeedbackEntry[]`, `onTimeUpdate: (time: number) => void`, `seekTo?: number`

**Behavior:**
- HTML5 video player with controls
- Timeline below player showing segment boundaries as clickable sections
- Feedback markers on timeline (orange dots where feedback exists)
- Conflict markers highlighted differently (red)
- `onTimeUpdate` fires on video timeupdate event — shared with FeedbackPanel
- `seekTo` prop allows external seeking (from search results or feedback clicks)

### 9. Create `frontend/src/components/FeedbackPanel.tsx`

**Props:** `feedback: FeedbackEntry[]`, `currentTime: number`, `conflicts: ConflictInfo[]`

**Behavior:**
- Shows feedback entries filtered by current playhead timestamp
- As video plays/scrubs, panel updates to show comments covering current timestamp range
- Conflict entries highlighted in orange with both positions shown
- Each entry shows: author, comment_text, timestamp range
- Clicking an entry seeks video to that timestamp

## Acceptance Criteria
- [ ] `npm start` runs without TypeScript errors
- [ ] No .js/.jsx files remain in src/ (all converted to .ts/.tsx)
- [ ] ProjectList page shows 4 project cards loaded from API
- [ ] Clicking a project card navigates to ProjectWorkspace
- [ ] ProjectWorkspace loads compound data (project + feedback + memory)
- [ ] SearchBar submits queries and displays thumbnail strip results
- [ ] VideoTimeline plays video with feedback markers on timeline
- [ ] FeedbackPanel filters by current playhead time
- [ ] Conflict entries are visually distinguished (orange/red)
- [ ] All component props are explicitly typed
- [ ] No `any` types in the codebase

## Output
Sub-Agent G depends on:
- Type definitions from types/index.ts
- API service from services/api.ts
- ProjectWorkspace layout (to place editor components)
- VideoTimeline's onTimeUpdate callback (for FeedbackInput timestamp defaulting)

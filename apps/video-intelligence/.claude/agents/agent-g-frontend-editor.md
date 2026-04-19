# Sub-Agent G: Frontend Editor Components (TypeScript)

## Role
Build the editor-specific React components: FeedbackInput, StyleReferenceUpload, CutListPanel, PublishButton, and MemorySidebar. These handle the interactive editing workflow — feedback submission, style reference upload, cut list review/edit, publish, and memory visualization.

## Ownership
- `frontend/src/components/FeedbackInput.tsx` (new)
- `frontend/src/components/StyleReferenceUpload.tsx` (new)
- `frontend/src/components/CutListPanel.tsx` (new)
- `frontend/src/components/PublishButton.tsx` (new)
- `frontend/src/components/MemorySidebar.tsx` (new)

## Prerequisites
- Sub-Agent F (TypeScript types, API service, ProjectWorkspace layout, VideoTimeline)
- Sub-Agent E (backend endpoints for feedback, publish, regenerate)

## IMPORTANT: TypeScript Only
**ALL code MUST be TypeScript (.tsx/.ts). No JavaScript (.jsx/.js) is allowed.**

## Tasks

### 1. Create `frontend/src/components/FeedbackInput.tsx`

**Props:**
```typescript
interface FeedbackInputProps {
  projectId: string;
  currentTime: number;
  segmentBoundaries: SegmentBoundary[];
  onFeedbackSubmitted: (feedback: FeedbackEntry) => void;
}
```

**Behavior:**
- Comment text input (textarea)
- Author field (default: "Editor" — can be changed)
- Timestamp range display: defaults to the segment boundary covering `currentTime`
  - Frontend sends `playhead_time` to backend
  - Backend looks up `project.segment_boundaries` to find covering segment
  - Editor can optionally drag start/end handles on a mini-timeline to override
- Submit button triggers `projectApi.submitFeedback()`
- After submit, calls `onFeedbackSubmitted` to refresh feedback list
- Submitting auto-triggers Social Agent re-generation (backend handles this)

### 2. Create `frontend/src/components/StyleReferenceUpload.tsx`

**Props:**
```typescript
interface StyleReferenceUploadProps {
  projectId: string;
  currentReference?: StyleReference;
  onStyleUploaded: (style: StyleReference) => void;
}
```

**Behavior:**
- Drag-and-drop zone for video files (use react-dropzone — already in package.json)
- Accept video formats: .mp4, .mov, .webm
- Show upload progress
- On upload, calls `projectApi.uploadStyleReference()`
- Display current style reference if one exists (pacing, hook_structure, caption_tone, format_notes)
- After upload, calls `onStyleUploaded` with the analysis result
- Upload triggers Social Agent re-generation (backend handles this)

### 3. Create `frontend/src/components/CutListPanel.tsx`

**Props:**
```typescript
interface CutListPanelProps {
  projectId: string;
  cuts: SuggestedClip[];
  conflicts: ConflictInfo[];
  isRegenerating: boolean;
  onCutUpdated: (clipId: string, updates: Partial<SuggestedClip>) => void;
  onSeekTo: (time: number) => void;
}
```

**Behavior:**
- List of clip cards, one per recommended cut
- Each card shows:
  - Thumbnail image (from thumbnail_path)
  - Timestamp range (start_time – end_time, formatted as MM:SS)
  - Transcript excerpt
  - Speaker label
  - **Editable captions:** Inline text inputs for LinkedIn and Reels captions
    - Blur/enter saves via `projectApi.updateClipCaption()` (PATCH endpoint)
  - Suggested hashtags (per platform)
  - Asset recommendation text
  - Memory notes (italicized — explains agent reasoning)
  - **Approve/Reject buttons:** Click updates status via `projectApi.updateClipStatus()`
  - Status badge: pending (gray), approved (green), rejected (red)
- Clicking the thumbnail or timestamp seeks the video to that time (`onSeekTo`)
- **Conflict display:** If conflicts array is non-empty, show conflict cards at the top
  - Each conflict shows timestamp, both authors, both positions
  - Editor picks one side (sends resolution to backend)
- **Re-generation loading state:**
  - When `isRegenerating=true`: old cut list dims (opacity 0.5) with spinner overlay
  - WebSocket pushes new clips progressively — each clip appears as it arrives
  - Target: <5s for full generation

### 4. Create `frontend/src/components/PublishButton.tsx`

**Props:**
```typescript
interface PublishButtonProps {
  projectId: string;
  cuts: SuggestedClip[];
  onPublished: () => void;
}
```

**Behavior:**
- Button labeled "Publish Approved Clips"
- Disabled if no clips have status "approved"
- Shows count: "Publish (3 clips)"
- On click, calls `projectApi.publishClips()` with list of approved clip_ids
- Shows confirmation toast: "3 clips sent to social team. Content memory updated."
- Calls `onPublished` to refresh workspace state

### 5. Create `frontend/src/components/MemorySidebar.tsx`

**Props:**
```typescript
interface MemorySidebarProps {
  styleMemory?: StyleMemory;
  projectMemory?: ProjectMemory;
  isLoading: boolean;
}
```

**Behavior:**
- Sidebar panel showing agent memory state
- **Style Memory section:**
  - Preferred clip lengths per platform (Reels: 15s, LinkedIn: 60s, Twitter: 30s)
  - Pacing preference
  - Hook style preference
  - Feedback patterns (bulleted list)
  - "Loaded from SF" indicator (shows cross-project memory origin)
- **Project Memory section:**
  - Brand voice rules
  - Target platforms
  - Speaker profiles with voice notes and quirks
  - Previous campaigns list
- **Learning trajectory indicator:**
  - "Accepted: 7 cuts across 3 projects"
  - "Rejected: 3 drafts"
  - Shows that memory accumulates across projects
- Updates live after publish (refresh style_memory data)

### 6. Wire into ProjectWorkspace

Ensure all components are properly placed in the ProjectWorkspace layout:

```
┌─────────────────────────────────────────────────┐
│  SearchBar (full width)                         │
├──────────────────────┬──────────────────────────┤
│  VideoTimeline       │  CutListPanel            │
│  (video player)      │  (clip cards)            │
│                      │                          │
│  FeedbackPanel       │                          │
│  (timestamp-synced)  │                          │
│                      │                          │
│  FeedbackInput       │  PublishButton           │
│  (comment input)     │                          │
│                      │                          │
│  StyleRefUpload      │  MemorySidebar           │
│  (drag-drop)         │  (prefs + memory)        │
└──────────────────────┴──────────────────────────┘
```

### 7. WebSocket integration for streaming cuts

In ProjectWorkspace, manage a WebSocket connection for agent streaming:

```typescript
const connectAgentWS = (projectId: string) => {
  const ws = projectApi.createAgentWebSocket(projectId);
  ws.onmessage = (event) => {
    const message: AgentMessage = JSON.parse(event.data);
    if (message.type === 'clip') {
      setCuts(prev => [...prev, message.data]);
    } else if (message.type === 'complete') {
      setIsRegenerating(false);
      if (message.conflicts) setConflicts(message.conflicts);
    }
  };
  return ws;
};
```

## Acceptance Criteria
- [ ] All components are TypeScript (.tsx) with explicit prop types
- [ ] FeedbackInput submits feedback with playhead-defaulted timestamp range
- [ ] StyleReferenceUpload accepts drag-drop video, shows upload progress
- [ ] CutListPanel shows clip cards with editable captions, approve/reject buttons
- [ ] Caption edits save on blur/enter via PATCH endpoint
- [ ] Approve/reject updates clip status visually and via API
- [ ] PublishButton shows count, publishes approved clips, shows toast
- [ ] MemorySidebar shows style_memory, project_memory, learning trajectory
- [ ] WebSocket streaming shows clips appearing progressively during re-generation
- [ ] Conflict cards display at top of CutListPanel with both positions
- [ ] Re-generation dims old cuts with spinner overlay
- [ ] No `any` types, no .js/.jsx files

## Output
This is the final frontend agent — after this, the full 10-step demo flow should be walkable in the UI.

# Sub-Agent G: Frontend Editor Components (JavaScript)

## Role
Build the editor-specific React components: FeedbackInput, StyleReferenceUpload, CutListPanel, PublishButton, and MemorySidebar. These handle the interactive editing workflow -- feedback submission, style reference upload, cut list review/edit, publish, and memory visualization.

## Ownership
- `frontend/src/components/FeedbackInput.jsx` (new)
- `frontend/src/components/StyleReferenceUpload.jsx` (new)
- `frontend/src/components/CutListPanel.jsx` (new)
- `frontend/src/components/PublishButton.jsx` (new)
- `frontend/src/components/MemorySidebar.jsx` (new)

## Prerequisites
- Sub-Agent F (API service, ProjectWorkspace layout, VideoTimeline)
- Sub-Agent E (backend endpoints for feedback, publish, regenerate)

## Tasks

### 1. Create `frontend/src/components/FeedbackInput.jsx`

**Props:** `projectId`, `currentTime`, `segmentBoundaries`, `onFeedbackSubmitted`

**Behavior:**
- Comment text input (textarea)
- Author field (default: "Editor" -- can be changed)
- Timestamp range display: defaults to the segment boundary covering `currentTime`
  - Frontend sends `playhead_time` to backend
  - Backend looks up `project.segment_boundaries` to find covering segment
- Submit button triggers `projectApi.submitFeedback()`
- After submit, calls `onFeedbackSubmitted` to refresh feedback list
- Submitting auto-triggers Social Agent re-generation (backend handles this)

### 2. Create `frontend/src/components/StyleReferenceUpload.jsx`

**Props:** `projectId`, `currentReference`, `onStyleUploaded`

**Behavior:**
- Drag-and-drop zone for video files
- Accept video formats: .mp4, .mov, .webm
- Show upload progress
- On upload, calls `projectApi.uploadStyleReference()`
- Display current style reference if one exists (pacing, hook_structure, caption_tone, format_notes)
- After upload, calls `onStyleUploaded` with the analysis result

### 3. Create `frontend/src/components/CutListPanel.jsx`

**Props:** `projectId`, `cuts`, `conflicts`, `isRegenerating`, `onCutUpdated`, `onSeekTo`

**Behavior:**
- List of clip cards, one per recommended cut
- Each card shows:
  - Thumbnail image (from thumbnail_path)
  - Timestamp range (start_time - end_time, formatted as MM:SS)
  - Transcript excerpt
  - Speaker label
  - **Editable captions:** Inline text inputs for LinkedIn and Reels captions
    - Blur/enter saves via `projectApi.updateClipCaption()` (PATCH endpoint)
  - Suggested hashtags (per platform)
  - Asset recommendation text
  - Memory notes (italicized -- explains agent reasoning)
  - **Approve/Reject buttons:** Click updates status via `projectApi.updateClipStatus()`
  - Status badge: pending (gray), approved (green), rejected (red)
- Clicking the thumbnail or timestamp seeks the video to that time (`onSeekTo`)
- **Conflict display:** If conflicts array is non-empty, show conflict cards at the top
- **Re-generation loading state:**
  - When `isRegenerating=true`: old cut list dims (opacity 0.5) with spinner overlay
  - WebSocket pushes new clips progressively -- each clip appears as it arrives

### 4. Create `frontend/src/components/PublishButton.jsx`

**Props:** `projectId`, `cuts`, `onPublished`

**Behavior:**
- Button labeled "Publish Approved Clips"
- Disabled if no clips have status "approved"
- Shows count: "Publish (3 clips)"
- On click, calls `projectApi.publishClips()` with list of approved clip_ids
- Shows confirmation toast
- Calls `onPublished` to refresh workspace state

### 5. Create `frontend/src/components/MemorySidebar.jsx`

**Props:** `styleMemory`, `projectMemory`, `isLoading`

**Behavior:**
- Sidebar panel showing agent memory state
- **Style Memory section:**
  - Preferred clip lengths per platform
  - Pacing preference
  - Hook style preference
  - Feedback patterns (bulleted list)
  - "Loaded from SF" indicator (shows cross-project memory origin)
- **Project Memory section:**
  - Brand voice rules
  - Target platforms
  - Speaker profiles with voice notes and quirks
  - Previous campaigns list
- **Learning trajectory indicator**
- Updates live after publish (refresh style_memory data)

### 6. Wire into ProjectWorkspace

Ensure all components are properly placed in the ProjectWorkspace layout:

```
+---------------------------------------------------+
|  SearchBar (full width)                            |
+-----------------------+---------------------------+
|  VideoTimeline        |  CutListPanel             |
|  (video player)       |  (clip cards)             |
|                       |                           |
|  FeedbackPanel        |                           |
|  (timestamp-synced)   |                           |
|                       |                           |
|  FeedbackInput        |  PublishButton            |
|  (comment input)      |                           |
|                       |                           |
|  StyleRefUpload       |  MemorySidebar            |
|  (drag-drop)          |  (prefs + memory)         |
+-----------------------+---------------------------+
```

### 7. WebSocket integration for streaming cuts

In ProjectWorkspace, manage a WebSocket connection for agent streaming:

```javascript
const ws = projectApi.createAgentWebSocket(projectId);
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'clip') {
    setCuts(prev => [...prev, message.data]);
  } else if (message.type === 'complete') {
    setIsRegenerating(false);
    if (message.conflicts) setConflicts(message.conflicts);
  }
};
```

## Acceptance Criteria
- [ ] FeedbackInput submits feedback with playhead-defaulted timestamp range
- [ ] StyleReferenceUpload accepts drag-drop video, shows upload progress
- [ ] CutListPanel shows clip cards with editable captions, approve/reject buttons
- [ ] Caption edits save on blur via PATCH endpoint
- [ ] Approve/reject updates clip status visually and via API
- [ ] PublishButton shows count, publishes approved clips, shows toast
- [ ] MemorySidebar shows style_memory, project_memory, learning trajectory
- [ ] WebSocket streaming shows clips appearing progressively during re-generation
- [ ] Conflict cards display at top of CutListPanel with both positions
- [ ] Re-generation dims old cuts with spinner overlay

## Output
This is the final frontend agent -- after this, the full 10-step demo flow should be walkable in the UI.

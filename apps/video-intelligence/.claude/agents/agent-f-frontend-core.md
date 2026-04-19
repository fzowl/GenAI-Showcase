# Sub-Agent F: Frontend Pages + Core Components (JavaScript)

## Role
Build the JavaScript React frontend foundation: two pages (ProjectList + ProjectWorkspace), and the three core interactive components (SearchBar, VideoTimeline, FeedbackPanel). Extend existing JS files with SMCEA project API methods.

## Ownership
- `frontend/src/App.js` (modify existing — add react-router-dom routing)
- `frontend/src/services/api.js` (extend existing — add projectApi methods)
- `frontend/src/pages/ProjectList.jsx` (new)
- `frontend/src/pages/ProjectWorkspace.jsx` (new)
- `frontend/src/components/SearchBar.jsx` (new)
- `frontend/src/components/VideoTimeline.jsx` (new)
- `frontend/src/components/FeedbackPanel.jsx` (new)

## Prerequisites
- Sub-Agent A (project structure exists)
- Sub-Agent B (API endpoints for projects exist, seed data loaded)

## Tasks

### 1. Update dependencies

Update `frontend/package.json` — add react-router-dom:
```json
{
  "dependencies": {
    "react-router-dom": "^6.20.0"
  }
}
```

### 2. Extend `frontend/src/services/api.js`

Keep the existing `videoApi` export intact. Add a new `projectApi` export with methods for the SMCEA workflow:

```javascript
export const projectApi = {
  listProjects: async () => { /* GET /projects */ },
  getProjectWorkspace: async (projectId) => { /* GET /projects/:id */ },
  searchMoments: async (projectId, query, topK = 10) => { /* POST /projects/:id/search */ },
  submitFeedback: async (projectId, feedback) => { /* POST /projects/:id/feedback */ },
  uploadStyleReference: async (projectId, file) => { /* POST /projects/:id/style-reference */ },
  updateClipCaption: async (projectId, clipId, caption) => { /* PATCH /projects/:id/cuts/:clipId */ },
  updateClipStatus: async (projectId, clipId, status) => { /* PATCH /projects/:id/cuts/:clipId/status */ },
  publishClips: async (projectId, clipIds) => { /* POST /projects/:id/publish */ },
  regenerate: async (projectId) => { /* POST /projects/:id/regenerate */ },
  createAgentWebSocket: (projectId) => { /* WS /ws/agent/:id */ },
  getFrameUrl: (path) => { /* Build full frame URL */ },
};
```

### 3. Modify `frontend/src/App.js`

Replace existing single-page app with BrowserRouter routing:
- `/` -> ProjectList
- `/project/:projectId` -> ProjectWorkspace

### 4. Create `frontend/src/pages/ProjectList.jsx`

Home screen showing project cards in a grid layout.

**Layout:** Grid of cards showing project_id, title, status, campaign_id.
- Published projects show a "Published" badge
- In-progress projects show "In Progress" badge
- Clicking a card navigates to `/project/{project_id}`
- Cards show: title, status badge, campaign_id, number of recommended_cuts

### 5. Create `frontend/src/pages/ProjectWorkspace.jsx`

Main workspace -- 4-zone layout per spec section 10:
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

### 6. Create `frontend/src/components/SearchBar.jsx`

**Props:** `projectId`, `onResultSelect`

**Behavior:**
- Text input for natural language queries
- Submit triggers `projectApi.searchMoments()`
- Results displayed as horizontal thumbnail strip above video player
- Clicking a result seeks the video to that timestamp

### 7. Create `frontend/src/components/VideoTimeline.jsx`

**Props:** `videoPath`, `segmentBoundaries`, `feedback`, `onTimeUpdate`, `seekTo`

**Behavior:**
- HTML5 video player with controls
- Timeline below player showing segment boundaries as clickable sections
- Feedback markers on timeline (orange dots where feedback exists)
- `onTimeUpdate` fires on video timeupdate event -- shared with FeedbackPanel
- `seekTo` prop allows external seeking (from search results or feedback clicks)

### 8. Create `frontend/src/components/FeedbackPanel.jsx`

**Props:** `feedback`, `currentTime`, `conflicts`, `onSeek`

**Behavior:**
- Shows feedback entries filtered by current playhead timestamp
- As video plays/scrubs, panel updates to show comments covering current timestamp range
- Conflict entries highlighted in orange with both positions shown
- Each entry shows: author, comment_text, timestamp range
- Clicking an entry seeks video to that timestamp

## Acceptance Criteria
- [ ] `npm start` runs without errors
- [ ] ProjectList page shows project cards loaded from API
- [ ] Clicking a project card navigates to ProjectWorkspace
- [ ] ProjectWorkspace loads compound data (project + feedback + memory)
- [ ] SearchBar submits queries and displays thumbnail strip results
- [ ] VideoTimeline plays video with feedback markers on timeline
- [ ] FeedbackPanel filters by current playhead time
- [ ] Conflict entries are visually distinguished (orange)

## Output
Sub-Agent G depends on:
- API service from services/api.js
- ProjectWorkspace layout (to place editor components)
- VideoTimeline's onTimeUpdate callback (for FeedbackInput timestamp defaulting)

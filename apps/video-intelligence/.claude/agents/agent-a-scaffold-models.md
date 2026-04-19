# Sub-Agent A: Project Scaffold + Models

## Role
Set up the project foundation by cloning the existing repo, updating dependencies, and creating all Pydantic models and schema definitions needed by every other sub-agent.

## Ownership
- `backend/models/schemas.py` (extend existing)
- `backend/requirements.txt` (extend existing)
- `backend/main.py` (surgical modifications only)
- `.env.example`
- `backend/.env` (template)

## Prerequisites
- None — this is the first agent to run

## Tasks

### 1. Clone existing repo
Clone `https://github.com/mongodb-developer/GenAI-Showcase.git` and copy `apps/video-intelligence/*` into the project root. Remove the parent repo wrapper — we only need the `backend/` and `frontend/` directories plus `start-dev.sh`.

### 2. Update `backend/requirements.txt`
Replace contents with pinned versions from spec:
```
fastapi>=0.104.1
uvicorn>=0.24.0
python-multipart>=0.0.6
opencv-python>=4.8.1.78
pillow>=10.1.0
pymongo>=4.6.0
voyageai==0.3.7
openai>=1.3.8
python-dotenv>=1.0.0
websockets>=12.0
numpy>=1.26.0
aiofiles>=23.2.1
anthropic>=0.90,<1.0
langgraph==1.1.5
langgraph-prebuilt==1.0.9
langgraph-checkpoint-mongodb==0.3.1
langgraph-store-mongodb==0.2.0
langchain-core>=0.3,<1.0
```

### 3. Extend `backend/models/schemas.py`
Keep existing models (VideoMetadata, SearchQuery, SearchResult, SearchResponse, UploadResponse). Add:

```python
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel
from datetime import datetime

# --- Project ---
class SegmentBoundary(BaseModel):
    start: float
    end: float
    speaker: str

class SuggestedCaption(BaseModel):
    linkedin: str
    reels: str
    twitter: Optional[str] = None

class SuggestedHashtags(BaseModel):
    linkedin: List[str]
    reels: List[str]

class SuggestedClip(BaseModel):
    clip_id: str
    start_time: float
    end_time: float
    thumbnail_path: Optional[str] = None
    transcript_excerpt: str
    speaker: str
    suggested_caption: SuggestedCaption
    suggested_hashtags: SuggestedHashtags
    asset_recommendation: str
    memory_notes: str
    status: Literal["pending", "approved", "rejected"] = "pending"

class StyleReference(BaseModel):
    pacing: Optional[str] = None
    hook_structure: Optional[str] = None
    caption_tone: Optional[str] = None
    format_notes: Optional[str] = None

class Project(BaseModel):
    project_id: str
    title: str
    video_id: Optional[str] = None
    video_path: Optional[str] = None
    campaign_id: str
    status: Literal["draft", "in_progress", "published"] = "draft"
    duration: Optional[float] = None
    segment_boundaries: List[SegmentBoundary] = []
    recommended_cuts: List[SuggestedClip] = []
    style_reference: Optional[StyleReference] = None
    created_at: Optional[datetime] = None
    last_agent_run: Optional[datetime] = None

# --- Feedback ---
class TimestampRange(BaseModel):
    start: float
    end: float

class FeedbackEntry(BaseModel):
    feedback_id: str
    project_id: str
    video_id: Optional[str] = None
    timestamp_range: TimestampRange
    author: str
    comment_text: str
    created_at: Optional[datetime] = None

class FeedbackSubmission(BaseModel):
    author: str
    comment_text: str
    playhead_time: float  # Frontend sends current playhead; backend maps to segment

# --- Memory ---
class PreferredClipLengths(BaseModel):
    reels: int = 15
    linkedin: int = 60
    twitter: int = 30

class StyleMemory(BaseModel):
    user_id: str
    preferred_clip_lengths: PreferredClipLengths
    pacing: str
    hook_style: str
    feedback_patterns: List[str] = []
    accepted_cuts: List[str] = []
    rejected_cuts: List[str] = []
    updated_at: Optional[datetime] = None

class SpeakerProfile(BaseModel):
    preferred_angle: Optional[str] = None
    voice_notes: str
    quirks: List[str] = []

class ProjectMemory(BaseModel):
    campaign_id: str
    event_name: str
    brand_voice_rules: str
    previous_campaigns: List[str] = []
    target_platforms: List[str] = []
    speaker_profiles: Dict[str, SpeakerProfile] = {}

class ContentMemoryEntry(BaseModel):
    clip_id: str
    project_id: str
    video_source: str
    hook_text: str
    embedding: Optional[List[float]] = None
    posted_at: Optional[datetime] = None
    platform: str

# --- API Requests/Responses ---
class ProjectSearchQuery(BaseModel):
    query: str
    top_k: int = 10

class ConflictInfo(BaseModel):
    timestamp: str
    authors: List[str]
    positions: List[str]

class CutListResponse(BaseModel):
    conflicts: List[ConflictInfo]
    feedback_patterns: List[str]
    recommended_cuts: List[SuggestedClip]

class PublishRequest(BaseModel):
    clip_ids: List[str]

class PublishResponse(BaseModel):
    published_count: int
    message: str

class CaptionEditRequest(BaseModel):
    suggested_caption: SuggestedCaption

class ClipStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]
```

### 4. Modify `backend/main.py`
Surgical changes only:
1. **Remove `video_path.unlink()`** — around line 217 in `process_video_async()`. Comment or delete the line that deletes the uploaded video after processing.
2. **Add uploads/ static mount** — serve uploaded videos for playback:
   ```python
   uploads_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
   uploads_dir.mkdir(parents=True, exist_ok=True)
   app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
   ```
3. **Add route imports** for new services (project_service, feedback_service, etc.) — add these as router includes. The actual router definitions are created by Sub-agents B, D, E, F.
4. **Add CORS for frontend dev server** — keep existing CORS config, ensure it allows the React dev server.

### 5. Create `.env.example`
```env
MONGODB_URI=mongodb+srv://...
DATABASE_NAME=video_intelligence
VOYAGE_AI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
FRAMES_DIR=frames
UPLOAD_DIR=uploads
FRONTEND_URL=http://localhost:3000
EMBEDDING_DIM_SIZE=1024
DEMO_FALLBACK_MODE=false
```

## Acceptance Criteria
- [ ] Project structure matches: `backend/` + `frontend/` at root level
- [ ] `pip install -r backend/requirements.txt` succeeds
- [ ] All Pydantic models import without errors: `python -c "from models.schemas import *"`
- [ ] `backend/main.py` starts without errors: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
- [ ] `video_path.unlink()` is removed
- [ ] `/uploads` static mount works
- [ ] `.env.example` exists with all required variables

## Output
Other agents depend on:
- Pydantic models for type safety
- requirements.txt for dependency availability
- main.py route structure for endpoint registration

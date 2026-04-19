# Sub-Agent B: MongoDB Service + Seed Data

## Role
Extend the existing MongoDB service with new collection operations (projects, feedback, memory) and create the complete seed data script that populates the demo's 4 projects, 9 feedback entries, content memory trajectory, and style memory.

## Ownership
- `backend/services/mongodb_service.py` (extend existing)
- `backend/services/project_service.py` (new — FastAPI router)
- `scripts/seed_data.py` (new)
- `scripts/create_indexes.py` (new)

## Prerequisites
- Sub-Agent A must complete first (models/schemas available)

## Tasks

### 1. Extend `backend/services/mongodb_service.py`
Keep ALL existing methods. Add new collection references and methods:

**New collections** (add to `__init__` and `connect`):
```python
self.projects_collection: Optional[Collection] = None      # "projects"
self.feedback_collection: Optional[Collection] = None       # "stakeholder_feedback"
self.style_memory_collection: Optional[Collection] = None   # "style_memory"
self.content_memory_collection: Optional[Collection] = None # "content_memory"
self.project_memory_collection: Optional[Collection] = None # "project_memory"
self.published_clips_collection: Optional[Collection] = None # "published_clips"
```

**New methods to add:**

```python
# --- Projects ---
async def get_all_projects(self) -> List[Dict]:
    """Return all projects sorted by status (in_progress first, then published)"""

async def get_project(self, project_id: str) -> Optional[Dict]:
    """Get a single project document"""

async def create_project(self, project: Dict) -> str:
    """Insert a new project"""

async def update_project(self, project_id: str, updates: Dict):
    """Update project fields (used for recommended_cuts, style_reference, status, last_agent_run)"""

# --- Feedback ---
async def get_feedback_for_project(self, project_id: str) -> List[Dict]:
    """All feedback sorted by timestamp_range.start"""

async def get_feedback_at_timestamp(self, project_id: str, timestamp: float) -> List[Dict]:
    """Feedback entries whose timestamp_range covers the given timestamp"""

async def insert_feedback(self, feedback: Dict) -> str:
    """Insert a feedback entry"""

# --- Style Memory ---
async def get_style_memory(self, user_id: str) -> Optional[Dict]:
    """Get style memory for a user (keyed by user_id, NOT project_id — cross-project)"""

async def upsert_style_memory(self, user_id: str, updates: Dict):
    """Upsert style memory document"""

# --- Project Memory ---
async def get_project_memory(self, campaign_id: str) -> Optional[Dict]:
    """Get project memory by campaign_id"""

# --- Content Memory ---
async def search_content_memory(self, embedding: List[float], threshold: float = 0.85, top_k: int = 5) -> List[Dict]:
    """Vector search against content_memory to find similar previously published clips.
    Uses content_vector_idx (dotProduct on embedding field, 1024d voyage-4 space).
    Returns entries with cosine similarity > threshold."""

async def insert_content_memory(self, clip_doc: Dict) -> str:
    """Insert a published clip into content_memory"""

# --- Published Clips ---
async def insert_published_clips(self, clips: List[Dict]):
    """Batch insert published clips"""

# --- Compound Read (the key project load operation) ---
async def load_project_workspace(self, project_id: str) -> Dict:
    """Single compound read that returns:
    - project document
    - all feedback for that project
    - style_memory for user_id='editor_mikiko'
    - project_memory for the project's campaign_id
    Use asyncio.gather or sequential reads (PyMongo is sync)."""
```

**Important:** The existing service uses synchronous PyMongo. Keep that pattern. The `async` methods just wrap sync calls (same as existing code does).

### 2. Create `backend/services/project_service.py`
FastAPI router with endpoints:

```python
from fastapi import APIRouter, HTTPException
router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/")
async def list_projects():
    """GET /projects — home screen project cards"""

@router.get("/{project_id}")
async def get_project_workspace(project_id: str):
    """GET /projects/{project_id} — compound read: project + feedback + style_memory + project_memory"""

@router.post("/")
async def create_project(project: Project):
    """POST /projects — create new project"""
```

Register this router in `main.py`:
```python
from services.project_service import router as project_router
app.include_router(project_router)
```

### 3. Create `scripts/seed_data.py`
Complete seed script that populates all demo data. Must be runnable standalone:
```bash
cd backend && python -m scripts.seed_data
```

**Four projects** (from spec section 8):
| project_id | title | status | campaign_id | Purpose |
|------------|-------|--------|-------------|---------|
| proj_austin | .local Austin 2025 | published | local_austin_2025 | Earliest, generic captions |
| proj_nyc | .local New York 2025 | published | local_nyc_2025 | Starting to learn |
| proj_sf | .local SF 2026 | published | local_sf_2026 | Strong captions, cross-project memory visible |
| proj_london | MongoDB .local London 2026 Keynote | in_progress | local_london_2026 | Main demo workspace |

Projects A-C need minimal docs (project_id, title, status, campaign_id). Project C (SF) needs a few recommended_cuts. Project D (London) is the full workspace with:
- duration: 1440.0
- segment_boundaries (generate ~10 segments spanning the duration)
- 5 recommended_cuts (from spec page 15-18 — copy exactly)
- video_path: "uploads/uuid.mp4" (placeholder)

**9 stakeholder feedback entries for proj_london** (from spec page 15):

CJ — CEO (4 comments):
- @ 2:34–3:12 "Make sure you get my good side. The left camera angle is better for this segment."
- @ 8:15–8:45 "This is the money quote about developer experience. Lead with this for LinkedIn."
- @ 14:20–15:00 "Cut this part — I misspoke about the timeline."
- @ 22:10–23:30 "The audience reaction was great. Use the wide shot."

Oz — VP Engineering (3 comments):
- @ 5:00–6:30 "Resilience section needs to be a standalone clip. Core message for enterprise."
- @ 14:20–15:00 **CONFLICT** "Keep this — the correction makes CJ more relatable. Real > polished."
- @ 18:00–19:15 "Atlas Vector Search demo — caption must explain what vector search does. No jargon."

Sarah K. — PMM (2 comments):
- @ 8:15–8:45 "For Reels, trim to just the last sentence. Setup too long for short-form."
- @ 22:10–23:30 "Add text overlay with the key stat. Numbers perform 2x on social."

**Content memory** (8 entries showing Austin → NYC → SF learning trajectory — from spec pages 17-20):
Copy the exact entries from the spec. Austin clips have generic captions ("Check out highlights from our Austin event!"), NYC clips are better ("MongoDB Atlas now handles 10x the throughput"), SF clips are strong ("Here's what developers are actually building with agents").

Note: sf_clip_002 should have high similarity to London cut_002 so the agent flags the dupe.

**Style memory** for editor_mikiko (from spec page 20):
```python
{
    "user_id": "editor_mikiko",
    "preferred_clip_lengths": {"reels": 15, "linkedin": 60, "twitter": 30},
    "pacing": "fast_cuts",
    "hook_style": "question_first",
    "feedback_patterns": [
        "consistently flags pacing issues for Reels",
        "prefers question-first hooks",
        "favors audience reaction shots over speaker close-ups"
    ],
    "accepted_cuts": ["austin_clip_001", "austin_clip_002", "nyc_clip_001", "nyc_clip_002", "sf_clip_001", "sf_clip_002", "sf_clip_003"],
    "rejected_cuts": ["austin_draft_003", "nyc_draft_003", "sf_draft_004"],
    "updated_at": datetime(2026, 3, 17, 12, 0, 0)
}
```

**Project memory** for local_london_2026 (from spec page 6-7):
```python
{
    "campaign_id": "local_london_2026",
    "event_name": "MongoDB .local London 2026",
    "brand_voice_rules": "Professional but approachable. No jargon.",
    "previous_campaigns": ["local_austin_2025", "local_nyc_2025", "local_sf_2026"],
    "target_platforms": ["linkedin", "twitter", "reels"],
    "speaker_profiles": {
        "CJ": {
            "preferred_angle": "left camera",
            "voice_notes": "Conversational, uses developer analogies",
            "quirks": ["always says 'and that's the thing' before key points"]
        },
        "Oz": {
            "voice_notes": "Technical, precise, enterprise framing",
            "quirks": []
        }
    }
}
```

The script should:
1. Connect to MongoDB using MONGODB_URI from .env
2. Clear existing data in all collections (idempotent re-runs)
3. Insert all seed data
4. Print summary of what was inserted
5. Verify counts

### 4. Create `scripts/create_indexes.py`
Create the 5 MongoDB indexes from spec section 12:

| Collection | Index Name | Type | Fields |
|------------|-----------|------|--------|
| video_segments (frame_intelligence) | vector_search_index | Vector 1024d cosine | embedding |
| video_segments (frame_intelligence) | text_search_index | Full-text | description, transcript, transcript_summary |
| content_memory | content_vector_idx | Vector 1024d dotProduct | embedding |
| stakeholder_feedback | feedback_by_project | Compound | project_id + timestamp_range.start |
| projects | project_by_status | Standard | status |

Note: The existing code already creates vector_search_index and text_search_index on frame_intelligence. The text_search_index needs to be modified to also include `transcript` and `transcript_summary` fields. The other 3 indexes are new.

## Acceptance Criteria
- [ ] `python -m scripts.seed_data` runs successfully and populates all collections
- [ ] `GET /projects` returns 4 projects (Austin, NYC, SF, London)
- [ ] `GET /projects/proj_london` returns compound workspace with feedback, style_memory, project_memory
- [ ] `python -m scripts.create_indexes` creates all 5 indexes
- [ ] Content memory has 8 entries spanning Austin → NYC → SF
- [ ] Feedback includes the CJ/Oz conflict at 14:20–15:00
- [ ] Re-running seed script is idempotent (clears and re-inserts)

## Output
Other agents depend on:
- MongoDB service methods for reading/writing all collections
- Seed data being present for frontend development and agent testing
- Project service endpoints for frontend integration

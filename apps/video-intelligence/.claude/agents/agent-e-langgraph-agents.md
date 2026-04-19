# Sub-Agent E: Agent Service (LangGraph)

## Role
Build the core LangGraph agent layer — the Social Agent that generates cut lists with per-platform captions, handles conflict detection, feedback pattern analysis, and human-in-the-loop interrupts. This is the most complex component and the demo's centerpiece.

## Ownership
- `backend/services/agent_service.py` (new)
- `backend/services/feedback_service.py` (new — FastAPI router)
- `backend/services/publish_service.py` (new — FastAPI router)

## Prerequisites
- Sub-Agent A (schemas)
- Sub-Agent B (MongoDB service methods)
- Sub-Agent D (AI service methods — Claude client, text embeddings)

## Tasks

### 1. Create `backend/services/feedback_service.py`

FastAPI router for feedback operations.

```python
from fastapi import APIRouter
router = APIRouter(prefix="/projects", tags=["feedback"])

@router.get("/{project_id}/feedback")
async def get_feedback(project_id: str):
    """All feedback sorted by timestamp_range.start"""

@router.get("/{project_id}/feedback/at/{timestamp}")
async def get_feedback_at_timestamp(project_id: str, timestamp: float):
    """Feedback entries covering a specific timestamp"""

@router.post("/{project_id}/feedback")
async def submit_feedback(project_id: str, feedback: FeedbackSubmission):
    """Submit new feedback.

    TIMESTAMP RANGE DEFAULT: The editor submits with playhead_time.
    Backend looks up project.segment_boundaries to find the covering segment
    and uses that as the timestamp_range. Frontend sends current playhead time;
    backend maps to segment boundary.

    After storing feedback:
    1. Insert into stakeholder_feedback collection
    2. Trigger Social Agent re-generation (auto)
    """
```

### 2. Create `backend/services/agent_service.py`

This is the core agent file. Key components:

#### MongoDBSaver (checkpointer)
```python
from langgraph.checkpoint.mongodb import MongoDBSaver
import os

MONGODB_URI = os.getenv("MONGODB_URI")
saver = MongoDBSaver.from_conn_string(MONGODB_URI, db_name="video_intelligence")
```

#### Conflict Detection (code-only, no LLM)
```python
CUT_WORDS = {"cut", "remove", "drop", "delete", "skip", "lose"}
KEEP_WORDS = {"keep", "include", "use", "love", "great", "perfect"}

def ranges_overlap(a: Dict, b: Dict) -> bool:
    """Check if two timestamp ranges overlap"""
    return a["timestamp_range"]["start"] < b["timestamp_range"]["end"] and \
           b["timestamp_range"]["start"] < a["timestamp_range"]["end"]

def detect_conflicts(feedback_entries: List[Dict]) -> List[Dict]:
    """Group by overlapping timestamp ranges, flag where
    different authors give contradictory direction.
    Uses keyword heuristics — no LLM call needed.
    Runs in microseconds, catches all pre-seeded demo cases."""
    conflicts = []
    for i, a in enumerate(feedback_entries):
        for b in feedback_entries[i+1:]:
            if a["author"] != b["author"] and ranges_overlap(a, b):
                words_a = set(a["comment_text"].lower().split())
                words_b = set(b["comment_text"].lower().split())
                a_cuts = bool(words_a & CUT_WORDS)
                b_keeps = bool(words_b & KEEP_WORDS)
                a_keeps = bool(words_a & KEEP_WORDS)
                b_cuts = bool(words_b & CUT_WORDS)
                if (a_cuts and b_keeps) or (a_keeps and b_cuts):
                    conflicts.append({
                        "entries": [a, b],
                        "timestamp": a["timestamp_range"]
                    })
    return conflicts
```

#### Social Agent (merged prompt)
The Social Agent uses ONE Claude call with a merged prompt that handles:
- Conflict detection output (from code-only function above)
- Feedback pattern extraction
- Cut list generation

**System prompt** (cached across calls within session via Anthropic prompt caching):
```
You are the Social Agent — a social media content editor agent. You analyze keynote
video segments and produce clip recommendations with per-platform captions.

CONTEXT PROVIDED TO YOU:
- Video segments with transcripts and speaker labels
- Stakeholder feedback (timestamped comments from multiple reviewers)
- Editor preferences from style_memory (clip lengths, pacing, hook style)
- Brand voice rules from project_memory
- Speaker profiles from project_memory (voice notes, preferred angles, quirks)
- Content memory (previously published clips — avoid duplicates)
- Style reference analysis (if uploaded — match pacing and tone)

CONFLICT RESOLUTION:
When two reviewers give contradictory feedback on the same segment,
DO NOT resolve it yourself. Present both positions and ask the editor
to decide. Format: "Conflict at [timestamp]: [Author A] says [X],
[Author B] says [Y]. Which direction do you prefer?"

CLIP GENERATION RULES:
1. Respect editor's preferred clip lengths per platform from style_memory
2. Check every candidate clip against content_memory — if cosine similarity
   > 0.85 with any published clip, flag it with a warning
3. Apply brand_voice_rules to all captions
4. If speaker_profiles exist for the speaker in a clip, incorporate their
   preferences into memory_notes and match their voice/tone in caption copy
5. If a style_reference exists, match its pacing and tone
6. For each clip, include memory_notes explaining your reasoning
7. Include suggested_hashtags (3-5 relevant hashtags per platform)
8. Include asset_recommendation (what visual treatment would make it land)

RESPONSE FORMAT:
Respond with a single JSON object containing exactly three keys:
{
  "conflicts": [...],
  "feedback_patterns": [...],
  "recommended_cuts": [...]
}
```

#### Agent creation with HITL middleware
```python
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.types import Command

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[search_tool, generate_cuts_tool, publish_tool],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "generate_cuts": True,   # pause before generating
                "publish_clips": True,   # pause before publishing
                "search_segments": False, # auto-approve
            },
            description_prefix="Editor approval needed",
        ),
    ],
    checkpointer=saver,
)
```

**Known issue:** `.ainvoke()` with HITL middleware can throw errors (GitHub #34974). **Use sync `.invoke()` or `.stream()` for the keynote.**

Pin `langgraph-prebuilt==1.0.9` explicitly — v1.0.2 had a breaking change.

#### Trigger regeneration
```python
async def trigger_regeneration(project_id: str):
    """Called when feedback is submitted, style reference uploaded,
    or manual regenerate button pressed.

    Pipeline:
    1. Fetch all feedback for project (parallel with step 2-5)
    2. Fetch style_memory for user_id='editor_mikiko'
    3. Fetch content_memory via vector search (for dupe detection)
    4. Fetch project_memory brand rules
    5. Fetch style_reference (if exists)
    6. Run detect_conflicts() — code only, no LLM
    7. Build merged prompt with all context
    8. Single Claude call → get conflicts + patterns + cuts
    9. Update style_memory.feedback_patterns
    10. Overwrite project.recommended_cuts
    11. Stream results via WebSocket

    Steps 1-5 should use asyncio.gather for parallel reads.
    """
```

#### WebSocket streaming
Stream cut JSON via WebSocket so first clip appears in ~3s:
```python
# Each clip streamed as it completes
async def stream_cuts(websocket, project_id: str):
    # ... run generation ...
    for clip in recommended_cuts:
        await websocket.send_json({"type": "clip", "data": clip})
    await websocket.send_json({"type": "complete"})
```

Add WebSocket endpoint in main.py:
```python
@app.websocket("/ws/agent/{project_id}")
async def agent_websocket(websocket: WebSocket, project_id: str):
    """WebSocket for streaming agent cut generation results"""
```

### 3. Create `backend/services/publish_service.py`

FastAPI router for publish operations.

```python
from fastapi import APIRouter
router = APIRouter(prefix="/projects", tags=["publish"])

@router.post("/{project_id}/publish")
async def publish_clips(project_id: str, request: PublishRequest):
    """Publish approved clips.

    Actions:
    1. Write approved clips to published_clips collection
    2. For each clip, embed hook_text via Voyage voyage-4 API call
    3. Insert into content_memory (with embedding for future dupe detection)
    4. Update style_memory: add clip_ids to accepted_cuts
    5. Set project status to 'published'
    6. Return confirmation

    Demo talking point: 'Today we call Voyage directly to embed content_memory
    entries on publish. When Atlas Automated Embedding goes GA, this code
    disappears — the database handles it natively.'
    """

@router.patch("/{project_id}/cuts/{clip_id}")
async def update_clip_caption(project_id: str, clip_id: str, edit: CaptionEditRequest):
    """Edit a clip's suggested_caption. Saves to project.recommended_cuts[n].suggested_caption.
    Simple field update."""

@router.patch("/{project_id}/cuts/{clip_id}/status")
async def update_clip_status(project_id: str, clip_id: str, update: ClipStatusUpdate):
    """Approve or reject a clip. Updates project.recommended_cuts[n].status."""

@router.post("/{project_id}/regenerate")
async def manual_regenerate(project_id: str):
    """Manual regenerate button. Triggers agent_service.trigger_regeneration()."""
```

### 4. Handle DEMO_FALLBACK_MODE
When `DEMO_FALLBACK_MODE=true`:
- `trigger_regeneration` returns the pre-seeded recommended_cuts from the project document
- No Claude API call is made
- Conflicts are still detected via code-only function (always works)
- Publish writes to DB but skips Voyage embedding call (uses zero vectors)

## Acceptance Criteria
- [ ] `POST /projects/proj_london/feedback` stores feedback and triggers re-generation
- [ ] Conflict at 14:20–15:00 between CJ ("Cut this part") and Oz ("Keep this") is detected
- [ ] Social Agent produces JSON with conflicts, feedback_patterns, recommended_cuts
- [ ] Each recommended_cut has: clip_id, timestamps, transcript_excerpt, speaker, suggested_caption (per-platform), suggested_hashtags, asset_recommendation, memory_notes, status
- [ ] HITL middleware pauses on generate_cuts and publish_clips
- [ ] WebSocket streams individual clips as they're generated
- [ ] `POST /projects/proj_london/publish` writes to published_clips + content_memory
- [ ] Content memory entries include voyage-4 embeddings
- [ ] Style memory is updated with accepted/rejected cuts after publish
- [ ] DEMO_FALLBACK_MODE returns cached cuts without API calls
- [ ] Manual regenerate endpoint triggers full pipeline

## Output
Other agents depend on:
- Feedback endpoints for frontend FeedbackInput/FeedbackPanel
- Agent WebSocket for frontend CutListPanel streaming
- Publish endpoint for frontend PublishButton
- Regenerate endpoint for style reference upload trigger

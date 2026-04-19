# Sub-Agent H: Integration + Polish

## Role
Wire everything together, implement DEMO_FALLBACK_MODE, run end-to-end verification of the 10-step demo flow, and apply latency optimizations. This is the final agent that ensures the demo works as a cohesive whole.

## Ownership
- Integration testing across all components
- `DEMO_FALLBACK_MODE` implementation (env var flag)
- Latency optimizations
- `backend/main.py` (final router wiring)
- `CLAUDE.md` for the project

## Prerequisites
- ALL other sub-agents must complete first (A through G)

## Tasks

### 1. Final router wiring in `backend/main.py`

Ensure all routers are registered:
```python
from services.project_service import router as project_router
from services.feedback_service import router as feedback_router
from services.style_ref_service import router as style_ref_router
from services.publish_service import router as publish_router

app.include_router(project_router)
app.include_router(feedback_router)
app.include_router(style_ref_router)
app.include_router(publish_router)
```

Add the agent WebSocket endpoint:
```python
@app.websocket("/ws/agent/{project_id}")
async def agent_websocket(websocket: WebSocket, project_id: str):
    await websocket.accept()
    try:
        from services.agent_service import stream_cuts
        await stream_cuts(websocket, project_id)
    except WebSocketDisconnect:
        pass
```

### 2. DEMO_FALLBACK_MODE

Implement `DEMO_FALLBACK_MODE` env var across all services. When `true`:
- All external API calls (Voyage, OpenAI, Anthropic) return cached/pre-computed results
- The presenter can flip this backstage if network is unreliable
- Per-call timeouts with automatic fallback to cached results

**Services to update:**
- `ai_service.py`: Skip Voyage embed, rerank, Claude calls → return cached results
- `audio_service.py`: Skip OpenAI STT → return pre-seeded transcript data
- `agent_service.py`: Skip Claude generation → return pre-seeded recommended_cuts
- `publish_service.py`: Skip Voyage text embedding → use zero vectors
- `style_ref_service.py`: Skip Claude style analysis → return pre-defined style

**Implementation pattern:**
```python
import os
DEMO_FALLBACK = os.getenv("DEMO_FALLBACK_MODE", "false").lower() == "true"

async def some_api_call():
    if DEMO_FALLBACK:
        return CACHED_RESPONSE
    try:
        result = await actual_api_call()
        return result
    except Exception:
        logger.warning("API call failed, using fallback")
        return CACHED_RESPONSE
```

### 3. Latency optimizations (from spec section 11)

Apply the 10 optimizations:

| # | Optimization | Where |
|---|-------------|-------|
| 1 | Merge 3 Claude calls into 1 merged prompt (conflicts + patterns + cuts) | agent_service.py |
| 2 | Skip Claude router for search — hardcode hybrid | project_service.py search endpoint |
| 3 | Code-only conflict detection with keyword heuristics | agent_service.py detect_conflicts() |
| 4 | Stream Claude response via SSE/WebSocket — first clip in ~3s | agent_service.py + main.py WebSocket |
| 5 | Anthropic prompt caching on system prompt + memory context | agent_service.py (cache_control block) |
| 6 | Pre-warm Social Agent on project load | project_service.py get_project_workspace() |
| 7 | Pre-process demo style reference clip | scripts/seed_data.py |
| 8 | Connection pooling + parallel I/O with asyncio.gather | mongodb_service.py load_project_workspace() |
| 9 | Use Haiku for standalone pattern detection (if not using merged prompt) | agent_service.py |
| 10 | Set max_tokens tightly on all Claude calls | All Claude calls |

**Target latencies:**
| Operation | Target |
|-----------|--------|
| Project load | < 1s |
| Search | < 2s |
| Re-generation | < 5s |
| Style reference | < 6s |
| Publish | < 1s |

### 4. Connection pooling

Ensure MongoDB connection pool is warm on startup:
```python
# In main.py lifespan
async def lifespan(app: FastAPI):
    await mongodb_service.connect()
    # Warm the connection pool
    await mongodb_service.get_all_projects()
    logger.info("Connection pool warmed")
    yield
    await mongodb_service.disconnect()
```

### 5. End-to-end verification — 10-step demo flow

Walk through the complete demo flow and verify each step:

**Step 1: Open app, select project**
- [ ] GET /projects returns 4 project cards
- [ ] Cards show: title, status badge, campaign_id
- [ ] Click "MongoDB .local London 2026 Keynote" → navigate to workspace

**Step 2: Project loads with state**
- [ ] GET /projects/proj_london returns compound workspace
- [ ] Video player shows (or placeholder if no video file)
- [ ] Existing recommended_cuts displayed in CutListPanel
- [ ] Feedback markers visible on timeline
- [ ] MemorySidebar shows style_memory + project_memory

**Step 3: Search for moments**
- [ ] Type "developer experience" in SearchBar
- [ ] POST /projects/proj_london/search returns reranked results
- [ ] Results appear as thumbnail strip
- [ ] Clicking a result seeks video to timestamp

**Step 4: Scrub video, see feedback**
- [ ] As video plays, FeedbackPanel updates to show covering comments
- [ ] At 14:20, conflict between CJ ("Cut this") and Oz ("Keep this") shown in orange

**Step 5: Add new feedback**
- [ ] Pause video, type feedback in FeedbackInput
- [ ] Timestamp range defaults to current segment boundary
- [ ] Submit stores feedback and triggers re-generation

**Step 6: Agent re-generates**
- [ ] Old cuts dim with spinner
- [ ] WebSocket streams new clips progressively
- [ ] Conflict card appears at top of CutListPanel
- [ ] style_memory.feedback_patterns updated

**Step 7: Upload style reference**
- [ ] Drag Instagram clip into StyleReferenceUpload
- [ ] Style analysis appears (pacing, hook_structure, caption_tone)
- [ ] Triggers another re-generation

**Step 8: Agent adjusts cuts + copy**
- [ ] Re-generated cuts reflect style reference
- [ ] Captions match the uploaded clip's tone

**Step 9: Approve + publish**
- [ ] Approve 3 clips (click approve buttons)
- [ ] Click "Publish (3 clips)"
- [ ] Toast: "3 clips sent to social team. Content memory updated."
- [ ] content_memory updated with new entries
- [ ] style_memory updated with accepted_cuts

**Step 10: Switch to another project**
- [ ] Navigate back to ProjectList
- [ ] Open proj_sf (or another project)
- [ ] Agent's recommended cuts already reflect editor preferences from London
- [ ] This is the cross-project memory payoff

### 6. Create project CLAUDE.md

Create `CLAUDE.md` at project root with:
- Project overview
- How to run (backend + frontend)
- Environment variables
- Key architectural decisions
- What NOT to change (per spec section 15)

## Acceptance Criteria
- [ ] All 10 demo steps verified end-to-end
- [ ] DEMO_FALLBACK_MODE works — demo runs without any API keys
- [ ] Target latencies met (project load <1s, search <2s, regen <5s)
- [ ] No errors in frontend build
- [ ] No Python import errors in backend
- [ ] Backend starts cleanly: `uvicorn main:app`
- [ ] Frontend starts cleanly: `npm start`
- [ ] Cross-project memory payoff visible (Step 10)
- [ ] Conflict at 14:20–15:00 detected and displayed correctly
- [ ] WebSocket streaming works for cut generation
- [ ] CLAUDE.md exists with run instructions

## Output
This is the final agent — project should be demo-ready after this.

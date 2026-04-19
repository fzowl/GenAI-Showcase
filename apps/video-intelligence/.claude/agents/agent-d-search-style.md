# Sub-Agent D: Search (Keynote Agent) + Style Reference

## Role
Build the search pipeline with Voyage AI reranking and the style reference upload service. The search pipeline is the "Keynote Agent" from the spec — it handles natural language queries against the video corpus using hybrid search + reranking.

## Ownership
- `backend/services/ai_service.py` (extend existing — add reranking, update embedding model)
- `backend/services/style_ref_service.py` (new — FastAPI router)
- Search endpoint on project router (added to project_service.py or separate file)

## Prerequisites
- Sub-Agent A (schemas, dependencies)
- Sub-Agent B (MongoDB service methods for projects, content_memory)

## Tasks

### 1. Update `backend/services/ai_service.py`

**Update embedding model:**
The existing code uses `voyage-multimodal-3`. Update to `voyage-multimodal-3.5`:
```python
# In get_voyage_embedding method:
result = await loop.run_in_executor(
    None,
    lambda: self.voyage_client.multimodal_embed(
        inputs=[[embed_data]],
        model="voyage-multimodal-3.5",  # was "voyage-multimodal-3"
        input_type=input_type,
    ),
)
```

**Add text embedding method (voyage-4 for content_memory):**
```python
async def get_text_embedding(self, text: str, input_type: str = "document") -> List[float]:
    """Get text embedding using voyage-4 (for content_memory).
    IMPORTANT: voyage-multimodal-3.5 and voyage-4 are in DIFFERENT embedding spaces.
    Cannot mix in the same index. video_segments uses multimodal-3.5, content_memory uses voyage-4."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: self.voyage_client.embed(
            texts=[text],
            model="voyage-4",
            input_type=input_type,
        ),
    )
    return result.embeddings[0]
```

**Add Voyage rerank-2.5 method:**
```python
async def rerank_results(self, query: str, documents: List[str], top_k: int = 10) -> List[Dict]:
    """Rerank search results using Voyage rerank-2.5.
    This is a cross-encoder that jointly processes query + each document
    for more accurate relevance scoring than embedding similarity alone.

    NOTE: rerank-2.5 supports instruction-following via query prepend.
    We prepend task-specific instructions to steer relevance scoring.

    Args:
        query: Original search query
        documents: List of transcript texts from candidate segments
        top_k: Number of results to return

    Returns: List of {index, relevance_score} sorted by score descending
    """
    import voyageai
    vo = voyageai.Client()

    instruction = "Prioritize segments where the speaker directly addresses the audience. "
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: vo.rerank(
            query=instruction + query,
            documents=documents,
            model="rerank-2.5",
            top_k=top_k,
        ),
    )
    return [{"index": r.index, "relevance_score": r.relevance_score} for r in result.results]
```

**Add Claude client for style analysis:**
```python
def _initialize_clients(self):
    # ... existing code ...
    # Add Anthropic client
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_api_key:
        import anthropic
        self.anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)
        logger.info("Anthropic client initialized")

async def analyze_style_reference(self, frames: List[str]) -> Dict:
    """Analyze style from reference clip frames via Claude.
    Prompt from spec section 6:

    'Analyze these frames from a social media reference clip.
    Describe the style in terms of:
    - pacing: how many cuts per 10 seconds, average shot duration
    - hook_structure: how the first 2 seconds grab attention
    - caption_tone: formal/casual/playful, emoji usage, sentence length
    - format_notes: aspect ratio, text overlay style, any trending patterns

    Return as JSON matching: {
        "pacing": "...",
        "hook_structure": "...",
        "caption_tone": "...",
        "format_notes": "..."
    }'
    """
```

### 2. Add search endpoint with reranking

Add to the project router or create a dedicated search file. Endpoint: `POST /projects/{project_id}/search`

**Pipeline (hardcoded hybrid — skip Claude router for latency):**
1. Receive query text
2. Embed query via Voyage multimodal-3.5 (for vector search)
3. Run hybrid search (vector + full-text) against video_segments — reuse existing `mongodb_service.hybrid_search()`
4. Rerank top candidates with Voyage rerank-2.5
5. Return reranked results as thumbnail strip

```python
@router.post("/{project_id}/search")
async def search_moments(project_id: str, query: ProjectSearchQuery):
    """Keynote Agent: hybrid search + reranking.
    Hardcoded hybrid (skip Claude router — latency optimization)."""

    # 1. Embed query
    query_embedding = await ai_service.get_query_embedding(query.query)

    # 2. Hybrid search (existing method)
    candidates = await mongodb_service.hybrid_search(
        query.query, query_embedding, top_k=query.top_k * 2,
        video_filter=project.get("video_id")
    )

    # 3. Rerank with Voyage rerank-2.5
    if candidates:
        transcripts = [c.get("transcript", c.get("description", "")) for c in candidates]
        reranked = await ai_service.rerank_results(query.query, transcripts, top_k=query.top_k)
        results = [candidates[r["index"]] for r in reranked]
    else:
        results = candidates

    # 4. Return as SearchResponse
    return {"query": query.query, "results": results, "total_results": len(results)}
```

**Demo talking point:** "We're not just searching — we're reranking with a cross-encoder that jointly processes the query and each document. And with rerank-2.5, we can steer the reranker with instructions — like telling it to prioritize audience-facing moments over backstage commentary."

### 3. Create `backend/services/style_ref_service.py`

FastAPI router for style reference upload.

**Endpoint:** `POST /projects/{project_id}/style-reference`

**Pipeline:**
1. Accept video file upload (Instagram/TikTok clip)
2. Extract frames at 1 frame/second via ffmpeg
3. Embed frames via Voyage multimodal-3.5 (for potential future similarity search)
4. Send frames to Claude for style analysis
5. Store style analysis on project document (`project.style_reference`)
6. Trigger Social Agent re-generation (call agent_service)

**Style matching is LIMITED to:** pacing/timing recs, caption tone, format suggestions. NOT visual transformation.

**Voyage multimodal limits:** Max 20MB per video, max 16M pixels per image, max 32k tokens per input. Most Instagram/TikTok clips are under 20MB. If exceeds limit, ffmpeg-compress before embedding.

```python
from fastapi import APIRouter, UploadFile, File
router = APIRouter(prefix="/projects", tags=["style-reference"])

@router.post("/{project_id}/style-reference")
async def upload_style_reference(project_id: str, file: UploadFile = File(...)):
    """Upload a reference clip, analyze its style, store on project, trigger re-gen."""

    # 1. Save uploaded file
    # 2. Extract frames at 1/s via ffmpeg
    # 3. Analyze style via Claude (ai_service.analyze_style_reference)
    # 4. Store on project: mongodb_service.update_project(project_id, {"style_reference": analysis})
    # 5. Trigger re-generation: agent_service.trigger_regeneration(project_id)
    # 6. Return style analysis
```

### 4. Handle DEMO_FALLBACK_MODE
When `DEMO_FALLBACK_MODE=true`:
- `rerank_results` returns candidates in original order (skip API call)
- `analyze_style_reference` returns a pre-defined style analysis
- Search falls back to existing hybrid without reranking

## Acceptance Criteria
- [ ] `POST /projects/proj_london/search` with query "developer experience" returns reranked results
- [ ] Reranking uses Voyage rerank-2.5 with instruction prepend
- [ ] Embedding model updated from voyage-multimodal-3 to voyage-multimodal-3.5
- [ ] Text embedding via voyage-4 works for content_memory entries
- [ ] Style reference upload extracts frames, analyzes via Claude, stores on project
- [ ] DEMO_FALLBACK_MODE gracefully skips reranking and style analysis API calls
- [ ] Search results include transcript, speaker_label, thumbnail_path

## Output
Other agents depend on:
- Reranked search results for the frontend SearchBar component
- Style analysis stored on project for the Social Agent's cut generation
- Text embedding method for publish_service content_memory writes

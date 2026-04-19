import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import anthropic

from services.mongodb_service import mongodb_service

logger = logging.getLogger(__name__)

DEMO_FALLBACK_MODE = os.getenv("DEMO_FALLBACK_MODE", "false").lower() == "true"

# ── Conflict detection (code-only, no LLM) ──────────────────────────

CUT_WORDS = {"cut", "remove", "drop", "delete", "skip", "lose"}
KEEP_WORDS = {"keep", "include", "use", "love", "great", "perfect"}


def ranges_overlap(a: Dict, b: Dict) -> bool:
    """Check if two timestamp ranges overlap."""
    return (
        a["timestamp_range"]["start"] < b["timestamp_range"]["end"]
        and b["timestamp_range"]["start"] < a["timestamp_range"]["end"]
    )


def detect_conflicts(feedback_entries: List[Dict]) -> List[Dict]:
    """Group by overlapping timestamp ranges, flag where different authors
    give contradictory direction.  Keyword heuristics only -- no LLM."""
    conflicts: List[Dict] = []
    for i, a in enumerate(feedback_entries):
        for b in feedback_entries[i + 1 :]:
            if a.get("author") != b.get("author") and ranges_overlap(a, b):
                words_a = set(a.get("comment_text", "").lower().split())
                words_b = set(b.get("comment_text", "").lower().split())
                a_cuts = bool(words_a & CUT_WORDS)
                b_keeps = bool(words_b & KEEP_WORDS)
                a_keeps = bool(words_a & KEEP_WORDS)
                b_cuts = bool(words_b & CUT_WORDS)
                if (a_cuts and b_keeps) or (a_keeps and b_cuts):
                    conflicts.append(
                        {"entries": [a, b], "timestamp": a["timestamp_range"]}
                    )
    return conflicts


# ── Social Agent system prompt (cached via Anthropic prompt caching) ─

SOCIAL_AGENT_SYSTEM_PROMPT = """You are the Social Agent — a social media content editor agent. You analyze keynote \
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
When two reviewers give contradictory feedback on the same segment, \
DO NOT resolve it yourself. Present both positions and ask the editor \
to decide. Format: "Conflict at [timestamp]: [Author A] says [X], \
[Author B] says [Y]. Which direction do you prefer?"

CLIP GENERATION RULES:
1. Respect editor's preferred clip lengths per platform from style_memory
2. Check every candidate clip against content_memory — if cosine similarity \
> 0.85 with any published clip, flag it with a warning
3. Apply brand_voice_rules to all captions
4. If speaker_profiles exist for the speaker in a clip, incorporate their \
preferences into memory_notes and match their voice/tone in caption copy
5. If a style_reference exists, match its pacing and tone
6. For each clip, include memory_notes explaining your reasoning
7. Include suggested_hashtags (3-5 relevant hashtags per platform)
8. Include asset_recommendation (what visual treatment would make it land)

RESPONSE FORMAT:
Respond with a single JSON object containing exactly three keys:
{
  "conflicts": [
    {
      "timestamp": "MM:SS-MM:SS",
      "authors": ["Author A", "Author B"],
      "positions": ["Author A says X", "Author B says Y"]
    }
  ],
  "feedback_patterns": ["pattern1", "pattern2"],
  "recommended_cuts": [
    {
      "clip_id": "clip_xxx",
      "start_time": 0.0,
      "end_time": 0.0,
      "transcript_excerpt": "...",
      "speaker": "...",
      "suggested_caption": {"linkedin": "...", "reels": "...", "twitter": "..."},
      "suggested_hashtags": {"linkedin": ["..."], "reels": ["..."]},
      "asset_recommendation": "...",
      "memory_notes": "...",
      "status": "pending"
    }
  ]
}

Return ONLY valid JSON. No markdown fences, no commentary outside the JSON object."""


# ── Anthropic client (own instance, independent of ai_service.py) ────

_anthropic_client: Optional[anthropic.Anthropic] = None


def _get_anthropic_client() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable not set")
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


# ── LangGraph checkpointer ──────────────────────────────────────────

_checkpointer = None


def _get_checkpointer():
    global _checkpointer
    if _checkpointer is None:
        uri = os.getenv("MONGODB_URI")
        if uri:
            try:
                from langgraph.checkpoint.mongodb import MongoDBSaver

                _checkpointer = MongoDBSaver.from_conn_string(
                    uri, db_name="video_intelligence"
                )
                logger.info("LangGraph MongoDBSaver checkpointer initialized")
            except Exception as e:
                logger.warning(f"Could not initialize MongoDBSaver: {e}")
    return _checkpointer


# ── Build user prompt with all context ───────────────────────────────


def _build_user_prompt(
    feedback: List[Dict],
    conflicts: List[Dict],
    style_memory: Optional[Dict],
    content_memory: List[Dict],
    project_memory: Optional[Dict],
    project: Dict,
) -> str:
    """Merge all context into a single user prompt for the Social Agent."""
    sections: List[str] = []

    # Project info
    sections.append(f"PROJECT: {project.get('title', project.get('project_id', ''))}")

    # Segment boundaries
    segments = project.get("segment_boundaries", [])
    if segments:
        seg_lines = []
        for s in segments:
            start = s.get("start", s.get("start_time", 0))
            end = s.get("end", s.get("end_time", 0))
            speaker = s.get("speaker", "unknown")
            seg_lines.append(f"  {start:.1f}s - {end:.1f}s  [{speaker}]")
        sections.append("SEGMENTS:\n" + "\n".join(seg_lines))

    # Feedback
    if feedback:
        fb_lines = []
        for f in feedback:
            ts = f.get("timestamp_range", {})
            fb_lines.append(
                f"  [{f.get('author')}] {ts.get('start',0):.1f}-{ts.get('end',0):.1f}s: "
                f"{f.get('comment_text', '')}"
            )
        sections.append("FEEDBACK:\n" + "\n".join(fb_lines))

    # Pre-detected conflicts
    if conflicts:
        c_lines = []
        for c in conflicts:
            entries = c.get("entries", [])
            if len(entries) >= 2:
                c_lines.append(
                    f"  Conflict: {entries[0].get('author')} vs {entries[1].get('author')} "
                    f"at {c.get('timestamp', {})}"
                )
        sections.append("DETECTED CONFLICTS (code-only):\n" + "\n".join(c_lines))

    # Style memory
    if style_memory:
        sections.append(f"STYLE MEMORY:\n  {json.dumps(style_memory, default=str)}")

    # Content memory (past clips for dupe detection)
    if content_memory:
        cm_lines = [
            f"  {cm.get('clip_id', '')}: {cm.get('hook_text', '')}"
            for cm in content_memory[:10]
        ]
        sections.append("CONTENT MEMORY (published clips):\n" + "\n".join(cm_lines))

    # Project memory
    if project_memory:
        sections.append(
            f"PROJECT MEMORY:\n  {json.dumps(project_memory, default=str)}"
        )

    # Style reference
    style_ref = project.get("style_reference")
    if style_ref:
        sections.append(f"STYLE REFERENCE:\n  {json.dumps(style_ref, default=str)}")

    return "\n\n".join(sections)


# ── Core trigger_regeneration pipeline ───────────────────────────────


async def trigger_regeneration(project_id: str) -> Dict[str, Any]:
    """Full agent regeneration pipeline.

    1-5. Parallel fetch: feedback, style_memory, content_memory, project_memory, project
    6.   detect_conflicts() -- code only
    7.   Build merged prompt
    8.   Single Claude call -> conflicts + patterns + cuts
    9.   Update style_memory.feedback_patterns
    10.  Overwrite project.recommended_cuts
    11.  Return results (WebSocket streaming handled by caller)
    """

    # 1-5: Parallel fetch
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise ValueError(f"Project '{project_id}' not found")

    campaign_id = project.get("campaign_id", "")

    async def _noop():
        return None

    feedback_task = mongodb_service.get_feedback_for_project(project_id)
    style_task = mongodb_service.get_style_memory("editor_mikiko")
    project_mem_task = (
        mongodb_service.get_project_memory(campaign_id) if campaign_id else _noop()
    )

    feedback, style_memory, project_memory = await asyncio.gather(
        feedback_task, style_task, project_mem_task
    )

    # Content memory: search with a zero vector for broad results (dupe detection)
    embedding_dim = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))
    try:
        content_memory = await mongodb_service.search_content_memory(
            embedding=[0.0] * embedding_dim, threshold=0.0, top_k=20
        )
    except Exception:
        content_memory = []

    # 6. Detect conflicts -- code only
    conflicts = detect_conflicts(feedback)

    # DEMO_FALLBACK_MODE: return pre-seeded cuts, no Claude call
    if DEMO_FALLBACK_MODE:
        logger.info("DEMO_FALLBACK_MODE: returning pre-seeded recommended_cuts")
        result = {
            "conflicts": [
                {
                    "timestamp": f"{c['timestamp'].get('start',0)}-{c['timestamp'].get('end',0)}",
                    "authors": [e.get("author", "") for e in c.get("entries", [])],
                    "positions": [e.get("comment_text", "") for e in c.get("entries", [])],
                }
                for c in conflicts
            ],
            "feedback_patterns": [],
            "recommended_cuts": project.get("recommended_cuts", []),
        }
        # Update last_agent_run
        await mongodb_service.update_project(
            project_id, {"last_agent_run": datetime.utcnow()}
        )
        return result

    # 7. Build merged prompt
    user_prompt = _build_user_prompt(
        feedback=feedback,
        conflicts=conflicts,
        style_memory=style_memory,
        content_memory=content_memory,
        project_memory=project_memory,
        project=project,
    )

    # 8. Single Claude call with cached system prompt
    client = _get_anthropic_client()

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=[
                {
                    "type": "text",
                    "text": SOCIAL_AGENT_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
        ),
    )

    # Parse response
    raw_text = response.content[0].text
    # Strip markdown fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        if raw_text.endswith("```"):
            raw_text = raw_text[: raw_text.rfind("```")]
    result = json.loads(raw_text)

    # 9. Update style_memory.feedback_patterns
    patterns = result.get("feedback_patterns", [])
    if patterns and style_memory:
        existing = style_memory.get("feedback_patterns", [])
        merged = list(set(existing + patterns))
        await mongodb_service.upsert_style_memory(
            "editor_mikiko",
            {"feedback_patterns": merged, "updated_at": datetime.utcnow()},
        )

    # 10. Overwrite project.recommended_cuts
    cuts = result.get("recommended_cuts", [])
    await mongodb_service.update_project(
        project_id,
        {
            "recommended_cuts": cuts,
            "last_agent_run": datetime.utcnow(),
        },
    )

    return result


# ── WebSocket streaming helper ───────────────────────────────────────


async def stream_cuts_to_websocket(websocket, project_id: str):
    """Run regeneration and stream individual clips via WebSocket."""
    try:
        await websocket.send_json({"type": "status", "message": "Starting regeneration..."})
        result = await trigger_regeneration(project_id)

        # Stream conflicts first
        if result.get("conflicts"):
            await websocket.send_json(
                {"type": "conflicts", "data": result["conflicts"]}
            )

        # Stream patterns
        if result.get("feedback_patterns"):
            await websocket.send_json(
                {"type": "feedback_patterns", "data": result["feedback_patterns"]}
            )

        # Stream each clip individually
        for clip in result.get("recommended_cuts", []):
            await websocket.send_json({"type": "clip", "data": clip})

        await websocket.send_json({"type": "complete"})
    except Exception as e:
        logger.error(f"stream_cuts_to_websocket error: {e}")
        await websocket.send_json({"type": "error", "message": str(e)})

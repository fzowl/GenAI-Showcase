import asyncio
import logging
import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException

from models.schemas import CaptionEditRequest, ClipStatusUpdate, PublishRequest, PublishResponse
from services.mongodb_service import mongodb_service

logger = logging.getLogger(__name__)

DEMO_FALLBACK_MODE = os.getenv("DEMO_FALLBACK_MODE", "false").lower() == "true"
EMBEDDING_DIM_SIZE = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))

router = APIRouter(prefix="/projects", tags=["publish"])


def _get_voyage_client():
    """Lazy-init a Voyage client for text embedding on publish."""
    import voyageai

    api_key = os.getenv("VOYAGE_AI_API_KEY")
    if not api_key or api_key == "your_voyage_ai_api_key_here":
        return None
    return voyageai.Client(api_key=api_key)


async def _embed_text(text: str) -> List[float]:
    """Embed text via voyage-4 for content_memory dupe detection.

    In DEMO_FALLBACK_MODE, returns a zero vector instead of calling Voyage.
    """
    if DEMO_FALLBACK_MODE:
        return [0.0] * EMBEDDING_DIM_SIZE

    client = _get_voyage_client()
    if not client:
        logger.warning("Voyage client unavailable, using zero vector")
        return [0.0] * EMBEDDING_DIM_SIZE

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: client.embed(texts=[text], model="voyage-4", input_type="document"),
    )
    return result.embeddings[0]


@router.post("/{project_id}/publish", response_model=PublishResponse)
async def publish_clips(project_id: str, request: PublishRequest):
    """Publish approved clips.

    1. Write approved clips to published_clips collection
    2. Embed hook_text via voyage-4
    3. Insert into content_memory (with embedding for dupe detection)
    4. Update style_memory accepted_cuts
    5. Set project status to 'published'
    """
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Find the requested clips from recommended_cuts
    all_cuts = project.get("recommended_cuts", [])
    cuts_by_id = {c.get("clip_id"): c for c in all_cuts}
    approved_clips = []
    missing = []
    for clip_id in request.clip_ids:
        clip = cuts_by_id.get(clip_id)
        if clip:
            approved_clips.append(clip)
        else:
            missing.append(clip_id)

    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Clips not found: {missing}",
        )

    if not approved_clips:
        raise HTTPException(status_code=400, detail="No clips to publish")

    # 1. Write to published_clips collection
    publish_docs = []
    for clip in approved_clips:
        doc = {**clip, "project_id": project_id, "published_at": datetime.utcnow()}
        publish_docs.append(doc)
    await mongodb_service.insert_published_clips(publish_docs)

    # 2-3. Embed hook_text and insert into content_memory
    for clip in approved_clips:
        caption = clip.get("suggested_caption", {})
        # Use linkedin caption as hook_text (primary platform)
        hook_text = caption.get("linkedin", "") if isinstance(caption, dict) else str(caption)
        embedding = await _embed_text(hook_text)

        content_doc = {
            "clip_id": clip.get("clip_id"),
            "project_id": project_id,
            "video_source": project.get("video_id", ""),
            "hook_text": hook_text,
            "embedding": embedding,
            "posted_at": datetime.utcnow(),
            "platform": "linkedin",
        }
        await mongodb_service.insert_content_memory(content_doc)

    # 4. Update style_memory accepted_cuts
    style_memory = await mongodb_service.get_style_memory("editor_mikiko")
    if style_memory:
        existing_accepted = style_memory.get("accepted_cuts", [])
        new_ids = [c.get("clip_id") for c in approved_clips]
        merged = list(set(existing_accepted + new_ids))
        await mongodb_service.upsert_style_memory(
            "editor_mikiko",
            {"accepted_cuts": merged, "updated_at": datetime.utcnow()},
        )

    # 5. Set project status to 'published'
    await mongodb_service.update_project(project_id, {"status": "published"})

    return PublishResponse(
        published_count=len(approved_clips),
        message=f"Published {len(approved_clips)} clips successfully",
    )


@router.patch("/{project_id}/cuts/{clip_id}")
async def update_clip_caption(
    project_id: str, clip_id: str, edit: CaptionEditRequest
):
    """Edit a clip's suggested_caption in project.recommended_cuts."""
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    cuts = project.get("recommended_cuts", [])
    updated = False
    for cut in cuts:
        if cut.get("clip_id") == clip_id:
            cut["suggested_caption"] = edit.suggested_caption.model_dump()
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail=f"Clip '{clip_id}' not found")

    await mongodb_service.update_project(project_id, {"recommended_cuts": cuts})
    return {"message": "Caption updated", "clip_id": clip_id}


@router.patch("/{project_id}/cuts/{clip_id}/status")
async def update_clip_status(
    project_id: str, clip_id: str, update: ClipStatusUpdate
):
    """Approve or reject a clip. Updates project.recommended_cuts[n].status."""
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    cuts = project.get("recommended_cuts", [])
    updated = False
    for cut in cuts:
        if cut.get("clip_id") == clip_id:
            cut["status"] = update.status
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail=f"Clip '{clip_id}' not found")

    await mongodb_service.update_project(project_id, {"recommended_cuts": cuts})

    # If rejecting, also update style_memory rejected_cuts
    if update.status == "rejected":
        style_memory = await mongodb_service.get_style_memory("editor_mikiko")
        if style_memory:
            existing_rejected = style_memory.get("rejected_cuts", [])
            if clip_id not in existing_rejected:
                existing_rejected.append(clip_id)
                await mongodb_service.upsert_style_memory(
                    "editor_mikiko",
                    {"rejected_cuts": existing_rejected, "updated_at": datetime.utcnow()},
                )

    return {"message": f"Clip {update.status}", "clip_id": clip_id}


@router.post("/{project_id}/regenerate")
async def manual_regenerate(project_id: str):
    """Manual regenerate button. Triggers agent_service.trigger_regeneration()."""
    from services.agent_service import trigger_regeneration

    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    try:
        result = await trigger_regeneration(project_id)
        return {"message": "Regeneration complete", "result": result}
    except Exception as e:
        logger.error(f"Manual regeneration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

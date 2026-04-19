import logging
import uuid

from fastapi import APIRouter, HTTPException
from models.schemas import FeedbackEntry, FeedbackSubmission, TimestampRange
from services.mongodb_service import mongodb_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["feedback"])


def _find_covering_segment(segment_boundaries: list, playhead_time: float) -> dict:
    """Map a playhead time to the segment boundary that covers it.

    Returns {"start": float, "end": float} for the covering segment,
    or a +/-5s window around playhead_time when no segment matches.
    """
    for seg in segment_boundaries:
        start = seg.get("start", seg.get("start_time", 0.0))
        end = seg.get("end", seg.get("end_time", 0.0))
        if start <= playhead_time <= end:
            return {"start": start, "end": end}
    # Fallback: 5-second window
    return {"start": max(0.0, playhead_time - 5.0), "end": playhead_time + 5.0}


@router.get("/{project_id}/feedback")
async def get_feedback(project_id: str):
    """All feedback sorted by timestamp_range.start"""
    feedback = await mongodb_service.get_feedback_for_project(project_id)
    return {"feedback": feedback}


@router.get("/{project_id}/feedback/at/{timestamp}")
async def get_feedback_at_timestamp(project_id: str, timestamp: float):
    """Feedback entries covering a specific timestamp"""
    feedback = await mongodb_service.get_feedback_at_timestamp(project_id, timestamp)
    return {"feedback": feedback}


@router.post("/{project_id}/feedback")
async def submit_feedback(project_id: str, feedback: FeedbackSubmission):
    """Submit new feedback.

    Backend maps playhead_time to segment_boundaries to get timestamp_range.
    After storing: triggers Social Agent re-generation.
    """
    # Look up project for segment boundaries
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Map playhead_time -> segment boundary
    segment_boundaries = project.get("segment_boundaries", [])
    ts_range = _find_covering_segment(segment_boundaries, feedback.playhead_time)

    feedback_id = str(uuid.uuid4())
    entry = FeedbackEntry(
        feedback_id=feedback_id,
        project_id=project_id,
        video_id=project.get("video_id"),
        timestamp_range=TimestampRange(**ts_range),
        author=feedback.author,
        comment_text=feedback.comment_text,
    )

    await mongodb_service.insert_feedback(entry.model_dump())

    # Auto-trigger agent re-generation in background (don't block the HTTP response)
    import asyncio
    from services.agent_service import trigger_regeneration

    async def _run_regen():
        try:
            await trigger_regeneration(project_id)
            logger.info(f"Agent re-generation completed for {project_id}")
        except Exception as e:
            logger.error(f"Agent re-generation failed after feedback: {e}")

    asyncio.create_task(_run_regen())

    return {
        "feedback_id": feedback_id,
        "timestamp_range": ts_range,
        "regeneration_triggered": True,
    }

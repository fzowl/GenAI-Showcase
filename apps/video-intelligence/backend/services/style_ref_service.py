import asyncio
import base64
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.ai_service import ai_service
from services.mongodb_service import mongodb_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["style-reference"])


def _extract_frames(video_path: str, output_dir: str) -> list[str]:
    """Extract frames at 1 frame/second via ffmpeg. Returns list of frame file paths."""
    pattern = os.path.join(output_dir, "frame_%04d.jpg")
    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", "fps=1",
        "-q:v", "2",
        pattern,
        "-y",
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=120)
    except FileNotFoundError:
        raise RuntimeError("ffmpeg not found. Install ffmpeg to use style reference upload.")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg frame extraction failed: {e.stderr.decode()[:500]}")

    frames = sorted(Path(output_dir).glob("frame_*.jpg"))
    return [str(f) for f in frames]


def _frames_to_base64(frame_paths: list[str]) -> list[str]:
    """Read frame files and return base64-encoded strings."""
    result = []
    for path in frame_paths:
        with open(path, "rb") as f:
            result.append(base64.b64encode(f.read()).decode())
    return result


@router.post("/{project_id}/style-reference")
async def upload_style_reference(project_id: str, file: UploadFile = File(...)):
    """Upload a reference clip, analyze its style, store on project."""

    # Verify project exists
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Validate file type
    if file.content_type and not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. Save uploaded file
        video_path = os.path.join(tmpdir, file.filename or "upload.mp4")
        content = await file.read()

        # Check size (20MB limit for Voyage multimodal)
        if len(content) > 20 * 1024 * 1024:
            logger.warning("Style reference video exceeds 20MB, frames may be large")

        with open(video_path, "wb") as f:
            f.write(content)

        # 2. Extract frames at 1/s via ffmpeg
        frames_dir = os.path.join(tmpdir, "frames")
        os.makedirs(frames_dir, exist_ok=True)

        loop = asyncio.get_event_loop()
        frame_paths = await loop.run_in_executor(
            None, _extract_frames, video_path, frames_dir
        )

        if not frame_paths:
            raise HTTPException(status_code=400, detail="No frames could be extracted from video")

        logger.info(f"Extracted {len(frame_paths)} frames from style reference")

        # 3. Convert frames to base64 for Claude analysis
        frames_b64 = await loop.run_in_executor(
            None, _frames_to_base64, frame_paths
        )

        # 4. Analyze style via Claude
        analysis = await ai_service.analyze_style_reference(frames_b64)

        # 5. Store on project
        await mongodb_service.update_project(project_id, {"style_reference": analysis})

        logger.info(f"Style reference stored for project {project_id}")

    return {"project_id": project_id, "style_reference": analysis}

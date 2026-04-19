import logging

from fastapi import APIRouter, HTTPException
from models.schemas import Project, ProjectSearchQuery
from services.ai_service import ai_service
from services.mongodb_service import mongodb_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/")
async def list_projects():
    """GET /projects -- home screen project cards"""
    projects = await mongodb_service.get_all_projects()
    return {"projects": projects}


@router.get("/{project_id}")
async def get_project_workspace(project_id: str):
    """GET /projects/{project_id} -- compound read: project + feedback + style_memory + project_memory"""
    workspace = await mongodb_service.load_project_workspace(project_id)
    if not workspace:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return workspace


@router.post("/")
async def create_project(project: Project):
    """POST /projects -- create new project"""
    existing = await mongodb_service.get_project(project.project_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Project '{project.project_id}' already exists",
        )
    project_dict = project.model_dump()
    project_id = await mongodb_service.create_project(project_dict)
    return {"project_id": project_id, "message": "Project created"}


@router.post("/{project_id}/search")
async def search_moments(project_id: str, query: ProjectSearchQuery):
    """Keynote Agent: hybrid search + reranking.
    Hardcoded hybrid (skip Claude router -- latency optimization)."""

    # Verify project exists
    project = await mongodb_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # 1. Embed query via Voyage multimodal-3.5
    query_embedding = await ai_service.get_query_embedding(query.query)

    # 2. Hybrid search (vector + full-text) via existing method
    video_filter = project.get("video_id")
    candidates = await mongodb_service.hybrid_search(
        query.query, query_embedding, top_k=query.top_k * 2, video_filter=video_filter
    )

    # 3. Rerank with Voyage rerank-2.5
    if candidates:
        transcripts = [c.get("description", "") for c in candidates]
        reranked = await ai_service.rerank_results(query.query, transcripts, top_k=query.top_k)
        results = [candidates[r["index"]] for r in reranked if r["index"] < len(candidates)]
    else:
        results = candidates

    return {"query": query.query, "results": results, "total_results": len(results)}

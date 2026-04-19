"""
Create MongoDB indexes for SMCEA.

Creates 5 indexes:
1. vector_search_index on frame_intelligence (vector 1024d cosine)
2. text_search_index on frame_intelligence (description, transcript, transcript_summary)
3. content_vector_idx on content_memory (vector 1024d dotProduct)
4. feedback_by_project on stakeholder_feedback (compound: project_id + timestamp_range.start)
5. project_by_status on projects (standard: status)

Usage:
    cd backend && python -m scripts.create_indexes
"""

import os
import sys
import time

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.operations import SearchIndexModel

load_dotenv()


def get_db():
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("DATABASE_NAME", "video_intelligence")
    if not uri:
        print("ERROR: MONGODB_URI not set in environment")
        sys.exit(1)
    client = MongoClient(uri)
    client.admin.command("ping")
    print(f"Connected to MongoDB database: {db_name}")
    return client, client[db_name]


def _search_index_exists(collection, index_name: str) -> bool:
    """Check if an Atlas Search / Vector Search index already exists."""
    try:
        for idx in collection.list_search_indexes():
            if idx["name"] == index_name:
                return True
    except Exception:
        pass
    return False


def create_indexes():
    client, db = get_db()

    frame_coll = db["frame_intelligence"]
    content_coll = db["content_memory"]
    feedback_coll = db["stakeholder_feedback"]
    projects_coll = db["projects"]

    dims = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))

    # -----------------------------------------------------------------------
    # 1. vector_search_index on frame_intelligence
    # -----------------------------------------------------------------------
    idx_name = "vector_search_index"
    if _search_index_exists(frame_coll, idx_name):
        print(f"[SKIP] {idx_name} already exists on frame_intelligence")
    else:
        print(f"[CREATE] {idx_name} on frame_intelligence ({dims}d cosine)...")
        model = SearchIndexModel(
            definition={
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": dims,
                        "similarity": "cosine",
                        "quantization": "scalar",
                    },
                    {"type": "filter", "path": "video_id"},
                ]
            },
            name=idx_name,
            type="vectorSearch",
        )
        try:
            frame_coll.create_search_index(model=model)
            print(f"  -> {idx_name} created (building in background)")
        except Exception as e:
            print(f"  -> Error: {e}")

    # -----------------------------------------------------------------------
    # 2. text_search_index on frame_intelligence
    #    Includes description, transcript, and transcript_summary.
    # -----------------------------------------------------------------------
    idx_name = "text_search_index"
    if _search_index_exists(frame_coll, idx_name):
        print(f"[SKIP] {idx_name} already exists on frame_intelligence")
    else:
        print(f"[CREATE] {idx_name} on frame_intelligence...")
        model = SearchIndexModel(
            definition={
                "mappings": {
                    "dynamic": False,
                    "fields": {
                        "description": {"type": "string", "analyzer": "lucene.standard"},
                        "transcript": {"type": "string", "analyzer": "lucene.standard"},
                        "transcript_summary": {"type": "string", "analyzer": "lucene.standard"},
                        "metadata.scene_type": {"type": "string"},
                        "metadata.objects": {"type": "string"},
                    },
                }
            },
            name=idx_name,
            type="search",
        )
        try:
            frame_coll.create_search_index(model=model)
            print(f"  -> {idx_name} created (building in background)")
        except Exception as e:
            print(f"  -> Error: {e}")

    # -----------------------------------------------------------------------
    # 3. content_vector_idx on content_memory (dotProduct, 1024d)
    # -----------------------------------------------------------------------
    idx_name = "content_vector_idx"
    if _search_index_exists(content_coll, idx_name):
        print(f"[SKIP] {idx_name} already exists on content_memory")
    else:
        print(f"[CREATE] {idx_name} on content_memory ({dims}d dotProduct)...")
        model = SearchIndexModel(
            definition={
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": dims,
                        "similarity": "dotProduct",
                    },
                ]
            },
            name=idx_name,
            type="vectorSearch",
        )
        try:
            content_coll.create_search_index(model=model)
            print(f"  -> {idx_name} created (building in background)")
        except Exception as e:
            print(f"  -> Error: {e}")

    # -----------------------------------------------------------------------
    # 4. feedback_by_project on stakeholder_feedback (compound standard index)
    # -----------------------------------------------------------------------
    idx_name = "feedback_by_project"
    existing_standard = {idx["name"] for idx in feedback_coll.list_indexes()}
    if idx_name in existing_standard:
        print(f"[SKIP] {idx_name} already exists on stakeholder_feedback")
    else:
        print(f"[CREATE] {idx_name} on stakeholder_feedback...")
        try:
            feedback_coll.create_index(
                [("project_id", ASCENDING), ("timestamp_range.start", ASCENDING)],
                name=idx_name,
            )
            print(f"  -> {idx_name} created")
        except Exception as e:
            print(f"  -> Error: {e}")

    # -----------------------------------------------------------------------
    # 5. project_by_status on projects (standard index)
    # -----------------------------------------------------------------------
    idx_name = "project_by_status"
    existing_standard = {idx["name"] for idx in projects_coll.list_indexes()}
    if idx_name in existing_standard:
        print(f"[SKIP] {idx_name} already exists on projects")
    else:
        print(f"[CREATE] {idx_name} on projects...")
        try:
            projects_coll.create_index(
                [("status", ASCENDING)],
                name=idx_name,
            )
            print(f"  -> {idx_name} created")
        except Exception as e:
            print(f"  -> Error: {e}")

    print("\nIndex creation complete.")
    client.close()


if __name__ == "__main__":
    create_indexes()

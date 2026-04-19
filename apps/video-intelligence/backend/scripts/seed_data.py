"""
Seed data script for SMCEA demo.

Populates: projects, stakeholder_feedback, content_memory, style_memory, project_memory.

Usage:
    cd backend && python -m scripts.seed_data
"""

import os
import random
import sys
from datetime import datetime

from dotenv import load_dotenv
from pymongo import MongoClient

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


# ---------------------------------------------------------------------------
# Deterministic fake embeddings (1024d) — seeded so sf_clip_002 and london
# cut_002 are very similar.
# ---------------------------------------------------------------------------

def _fake_embedding(seed: int, dims: int = 1024) -> list:
    rng = random.Random(seed)
    return [round(rng.gauss(0, 1), 6) for _ in range(dims)]


# Use close seeds for sf_clip_002 (seed=202) and london cut_002 (seed=203)
# so dot-product similarity is high -> dupe detection fires.
EMBED_SEEDS = {
    "austin_clip_001": 100,
    "austin_clip_002": 101,
    "austin_clip_003": 102,
    "nyc_clip_001": 200,
    "nyc_clip_002": 201,
    "sf_clip_001": 300,
    "sf_clip_002": 202,   # intentionally close to london cut_002
    "sf_clip_003": 301,
}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

PROJECTS = [
    {
        "project_id": "proj_austin",
        "title": ".local Austin 2025",
        "campaign_id": "local_austin_2025",
        "status": "published",
    },
    {
        "project_id": "proj_nyc",
        "title": ".local New York 2025",
        "campaign_id": "local_nyc_2025",
        "status": "published",
    },
    {
        "project_id": "proj_sf",
        "title": ".local SF 2026",
        "campaign_id": "local_sf_2026",
        "status": "published",
        "recommended_cuts": [
            {
                "clip_id": "sf_clip_001",
                "start_time": 60.0,
                "end_time": 120.0,
                "transcript_excerpt": "Here's what developers are actually building with agents",
                "speaker": "CJ",
                "suggested_caption": {
                    "linkedin": "Agents aren't hypothetical anymore. Here's what developers are actually building.",
                    "reels": "What devs are ACTUALLY building with agents",
                    "twitter": "Agents aren't hypothetical. Here's what devs are building.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#AI", "#Agents"],
                    "reels": ["#mongodb", "#ai", "#agents"],
                },
                "asset_recommendation": "Speaker close-up with code overlay",
                "memory_notes": "Strong hook, audience engaged",
                "status": "approved",
            },
            {
                "clip_id": "sf_clip_002",
                "start_time": 300.0,
                "end_time": 360.0,
                "transcript_excerpt": "Atlas Vector Search now handles the retrieval piece natively — no extra infrastructure",
                "speaker": "Oz",
                "suggested_caption": {
                    "linkedin": "Vector search built right into your database. No extra infrastructure needed.",
                    "reels": "Vector search, zero extra infra",
                    "twitter": "Vector search built into your database. No extra infra.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#VectorSearch", "#Atlas"],
                    "reels": ["#mongodb", "#vectorsearch"],
                },
                "asset_recommendation": "Demo screen recording with speaker PiP",
                "memory_notes": "Technical demo moment, similar to planned London cut_002",
                "status": "approved",
            },
            {
                "clip_id": "sf_clip_003",
                "start_time": 600.0,
                "end_time": 660.0,
                "transcript_excerpt": "The community built 200 new integrations in the last quarter alone",
                "speaker": "CJ",
                "suggested_caption": {
                    "linkedin": "200 community integrations in one quarter. This ecosystem is on fire.",
                    "reels": "200 integrations in ONE quarter",
                    "twitter": "200 community integrations in one quarter. The ecosystem is thriving.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#Community", "#DevRel"],
                    "reels": ["#mongodb", "#community"],
                },
                "asset_recommendation": "Wide shot with stat overlay",
                "memory_notes": "Stat-driven, high engagement potential",
                "status": "approved",
            },
        ],
    },
    {
        "project_id": "proj_london",
        "title": "MongoDB .local London 2026 Keynote",
        "campaign_id": "local_london_2026",
        "status": "in_progress",
        "video_path": "uploads/placeholder-london-keynote.mp4",
        "duration": 1440.0,
        "segment_boundaries": [
            {"start": 0.0, "end": 120.0, "speaker": "CJ"},
            {"start": 120.0, "end": 300.0, "speaker": "CJ"},
            {"start": 300.0, "end": 420.0, "speaker": "Oz"},
            {"start": 420.0, "end": 540.0, "speaker": "CJ"},
            {"start": 540.0, "end": 660.0, "speaker": "Oz"},
            {"start": 660.0, "end": 780.0, "speaker": "CJ"},
            {"start": 780.0, "end": 900.0, "speaker": "Oz"},
            {"start": 900.0, "end": 1080.0, "speaker": "CJ"},
            {"start": 1080.0, "end": 1260.0, "speaker": "Oz"},
            {"start": 1260.0, "end": 1440.0, "speaker": "CJ"},
        ],
        "recommended_cuts": [
            {
                "clip_id": "cut_001",
                "start_time": 154.0,
                "end_time": 192.0,
                "transcript_excerpt": "Make sure you get my good side. The left camera angle is better for this segment.",
                "speaker": "CJ",
                "suggested_caption": {
                    "linkedin": "Behind the scenes at .local London — even keynotes need the right angle.",
                    "reels": "Keynote prep is real",
                    "twitter": "Even keynotes need the right angle. BTS from .local London.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#BehindTheScenes", "#dotlocal"],
                    "reels": ["#mongodb", "#bts", "#keynote"],
                },
                "asset_recommendation": "Left camera angle, speaker close-up",
                "memory_notes": "CJ prefers left camera per feedback",
                "status": "pending",
            },
            {
                "clip_id": "cut_002",
                "start_time": 300.0,
                "end_time": 390.0,
                "transcript_excerpt": "Resilience section needs to be a standalone clip. Core message for enterprise.",
                "speaker": "Oz",
                "suggested_caption": {
                    "linkedin": "Enterprise resilience isn't optional — it's the foundation. Here's how Atlas delivers.",
                    "reels": "Resilience = foundation",
                    "twitter": "Enterprise resilience isn't optional. Here's how Atlas delivers.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#Enterprise", "#Resilience"],
                    "reels": ["#mongodb", "#enterprise"],
                },
                "asset_recommendation": "Speaker with enterprise architecture diagram overlay",
                "memory_notes": "Similar to sf_clip_002 — dupe detection should flag",
                "status": "pending",
            },
            {
                "clip_id": "cut_003",
                "start_time": 495.0,
                "end_time": 525.0,
                "transcript_excerpt": "This is the money quote about developer experience. Lead with this for LinkedIn.",
                "speaker": "CJ",
                "suggested_caption": {
                    "linkedin": "Developer experience isn't a feature — it's the product.",
                    "reels": "DX is the product",
                    "twitter": "Developer experience isn't a feature. It's the product.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#DeveloperExperience", "#DX"],
                    "reels": ["#mongodb", "#dx", "#devex"],
                },
                "asset_recommendation": "Speaker close-up, audience reaction cut",
                "memory_notes": "CJ flagged as money quote for LinkedIn",
                "status": "pending",
            },
            {
                "clip_id": "cut_004",
                "start_time": 1080.0,
                "end_time": 1155.0,
                "transcript_excerpt": "Atlas Vector Search demo — caption must explain what vector search does. No jargon.",
                "speaker": "Oz",
                "suggested_caption": {
                    "linkedin": "Vector search finds meaning, not just keywords. Watch Atlas do it live.",
                    "reels": "Search by meaning, not keywords",
                    "twitter": "Vector search finds meaning, not keywords. Atlas does it live.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#VectorSearch", "#AI"],
                    "reels": ["#mongodb", "#vectorsearch", "#ai"],
                },
                "asset_recommendation": "Demo screen recording with speaker PiP, no jargon in caption",
                "memory_notes": "Oz requires plain-language captions for technical demos",
                "status": "pending",
            },
            {
                "clip_id": "cut_005",
                "start_time": 1330.0,
                "end_time": 1410.0,
                "transcript_excerpt": "The audience reaction was great. Use the wide shot.",
                "speaker": "CJ",
                "suggested_caption": {
                    "linkedin": "The energy at .local London was unreal. This is why we do it.",
                    "reels": "This energy though",
                    "twitter": "The energy at .local London. This is why we do it.",
                },
                "suggested_hashtags": {
                    "linkedin": ["#MongoDB", "#dotlocal", "#London"],
                    "reels": ["#mongodb", "#dotlocal", "#london"],
                },
                "asset_recommendation": "Wide shot of audience, add text overlay with key stat",
                "memory_notes": "CJ + Sarah K both flagged audience reaction; Sarah wants stat overlay",
                "status": "pending",
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Stakeholder feedback for proj_london (9 entries)
# ---------------------------------------------------------------------------

FEEDBACK = [
    # CJ -- CEO (4 comments)
    {
        "feedback_id": "fb_cj_001",
        "project_id": "proj_london",
        "timestamp_range": {"start": 154.0, "end": 192.0},  # 2:34 - 3:12
        "author": "CJ",
        "comment_text": "Make sure you get my good side. The left camera angle is better for this segment.",
    },
    {
        "feedback_id": "fb_cj_002",
        "project_id": "proj_london",
        "timestamp_range": {"start": 495.0, "end": 525.0},  # 8:15 - 8:45
        "author": "CJ",
        "comment_text": "This is the money quote about developer experience. Lead with this for LinkedIn.",
    },
    {
        "feedback_id": "fb_cj_003",
        "project_id": "proj_london",
        "timestamp_range": {"start": 860.0, "end": 900.0},  # 14:20 - 15:00
        "author": "CJ",
        "comment_text": "Cut this part \u2014 I misspoke about the timeline.",
    },
    {
        "feedback_id": "fb_cj_004",
        "project_id": "proj_london",
        "timestamp_range": {"start": 1330.0, "end": 1410.0},  # 22:10 - 23:30
        "author": "CJ",
        "comment_text": "The audience reaction was great. Use the wide shot.",
    },
    # Oz -- VP Engineering (3 comments)
    {
        "feedback_id": "fb_oz_001",
        "project_id": "proj_london",
        "timestamp_range": {"start": 300.0, "end": 390.0},  # 5:00 - 6:30
        "author": "Oz",
        "comment_text": "Resilience section needs to be a standalone clip. Core message for enterprise.",
    },
    {
        "feedback_id": "fb_oz_002",
        "project_id": "proj_london",
        "timestamp_range": {"start": 860.0, "end": 900.0},  # 14:20 - 15:00  ** CONFLICT **
        "author": "Oz",
        "comment_text": "Keep this \u2014 the correction makes CJ more relatable. Real > polished.",
    },
    {
        "feedback_id": "fb_oz_003",
        "project_id": "proj_london",
        "timestamp_range": {"start": 1080.0, "end": 1155.0},  # 18:00 - 19:15
        "author": "Oz",
        "comment_text": "Atlas Vector Search demo \u2014 caption must explain what vector search does. No jargon.",
    },
    # Sarah K. -- PMM (2 comments)
    {
        "feedback_id": "fb_sarah_001",
        "project_id": "proj_london",
        "timestamp_range": {"start": 495.0, "end": 525.0},  # 8:15 - 8:45
        "author": "Sarah K.",
        "comment_text": "For Reels, trim to just the last sentence. Setup too long for short-form.",
    },
    {
        "feedback_id": "fb_sarah_002",
        "project_id": "proj_london",
        "timestamp_range": {"start": 1330.0, "end": 1410.0},  # 22:10 - 23:30
        "author": "Sarah K.",
        "comment_text": "Add text overlay with the key stat. Numbers perform 2x on social.",
    },
]


# ---------------------------------------------------------------------------
# Content memory (8 entries: Austin -> NYC -> SF learning trajectory)
# ---------------------------------------------------------------------------

CONTENT_MEMORY = [
    # Austin clips (generic captions)
    {
        "clip_id": "austin_clip_001",
        "project_id": "proj_austin",
        "video_source": "austin_keynote_2025.mp4",
        "hook_text": "Check out highlights from our Austin event!",
        "embedding": _fake_embedding(EMBED_SEEDS["austin_clip_001"]),
        "posted_at": datetime(2025, 3, 15, 10, 0, 0),
        "platform": "linkedin",
    },
    {
        "clip_id": "austin_clip_002",
        "project_id": "proj_austin",
        "video_source": "austin_keynote_2025.mp4",
        "hook_text": "Great turnout at .local Austin! Thanks for joining us.",
        "embedding": _fake_embedding(EMBED_SEEDS["austin_clip_002"]),
        "posted_at": datetime(2025, 3, 15, 14, 0, 0),
        "platform": "twitter",
    },
    {
        "clip_id": "austin_clip_003",
        "project_id": "proj_austin",
        "video_source": "austin_keynote_2025.mp4",
        "hook_text": "MongoDB at .local Austin recap",
        "embedding": _fake_embedding(EMBED_SEEDS["austin_clip_003"]),
        "posted_at": datetime(2025, 3, 16, 9, 0, 0),
        "platform": "reels",
    },
    # NYC clips (better captions, starting to learn)
    {
        "clip_id": "nyc_clip_001",
        "project_id": "proj_nyc",
        "video_source": "nyc_keynote_2025.mp4",
        "hook_text": "MongoDB Atlas now handles 10x the throughput \u2014 here's what that means for your apps.",
        "embedding": _fake_embedding(EMBED_SEEDS["nyc_clip_001"]),
        "posted_at": datetime(2025, 6, 20, 10, 0, 0),
        "platform": "linkedin",
    },
    {
        "clip_id": "nyc_clip_002",
        "project_id": "proj_nyc",
        "video_source": "nyc_keynote_2025.mp4",
        "hook_text": "10x throughput. Zero downtime migration. Atlas just leveled up.",
        "embedding": _fake_embedding(EMBED_SEEDS["nyc_clip_002"]),
        "posted_at": datetime(2025, 6, 20, 14, 0, 0),
        "platform": "twitter",
    },
    # SF clips (strong captions, cross-project memory visible)
    {
        "clip_id": "sf_clip_001",
        "project_id": "proj_sf",
        "video_source": "sf_keynote_2026.mp4",
        "hook_text": "Here's what developers are actually building with agents \u2014 not hypotheticals, real production apps.",
        "embedding": _fake_embedding(EMBED_SEEDS["sf_clip_001"]),
        "posted_at": datetime(2026, 1, 18, 10, 0, 0),
        "platform": "linkedin",
    },
    {
        "clip_id": "sf_clip_002",
        "project_id": "proj_sf",
        "video_source": "sf_keynote_2026.mp4",
        "hook_text": "Atlas Vector Search now handles the retrieval piece natively \u2014 no extra infrastructure.",
        "embedding": _fake_embedding(EMBED_SEEDS["sf_clip_002"]),
        "posted_at": datetime(2026, 1, 18, 14, 0, 0),
        "platform": "linkedin",
    },
    {
        "clip_id": "sf_clip_003",
        "project_id": "proj_sf",
        "video_source": "sf_keynote_2026.mp4",
        "hook_text": "The community built 200 new integrations in the last quarter alone. This ecosystem is thriving.",
        "embedding": _fake_embedding(EMBED_SEEDS["sf_clip_003"]),
        "posted_at": datetime(2026, 1, 19, 9, 0, 0),
        "platform": "reels",
    },
]


# ---------------------------------------------------------------------------
# Style memory for editor_mikiko
# ---------------------------------------------------------------------------

STYLE_MEMORY = {
    "user_id": "editor_mikiko",
    "preferred_clip_lengths": {"reels": 15, "linkedin": 60, "twitter": 30},
    "pacing": "fast_cuts",
    "hook_style": "question_first",
    "feedback_patterns": [
        "consistently flags pacing issues for Reels",
        "prefers question-first hooks",
        "favors audience reaction shots over speaker close-ups",
    ],
    "accepted_cuts": [
        "austin_clip_001",
        "austin_clip_002",
        "nyc_clip_001",
        "nyc_clip_002",
        "sf_clip_001",
        "sf_clip_002",
        "sf_clip_003",
    ],
    "rejected_cuts": ["austin_draft_003", "nyc_draft_003", "sf_draft_004"],
    "updated_at": datetime(2026, 3, 17, 12, 0, 0),
}


# ---------------------------------------------------------------------------
# Project memory for local_london_2026
# ---------------------------------------------------------------------------

PROJECT_MEMORY = {
    "campaign_id": "local_london_2026",
    "event_name": "MongoDB .local London 2026",
    "brand_voice_rules": "Professional but approachable. No jargon.",
    "previous_campaigns": ["local_austin_2025", "local_nyc_2025", "local_sf_2026"],
    "target_platforms": ["linkedin", "twitter", "reels"],
    "speaker_profiles": {
        "CJ": {
            "preferred_angle": "left camera",
            "voice_notes": "Conversational, uses developer analogies",
            "quirks": ["always says 'and that's the thing' before key points"],
        },
        "Oz": {
            "voice_notes": "Technical, precise, enterprise framing",
            "quirks": [],
        },
    },
}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def seed():
    client, db = get_db()

    collections = {
        "projects": db["projects"],
        "stakeholder_feedback": db["stakeholder_feedback"],
        "content_memory": db["content_memory"],
        "style_memory": db["style_memory"],
        "project_memory": db["project_memory"],
    }

    # Clear existing data (idempotent)
    print("\nClearing existing data...")
    for name, coll in collections.items():
        deleted = coll.delete_many({})
        print(f"  {name}: deleted {deleted.deleted_count} documents")

    # Insert projects
    print("\nInserting projects...")
    for proj in PROJECTS:
        proj["created_at"] = datetime.utcnow()
        collections["projects"].insert_one(proj)
        print(f"  + {proj['project_id']} ({proj['status']})")

    # Insert feedback
    print("\nInserting stakeholder feedback...")
    for fb in FEEDBACK:
        fb["created_at"] = datetime.utcnow()
        collections["stakeholder_feedback"].insert_one(fb)
        conflict_marker = " ** CONFLICT **" if fb["feedback_id"] in ("fb_cj_003", "fb_oz_002") else ""
        print(f"  + {fb['feedback_id']} [{fb['author']}] @ {fb['timestamp_range']['start']}-{fb['timestamp_range']['end']}{conflict_marker}")

    # Insert content memory
    print("\nInserting content memory...")
    for cm in CONTENT_MEMORY:
        collections["content_memory"].insert_one(cm)
        print(f"  + {cm['clip_id']} ({cm['platform']}) - {cm['hook_text'][:60]}...")

    # Insert style memory
    print("\nInserting style memory...")
    collections["style_memory"].insert_one(STYLE_MEMORY)
    print(f"  + {STYLE_MEMORY['user_id']}")

    # Insert project memory
    print("\nInserting project memory...")
    collections["project_memory"].insert_one(PROJECT_MEMORY)
    print(f"  + {PROJECT_MEMORY['campaign_id']}")

    # Verify counts
    print("\n--- Verification ---")
    expected = {
        "projects": 4,
        "stakeholder_feedback": 9,
        "content_memory": 8,
        "style_memory": 1,
        "project_memory": 1,
    }
    all_ok = True
    for name, expected_count in expected.items():
        actual = collections[name].count_documents({})
        status = "OK" if actual == expected_count else "MISMATCH"
        if status == "MISMATCH":
            all_ok = False
        print(f"  {name}: {actual}/{expected_count} {status}")

    if all_ok:
        print("\nSeed data loaded successfully.")
    else:
        print("\nWARNING: Some counts don't match expected values.")

    client.close()


if __name__ == "__main__":
    seed()

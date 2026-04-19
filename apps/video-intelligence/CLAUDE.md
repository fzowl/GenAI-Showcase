# SMCEA - Social Media Content Editor Agent

MongoDB .local London 2026 keynote demo. An AI-powered agent that analyzes keynote video, collects stakeholder feedback, and generates social media clip recommendations with per-platform captions.

## Architecture

- **Backend**: FastAPI (Python 3.10+), sync PyMongo, Anthropic Claude, Voyage AI embeddings, MongoDB Atlas Vector Search
- **Frontend**: React 18 + TypeScript (Create React App), no component library
- **Agent**: LangGraph with MongoDBSaver checkpointer (langgraph-prebuilt==1.0.9)

## How to run

### Backend
```bash
cd backend
cp ../.env.example .env  # then fill in API keys
pip install -r requirements.txt
python -m scripts.seed_data        # seed demo data
uvicorn main:app --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm start                          # runs on port 3000
```

## Environment variables

Copy `.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| MONGODB_URI | Yes | Atlas connection string |
| DATABASE_NAME | No | Default: video_intelligence |
| VOYAGE_AI_API_KEY | Yes* | Voyage AI for embeddings + reranking |
| OPENAI_API_KEY | No | OpenAI for STT (gpt-4o-transcribe) |
| ANTHROPIC_API_KEY | Yes* | Claude for agent + style analysis |
| EMBEDDING_DIM_SIZE | No | Default: 1024 |
| DEMO_FALLBACK_MODE | No | Set "true" to skip all API calls and use pre-seeded data |
| FRONTEND_URL | No | Default: http://localhost:3000 |

*Not required when DEMO_FALLBACK_MODE=true

## Key constraints

- Frontend is TypeScript only (strict mode, no `any`)
- Backend uses sync PyMongo wrapped in `async def` (no Motor)
- langgraph-prebuilt pinned to 1.0.9 -- do not use `.ainvoke()`
- All Claude calls use `run_in_executor` for async compatibility
- Anthropic prompt caching via `cache_control: {"type": "ephemeral"}` on system prompts

## What NOT to build

- No actual video rendering or transcoding pipeline
- No visual style transformation (color grading, filters)
- No content guardrails or moderation layer
- No text-to-speech
- No multi-user authentication
- No real-time collaborative editing

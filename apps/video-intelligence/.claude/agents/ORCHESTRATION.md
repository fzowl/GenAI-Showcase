# SMCEA Build Orchestration Plan

## ⚠️ STEP 0: READ THE ORIGINAL SPECS FIRST

**Before doing anything else, the orchestrator MUST read these two source documents in full:**

1. **`Demo Spec - Social Media Content Demo.md`** — Business context, demo flow narrative, stakeholder names, agent memory patterns, "why MongoDB" messaging, team/timeline context. This is the *why* behind every decision.
2. **`Demo Spec - Social Media Content Demo.pdf`** (all 26 pages) — Detailed engineering handoff v4: exact JSON schemas, collection schemas, pre-seed data values, agent prompt text, code snippets, data flow diagrams, LangGraph integration patterns, latency targets, MongoDB indexes, dependency pins, file list. This is the *source of truth* when any sub-agent spec is ambiguous.
3. **`KARPATHY.md`** — Coding guidelines: simplicity first, surgical changes, goal-driven execution.

These documents are the authoritative specification. The sub-agent specs are derived from them. When there's a conflict between a sub-agent spec and the original PDF, **the PDF wins**.

The orchestrator needs this context to:
- Make judgment calls when sub-agents encounter ambiguity
- Verify that outputs serve the 7-minute keynote demo story
- Resolve cross-cutting concerns that span multiple sub-agents
- Catch if a sub-agent misses something from the original spec

---

## ⚠️ MANDATORY: USE SUB-AGENTS FOR ALL IMPLEMENTATION

**YOU MUST USE THE SUB-AGENT DEFINITIONS IN THIS DIRECTORY TO IMPLEMENT THIS PROJECT.**

Do NOT implement code directly in the main session. Instead:
1. Read the relevant sub-agent spec file (e.g., `.claude/agents/agent-a-scaffold-models.md`)
2. Launch an Agent (using the Agent tool) with the sub-agent spec as context in the prompt
3. The sub-agent does all the implementation work
4. Verify the sub-agent's output against its acceptance criteria
5. Move to the next sub-agent

**Why:** Each sub-agent has a focused scope, clear ownership, explicit dependencies, and acceptance criteria. This prevents scope creep, ensures nothing is missed, and allows parallel execution where dependencies allow.

---

## Execution Order

```
Phase 1: Foundation
  ├── Agent A: Scaffold + Models     ──→ clone repo, schemas, deps, main.py fixes
  └── (Agent B waits for A)

Phase 2: Data + Services (after Phase 1)
  ├── Agent B: MongoDB + Seed Data   ──→ collection methods, project service, seed script
  ├── Agent C: Audio + Video         ──→ STT, diarization, transcript summaries (parallel with B)
  └── (D waits for B)

Phase 3: Search + Agents (after Phase 2)
  ├── Agent D: Search + Style Ref    ──→ reranking, style upload, embedding updates
  └── Agent E: LangGraph Agents      ──→ Social Agent, feedback, publish, HITL (parallel with D)

Phase 4: Frontend (after Phases 2-3 backends ready)
  ├── Agent F: Pages + Core          ──→ TypeScript setup, pages, search, video, feedback display
  └── (G waits for F)
  └── Agent G: Editor Components     ──→ feedback input, style upload, cut list, publish, memory

Phase 5: Integration (after ALL above)
  └── Agent H: Integration + Polish  ──→ wiring, DEMO_FALLBACK_MODE, e2e test, optimizations
```

### Parallelization opportunities:
- **B + C** can run in parallel (both depend only on A)
- **D + E** can run in parallel (both depend on A + B)
- **F can start** as soon as B is done (needs API endpoints, not agent layer)
- **G** must wait for F (needs TypeScript types and layout)
- **H** must be last (needs everything)

---

## How to Launch Each Sub-Agent

For each sub-agent, use the Agent tool like this:

```
Agent({
  description: "Sub-Agent A: Scaffold + Models",
  prompt: `You are implementing Sub-Agent A for the SMCEA project.

Read the sub-agent specification at .claude/agents/agent-a-scaffold-models.md
and implement everything described there.

Also read these context files for background:
- "Demo Spec - Social Media Content Demo.md" (project context)
- KARPATHY.md (coding guidelines: simplicity first, surgical changes)

Key constraints:
- Frontend must be TypeScript only (.tsx/.ts), no JavaScript
- Follow KARPATHY.md: minimum code, no speculative features
- Pin dependencies exactly as specified

Execute all tasks in the spec and verify against the acceptance criteria.`
})
```

**Adapt the prompt for each agent** — include the agent letter, its spec file path, and any outputs from previous agents that it needs.

---

## Sub-Agent Spec Files

| Agent | File | Scope |
|-------|------|-------|
| A | `.claude/agents/agent-a-scaffold-models.md` | Clone repo, schemas, deps, main.py |
| B | `.claude/agents/agent-b-mongodb-seed.md` | MongoDB service, project service, seed data |
| C | `.claude/agents/agent-c-audio-video.md` | Audio extraction, STT, transcript summaries |
| D | `.claude/agents/agent-d-search-style.md` | Search + reranking, style reference |
| E | `.claude/agents/agent-e-langgraph-agents.md` | LangGraph Social Agent, feedback, publish |
| F | `.claude/agents/agent-f-frontend-core.md` | TypeScript setup, pages, core components |
| G | `.claude/agents/agent-g-frontend-editor.md` | Editor components (feedback, cuts, publish, memory) |
| H | `.claude/agents/agent-h-integration.md` | Integration, DEMO_FALLBACK_MODE, e2e test |

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `Demo Spec - Social Media Content Demo.md` | High-level context, architecture, demo flow, memory patterns |
| `Demo Spec - Social Media Content Demo.pdf` | Detailed engineering handoff v4 — schemas, prompts, code patterns, pre-seed data, indexes, optimizations |
| `KARPATHY.md` | Coding guidelines — simplicity first, surgical changes, goal-driven execution |

---

## Global Constraints (apply to ALL sub-agents)

1. **TypeScript only** for frontend — no .js/.jsx files
2. **KARPATHY.md rules** — minimum code, no speculative features, surgical changes
3. **Pin dependencies** exactly as specified in the engineering handoff
4. **Sync PyMongo** — keep the existing synchronous pattern (not Motor/async)
5. **langgraph-prebuilt==1.0.9** — pin explicitly, v1.0.2 had breaking changes
6. **Use .invoke() or .stream()** — not .ainvoke() (HITL middleware issues)
7. **Embedding spaces don't mix** — multimodal-3.5 for video_segments, voyage-4 for content_memory
8. **user_id hardcoded** to "editor_mikiko" — no multi-user auth
9. **No video rendering** — output is cut lists, not mp4 files
10. **DEMO_FALLBACK_MODE** must work — demo must run without API keys if needed

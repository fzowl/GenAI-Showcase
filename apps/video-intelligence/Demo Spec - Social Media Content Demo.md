# **Social Media Content Editor Agent — Demo Context**

---

## **1\. Executive Summary**

This demo extends Apoorva Joshi's existing Agentic Video Search system into a Social Media Content Editor Agent. The scenario: after every MongoDB .local event, the social media team needs to cut highlight clips from keynote recordings. Today this is manual, slow, and requires watching hours of footage. The agent automates this by combining multimodal video understanding with audio transcription, stored stakeholder feedback, and memory of past social campaigns — all backed by MongoDB Atlas.

[https://github.com/mongodb-developer/GenAI-Showcase/tree/main/apps/video-intelligence](https://github.com/mongodb-developer/GenAI-Showcase/tree/main/apps/video-intelligence)

The demo showcases three MongoDB capabilities in one coherent scenario: vector search on multimodal embeddings (video \+ audio \+ text), the document model for heterogeneous memory storage, and agent memory that accumulates intelligence across sessions.

**Customer grounding:** This demo is inspired by a real customer scenario. A major media and entertainment customer has expressed interest in exactly this pattern — video analysis with multi-stakeholder feedback and agent memory. Their teams route every cut through 40-50 reviewers leaving timestamped comments for social asset creation and brand compliance. The demo intro should establish this upfront so the audience knows it's not contrived.

---

## **2\. What We're Building On**

### **2.1 Apoorva's Agentic Video Search (Existing)**

The current demo in the GenAI Showcase repository provides:

* Video segmentation via ffmpeg using caption timestamps  
* Joint video \+ caption embedding using voyage-multimodal-3.5  
* LLM-as-a-router pattern: Claude routes queries to vector search, full-text search, or hybrid search  
* MongoDB Atlas for storing segment embeddings and metadata

**Status:** Confirmed working in current state. New features not yet built.

### **2.2 Thibaut's Vision RAG Blog (Conceptual Reference)**

[https://www.mongodb.com/company/blog/technical/vision-rag-enabling-search-on-any-documents](https://www.mongodb.com/company/blog/technical/vision-rag-enabling-search-on-any-documents)

Demonstrates that multimodal embeddings can replace OCR/parsing for document search. Minimal implementation (numpy, no database). Useful as a conceptual proof point but not architecturally relevant to the demo.

### **2.3 What This Demo Adds**

| Capability | Apoorva's Demo | This Demo |
| ----- | ----- | ----- |
| Audio processing | Captions only (pre-existing) | STT transcription \+ speaker diarization from raw audio |
| Agent memory | None (stateless) | Style, content, and project memory across sessions |
| Stakeholder feedback | None | Multi-user feedback stored as documents, conflict detection |
| Output | Search results (matching video segments) | Cut list: thumbnails \+ timestamps \+ captions \+ social copy |
| Agent architecture | Single agent with routing | Two agents: video analysis agent \+ social content generation agent |
| Use case framing | "Search within videos" | "Generate social media content from event footage" |

---

## **3\. Audio Processing: Tools & Recommendations**

Adding audio as a first-class modality requires two capabilities: speech-to-text transcription (to get timestamped text from the audio track) and speaker diarization (to know who said what). Below is the landscape of tools evaluated.

### **3.1 Speech-to-Text (STT) Options**

| Tool | Type | Diarization | Accuracy | Cost | Notes |
| ----- | ----- | ----- | ----- | ----- | ----- |
| **OpenAI Whisper (whisper-1)** | API | No (separate model needed) | \~5-6% WER English | $0.006/min | Mature, widely used. 25MB file limit. |
| **gpt-4o-transcribe** | API | Yes (gpt-4o-transcribe-diarize) | SOTA (lower WER than Whisper) | Higher than Whisper | Best accuracy. Native diarization variant available. |
| **ElevenLabs Scribe v2** | API | No | High (90+ languages) | $0.28/hr (Business) | Best known for TTS. STT is strong. Can transcribe from URL including YouTube. |
| **AssemblyAI** | API | Yes (built-in) | High \+ sentiment analysis | Usage-based | All-in-one: STT \+ diarization \+ sentiment \+ topic detection. |
| **Deepgram** | API | Yes (built-in) | High, fast | Usage-based | Strong real-time. Good multichannel support. |
| **Whisper (self-hosted)** | Open source | No (pair with pyannote) | \~5-6% WER | Free (GPU costs) | Full control. Requires GPU infrastructure. |

### **3.2 Speaker Diarization Options**

| Tool | Type | Strengths | Integration | Notes |
| ----- | ----- | ----- | ----- | ----- |
| **pyannote.audio 4.0** | Open source (Python/PyTorch) | SOTA open-source. community-1 model. Exclusive diarization mode for clean STT alignment. | Pairs with Whisper. Runs locally on GPU. | CC-BY-4.0 license. Premium precision-2 model also available via API. |
| **gpt-4o-transcribe-diarize** | API (OpenAI) | Integrated STT \+ diarization in one call. No extra setup. | Single API call. | Simplest path. Speaker labels on each word. |
| **AssemblyAI** | API | 30% better in noisy environments. 250ms short-segment accuracy. | Enable speaker\_labels in API call. | Also provides per-speaker sentiment analysis. |
| **Deepgram** | API | Fast. Good multichannel support. | diarize=true query param. | Speaker confidence scores included. |

### **3.3 Recommendation for This Demo**

**Primary recommendation: OpenAI gpt-4o-transcribe-diarize**

This gives us STT \+ diarization in a single API call with no additional infrastructure. For a keynote recording with 2-3 speakers (CJ, interviewee, etc.), this is the simplest path with SOTA accuracy. It also avoids adding another vendor dependency beyond what the demo already uses (OpenAI/Anthropic for LLM, Voyage AI for embeddings).

**Fallback / open-source option: Whisper (self-hosted or API) \+ pyannote.audio 4.0**

If we want to tell a stronger open-source story or need finer control over diarization parameters, pairing Whisper with pyannote is the standard open-source stack. pyannote's community-1 model's exclusive diarization mode simplifies alignment between speaker labels and transcription timestamps.

**Not recommended for this demo: ElevenLabs**

ElevenLabs excels at TTS (text-to-speech) and voice cloning but its STT capabilities are secondary to its core product. It lacks native diarization. However, if a future iteration of the demo includes voiceover generation for social clips, ElevenLabs TTS would be the natural addition.

---

## **4\. System Architecture**

### **4.1 Two-Agent Architecture**

The system uses two specialized agents orchestrated via LangGraph:

**Agent 1: Video Analysis Agent** — Handles ingestion, segmentation, embedding, and search. This is the extension of Apoorva's existing demo. Takes raw keynote video, extracts audio, runs STT \+ diarization, segments video at natural boundaries, embeds segments jointly (video \+ transcript) via voyage-multimodal-3.5, and stores everything in MongoDB Atlas. At query time, routes user queries to the appropriate search strategy (vector, full-text, or hybrid).

**Agent 2: Social Content Generation Agent** — Takes the retrieved segments \+ stakeholder feedback \+ memory context and produces the social media cut list. Handles feedback consolidation, conflict resolution, brand alignment, and caption/copy generation. This is where agent memory has the most visible impact — the quality of this agent's output is directly shaped by what it remembers from past sessions.

The key insight for the audience: the agent is taking action, and the quality of that action is impacted not just by the primitives underneath (embedding model, LLM) but by how the data is modeled through agent memory.

### **4.2 Pipeline Phases**

**Phase 1: Ingest (Pre-baked, not live)**

* Raw keynote video from previous .local events (SF, London)  
* ffmpeg extracts audio track from video  
* STT \+ diarization produces timestamped, speaker-labeled transcript  
* Video segmented at natural speech boundaries (speaker turns, topic shifts)  
* Each segment jointly embedded (video frames \+ transcript text) via voyage-multimodal-3.5  
* Segments \+ embeddings \+ metadata stored in MongoDB Atlas

**Phase 2: Interactive Editor Session (Live in demo)**

* Social media editor (demo presenter) queries the agent: "Find the moment where CJ talks about resilience"  
* Agent 1 routes query via LLM-as-a-router to vector search, full-text search, or hybrid  
* Results displayed with thumbnails \+ timestamps \+ transcript excerpt  
* Editor reviews existing stakeholder feedback (stored comments from CJ, Oz, etc.)  
* Agent flags conflicting feedback, asks editor to resolve (human-in-the-loop)  
* Editor provides direction: "Use this clip, ignore that note"

**Phase 3: Generation (Live or pre-baked)**

* Agent 2 consolidates: selected clips \+ resolved feedback \+ memory of past campaigns  
* Produces cut list: 5-6 suggested clips with thumbnail previews, timestamps, captions, and social copy  
* Output is the cut list, not rendered video clips (scoping decision from planning meeting)

### **4.3 MongoDB Collections**

| Collection | Document Shape | MongoDB Feature |
| ----- | ----- | ----- |
| **video\_segments** | segment\_id, video\_id, embedding\[\], transcript, speaker\_label, timestamps, metadata | Vector Search index on embedding field. Full-text index on transcript. |
| **stakeholder\_feedback** | feedback\_id, video\_id, timestamp\_range, author, comment\_text, created\_at | Document model: heterogeneous feedback from multiple users in one collection. |
| **style\_memory** | user\_id, preferred\_clip\_lengths, pacing\_prefs, transition\_style, accepted/rejected history | Flexible schema updated after each editing session. |
| **content\_memory** | clip\_id, video\_source, hook\_text, embedding\[\], posted\_at, platform, engagement\_metrics | Vector Search to check similarity against previously posted content. |
| **project\_memory** | campaign\_id, event\_name, series\_context, brand\_voice\_rules, editorial\_calendar | Document model: structured metadata \+ embedded brand voice fingerprints. |

---

## **5\. Agent Memory Patterns**

This is the core differentiator for the demo. The thesis: agents without memory repeat mistakes, ignore context, and produce generic output. Agents with memory get better over time.

### **5.1 The "Why MongoDB for Memory" Message**

Per Krista's request: we need a sharp, repeatable value prop for why MongoDB is the right choice for agent memory, usable across all keynotes.

**The pitch:** Memory patterns are still evolving fast — there's no consensus yet on schemas and read-write patterns. MongoDB's flexible document model means you're not locked into a pattern you'll have to migrate away from later. You can define any memory schema you need, store it natively in Atlas, and search across it with vector search. If you're building custom agent memory, we're there. If you're using an existing framework (LangGraph, Mem0), we're also there as the backend. Run anywhere for AI.

**Three pillars:**

1. Best raw material: Voyage AI embeddings (accuracy) \+ Atlas Vector Search (retrieval) \+ document model (flexibility)  
2. Framework-agnostic: build your own or bring LangGraph, Mem0, etc. — MongoDB is the store underneath all of them  
3. Future-proof: no premature productization that locks you into patterns that are still changing

Frank will add 2-3 concrete memory examples (beyond the personal stylist one already in the script) to drive this home — each using MongoDB as the underlying database, each showing a different memory pattern.

### **5.2 Style Memory**

**What it stores:** Preferred clip lengths per platform (15s for Reels, 60s for LinkedIn), pacing preferences, transition styles, hook structures the editor has approved.

**How it learns:** After each editing session, the agent observes which suggested cuts the editor accepted vs. rejected. Updates a profile document in MongoDB.

**Demo payoff:** First campaign, the agent suggests generic 30s clips. By the third campaign, it's producing 15s Reels-optimized cuts with the editor's preferred hook-first structure.

### **5.3 Content Memory**

**What it stores:** Every clip that's been posted — which footage was used, which hooks were deployed, what topics were covered.

**How it works:** Before suggesting a clip, the agent does vector similarity search against content\_memory to check: "Have I already suggested something too close to this?"

**Demo payoff:** Agent avoids suggesting the same CJ soundbite that was already used in the SF campaign.

### **5.4 Project Memory**

**What it stores:** Active series context, brand voice constraints, editorial calendar, campaign metadata.

**How it works:** When the agent cuts footage, it knows which campaign this belongs to and what the narrative arc needs. Pulls brand guidelines and previous campaign patterns.

**Demo payoff:** Agent generates captions that match MongoDB's social voice, references the right event name, and sequences clips to tell a coherent story.

### **5.5 The Before/After Contrast**

Jeff's latest thinking: we may not need a side-by-side compare/contrast. It might be more effective to just "show the awesome thing" — the agent with memory doing something impressive — and call out what memory enabled. Decision pending, but either approach works with the architecture.

If we do show contrast:

| Without Memory | With Memory |
| ----- | ----- |
| Generic 30s clips regardless of platform | Platform-optimized lengths (15s Reels, 60s LinkedIn) |
| Reuses the same CJ soundbite from last campaign | Avoids duplicate content, surfaces fresh moments |
| Ignores stakeholder feedback from previous rounds | Incorporates and reconciles multi-user feedback |
| Generic captions with no brand voice | Captions matching MongoDB social voice \+ event context |
| Keeps making the same mistakes across campaigns | Gets better and more efficient over time |

---

## **6\. Demo Flow (7 Minutes)**

Based on both planning meetings. Designed for a mixed audience. Every technical point ties back to "why this matters." Two screens: one showing the demo app, one showing a simplified architecture animation (boxes for MongoDB, agent, vector search, human-in-the-loop) so non-technical audience members can follow along.

### **6.1 Setup / Story (1.5 min)**

**Open with customer grounding** (per Dennis's recommendation — do this *before* the demo, not after): "This is inspired by a real customer scenario. Companies that produce media — whether it's streaming shows or corporate events like this one — have teams of 40-50 people leaving timestamped comments on every cut. They need to generate social clips, check brand compliance, identify product placement opportunities. Today that's manual. We built an agent to do it."

Then bring it home: "We do events like this every month. After every event, our social team has to watch hours of keynote footage to find the best moments, cut clips, write captions. So we used our own tools to solve our own problem."

### **6.2 Show the Ingest (1 min)**

Quick walkthrough of the architecture animation (companion screen with simplified boxes — not deep code). Show that raw keynote video was processed: audio extracted, transcribed with speaker labels, video segmented, everything embedded and stored in MongoDB Atlas. The companion screen shows: Video → Agent 1 → MongoDB (vector search, feedback, memory).

### **6.3 Interactive Search (2 min)**

Live (or pre-baked) queries against the video corpus:

* "Find moments where CJ talks about developer experience" → vector search on multimodal embeddings  
* "Find clips mentioning Atlas Vector Search" → hybrid search (full-text on transcript \+ vector on video)  
* Show results: thumbnails \+ timestamps \+ transcript excerpt \+ speaker label

### **6.4 Feedback & Conflict Resolution (1 min)**

Show stored stakeholder feedback:

* CJ: "Make sure you get my good side"  
* Oz: "Highlight the resilience section"  
* Conflicting note: one person says cut a segment, another says keep it

Agent flags the conflict, editor resolves it live. (Human-in-the-loop moment.)

### **6.5 Generate the Cut List (1.5 min)**

Hit "Generate Social Clips" button. Agent 2 produces:

* 5-6 suggested clips with thumbnail previews  
* Timestamps for each clip  
* Captions/descriptions per platform  
* If showing before/after: without memory (generic) vs. with memory (platform-optimized, brand-voiced, deduplicated)  
* Optional: "Human hours saved" metric — "This would have taken X hours manually. The agent did it in Y minutes."

---

## **7\. Technical Decisions**

| Decision | Choice | Rationale |
| ----- | ----- | ----- |
| Agent framework | LangGraph | Existing code, aligns with insurance demo architecture. Practical over new. |
| Agent architecture | Two agents (video analysis \+ social generation) | Separation of concerns. Jeff's script already structured this way. |
| Multimodal embeddings | Voyage AI voyage-multimodal-3.5 | Same as Apoorva's demo. Unified encoder, no modality gap. 1024 dims. |
| STT \+ Diarization | gpt-4o-transcribe-diarize (primary) | Single API call, SOTA accuracy, no infra. Fallback: Whisper \+ pyannote. |
| LLM (router \+ generation) | Claude (Anthropic) | Consistent with existing demo. Handles routing \+ caption generation. |
| Output format | Cut list (thumbnails \+ timestamps \+ captions) | Full clip rendering adds engineering surface area with no MongoDB story. |
| Demo format | Pre-baked with live interaction points | Generation time too long for live. Speedrun with pauses to show features. |
| Companion screen | Simplified architecture animation (boxes) | Non-technical audience members can follow "MongoDB" moving through boxes even if they can't read code. Designer needed. |
| Partner integration story | "Run anywhere for AI" | Build your own memory or bring LangGraph/Mem0 — MongoDB is the store underneath. |

---

## **8\. Stretch Features (Deferred / v2)**

These were discussed and explicitly deferred to keep the 7-minute demo scoped:

* **Guardrails / content safety:** Agent flags expletives or non-brand-safe content and escalates to human. Dennis suggested this. Frank and Mikiko confirmed MongoDB doesn't offer this out of the box today — would need major scaffolding. Deferred to v2.  
* **Style reference upload:** Upload a social clip you like the style of, and the agent analyzes it via the video model and produces cuts that mimic that style while aligning with brand guidelines. Conceptually strong but scope risk.  
* **ElevenLabs TTS voiceover:** Generate voiceover narration for the social clips. High visual impact but adds a vendor and build time.  
* **Human hours saved dashboard:** Show estimated time savings. Simple to add but needs data to be credible.

---

## **9\. Open Questions for the Team**

* **Video source:** Which .local keynote(s) do we use? SF and London? Need to confirm footage rights/availability.  
* **Fake feedback:** Who writes the fake CJ/Oz feedback? Should be humorous but plausible. Jeff mentioned CJ jokes land well.  
* **Before/after vs. "just show awesome":** Jeff's latest lean is to skip the side-by-side and just show the agent with memory doing something impressive. Need to decide.  
* **Companion screen designer:** Jeff wants animated boxes (like Mira/Ralph's sharding animation in SF). Who designs this? Needs to kick off the week after the script is locked.  
* **Partner mention:** Do we explicitly name Mem0 / LangGraph memory integrations on stage? Need to confirm which integrations are current and real. Jeff flagged: "if it is really LangGraph and Mem0, like, let's make sure."  
* **Execution trace depth:** Jeff wants "video comes in, LLM, back" level. Not deep code.  
* **Audio modality depth:** Do we show speaker diarization visually (speaker labels in transcript), or just mention it? Adding sentiment/tone analysis on the audio is possible (AssemblyAI does this natively) but may be scope creep for a 7-min demo.

---

## **10\. Build Plan & Resourcing**

### **Dev Resources**

* **Zoltan** (Frank's contractor, based in Hungary): Worked on RTab, TypeScript/Python SDKs, and some Voyage backend. Familiar with the stack. Frank's recommendation: Zoltan gets 80-90% done from the spec, Mikiko does the last 10% polish. This avoids Mikiko needing to work the full weekend.  
* **Mikiko:** Finalize spec (this document) → share with Frank and Zoltan. Focus on demo script and presentation after the build is underway.  
* **Frank:** Adding 2-3 more memory examples to the keynote script. Coordinating with Zoltan on build.

### **Timeline**

| Date | Milestone | Owner |
| ----- | ----- | ----- |
| Today (Friday) | Spec finalized and shared with Frank \+ Zoltan | Mikiko |
| Weekend | Zoltan begins build from spec (80-90%) | Zoltan |
| Monday | Script work session | Jeff \+ Frank \+ Mikiko |
| Tuesday | Demo-focused working session | Jeff \+ Frank \+ Mikiko |
| Wednesday | Customer presentation (uses current-state demo as baseline) | Mikiko |
| Thursday | CJ review of outline \+ demo direction | Jeff \+ All |
| Following week | Companion screen animation kicked off with designer | Jeff |
| Following week | Script splitting (who says what) — Frank \+ Mikiko pair on this like Frank/Apoorva did for SF | Frank \+ Mikiko |
| T-1 week | Full dry run. NOT the Thursday before like SF. | All |

### **Reusability Note**

Per Frank: we should build high-leverage, reusable artifacts. The demo code, memory pattern examples, and companion screen assets should be designed to work across multiple .local stops, not just London. The customer presentation on Wednesday is the first reuse opportunity.

---

*End of spec. Iterate in the tab Jeff creates.*


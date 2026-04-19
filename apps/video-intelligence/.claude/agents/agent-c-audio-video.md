# Sub-Agent C: Audio + Video Processing

## Role
Build the audio processing pipeline (STT + diarization) and extend the video processor to support transcript and speaker label output. This handles the ingest pipeline — pre-baked, not live during demo.

## Ownership
- `backend/services/audio_service.py` (new)
- `backend/services/video_processor.py` (extend existing)

## Prerequisites
- Sub-Agent A (schemas, dependencies available)

## Tasks

### 1. Create `backend/services/audio_service.py`

```python
class AudioService:
    """Audio extraction, STT + diarization, transcript summaries"""

    async def extract_audio(self, video_path: str, output_path: str) -> str:
        """Extract audio track from video using ffmpeg.
        Command: ffmpeg -i {video_path} -vn -acodec pcm_s16le -ar 16000 -ac 1 {output_path}
        Returns path to extracted audio file."""

    async def transcribe_with_diarization(self, audio_path: str,
                                           known_speaker_names: List[str] = None) -> Dict:
        """Transcribe audio using OpenAI gpt-4o-transcribe-diarize.

        CRITICAL: 25MB file limit. If audio exceeds this:
        1. Split into chunks via ffmpeg
        2. Transcribe each chunk
        3. Reassemble timestamps by adding chunk offset
        4. Speaker labels do NOT persist across chunks — use known_speaker_names
           param to supply reference names for consistency

        For pre-baked demo data, manually verify speaker labels.

        Returns:
        {
            "segments": [
                {
                    "start": 0.0,
                    "end": 34.2,
                    "speaker": "SPEAKER_00",
                    "text": "Welcome to MongoDB .local London..."
                },
                ...
            ],
            "full_transcript": "...",
            "speakers": ["SPEAKER_00", "SPEAKER_01"]
        }
        """

    async def generate_transcript_summary(self, transcript: str, speaker_label: str) -> str:
        """Generate a 1-2 sentence summary of a transcript segment via Claude.
        Stored as transcript_summary on each video_segments document.
        Makes cut list output readable on a keynote stage.

        Uses claude-sonnet-4-6, max_tokens=100.

        Prompt: "Summarize this keynote segment in 1-2 sentences.
                 Speaker: {speaker_label}. Transcript: {transcript}"

        Before: "And that's why we built Atlas Vector Search to handle exactly
                 this kind of problem where you need to understand the meaning
                 behind what someone is searching for rather than just matching
                 keywords and that's a fundamental shift in how we..."
        After: "CJ explains why semantic understanding matters more than keyword
                matching for modern search."
        """

    async def process_full_audio(self, video_path: str, video_id: str) -> Dict:
        """Full pipeline: extract audio → transcribe → diarize → summarize segments.
        Returns segment_boundaries list and per-segment transcript data."""
```

**Implementation notes:**
- Use `subprocess` or `asyncio.create_subprocess_exec` for ffmpeg commands
- OpenAI client already exists in ai_service.py — reuse or create new instance
- Anthropic client needed for transcript summaries — initialize with ANTHROPIC_API_KEY
- For large batch ingest, the spec mentions using Anthropic Batch API at 50% off standard rates (future optimization, not needed now)

### 2. Extend `backend/services/video_processor.py`

Modify the existing `process_video` method and `_extract_frames_with_progress` to:

1. **Call audio_service** to extract audio and get transcripts:
   ```python
   from services.audio_service import audio_service
   # After extracting frames, also process audio
   audio_result = await audio_service.process_full_audio(str(video_path), video_id)
   ```

2. **Add transcript + speaker_label to frame data:**
   Each frame document should now include:
   ```python
   frame_data = {
       "frame_number": extracted_frames,
       "timestamp": timestamp,
       "file_path": str(frame_path),
       "thumbnail_path": str(thumbnail_path),
       "transcript": "...",           # NEW: text from this segment
       "transcript_summary": "...",   # NEW: 1-2 sentence summary
       "speaker_label": "SPEAKER_00", # NEW: speaker ID
       "metadata": { ... }
   }
   ```

3. **Output segment_boundaries** in the video metadata:
   ```python
   video_metadata["segment_boundaries"] = audio_result["segments"]
   ```

4. **Match transcripts to frames by timestamp:**
   For each extracted frame, find the audio segment that covers its timestamp and attach the transcript/speaker data.

**Important:** The existing code processes frames in batches with `_process_and_save_frame_batch`. The transcript matching should happen before or during this batch processing so each frame document stored in MongoDB includes its transcript data.

### 3. Handle DEMO_FALLBACK_MODE
When `DEMO_FALLBACK_MODE=true`:
- `extract_audio` returns a placeholder
- `transcribe_with_diarization` returns pre-defined transcript data (from seed data)
- `generate_transcript_summary` returns a hardcoded summary
- This lets the demo run without OpenAI STT API access

## Acceptance Criteria
- [ ] `audio_service.extract_audio()` extracts audio from a test video via ffmpeg
- [ ] `audio_service.transcribe_with_diarization()` returns timestamped, speaker-labeled segments
- [ ] `audio_service.generate_transcript_summary()` returns 1-2 sentence summary via Claude
- [ ] Video processor stores transcript + speaker_label + transcript_summary on each frame document
- [ ] segment_boundaries are stored on the video metadata document
- [ ] DEMO_FALLBACK_MODE works with hardcoded responses
- [ ] Files > 25MB are split into chunks and reassembled

## Output
Other agents depend on:
- Transcript data being available on video segment documents (for search and agent prompts)
- segment_boundaries being on project documents (for feedback timestamp defaulting)

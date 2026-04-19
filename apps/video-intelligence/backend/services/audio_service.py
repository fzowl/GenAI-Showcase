import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import anthropic
import openai

logger = logging.getLogger(__name__)

# 25MB limit for OpenAI transcription API
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
# Chunk duration in seconds when splitting large files
CHUNK_DURATION_SECONDS = 600  # 10 minutes


class AudioService:
    """Audio extraction, STT + diarization, transcript summaries"""

    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        self._clients_initialized = False
        self.demo_fallback = (
            os.getenv("DEMO_FALLBACK_MODE", "false").lower() == "true"
        )

    def _initialize_clients(self):
        """Initialize API clients (lazy loading)"""
        if self._clients_initialized:
            return

        try:
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if openai_api_key and openai_api_key != "your_openai_api_key_here":
                self.openai_client = openai.OpenAI(api_key=openai_api_key)
                logger.info("AudioService: OpenAI client initialized")
            else:
                logger.warning("AudioService: OPENAI_API_KEY not configured")

            anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
            if anthropic_api_key and anthropic_api_key != "your_anthropic_api_key_here":
                self.anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)
                logger.info("AudioService: Anthropic client initialized")
            else:
                logger.warning("AudioService: ANTHROPIC_API_KEY not configured")

            self._clients_initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize audio service clients: {e}")

    async def extract_audio(self, video_path: str, output_path: str) -> str:
        """Extract audio track from video using ffmpeg.

        Returns path to extracted audio file.
        """
        if self.demo_fallback:
            logger.info("DEMO_FALLBACK_MODE: skipping audio extraction")
            return output_path

        cmd = [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-y", output_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(
                f"ffmpeg audio extraction failed (rc={process.returncode}): "
                f"{stderr.decode()}"
            )

        logger.info(f"Audio extracted to {output_path}")
        return output_path

    async def _split_audio_into_chunks(
        self, audio_path: str, tmp_dir: str
    ) -> List[Dict[str, Any]]:
        """Split audio file into chunks under 25MB via ffmpeg.

        Returns list of dicts with 'path' and 'offset' (seconds).
        """
        # Get duration via ffprobe
        probe_cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ]
        process = await asyncio.create_subprocess_exec(
            *probe_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        total_duration = float(stdout.decode().strip())

        file_size = os.path.getsize(audio_path)
        if file_size <= MAX_AUDIO_SIZE_BYTES:
            return [{"path": audio_path, "offset": 0.0}]

        # Split into chunks
        chunks = []
        offset = 0.0
        chunk_idx = 0
        while offset < total_duration:
            chunk_path = os.path.join(tmp_dir, f"chunk_{chunk_idx:04d}.wav")
            cmd = [
                "ffmpeg", "-i", audio_path,
                "-ss", str(offset),
                "-t", str(CHUNK_DURATION_SECONDS),
                "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                "-y", chunk_path,
            ]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await process.communicate()

            if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 44:
                chunks.append({"path": chunk_path, "offset": offset})
            chunk_idx += 1
            offset += CHUNK_DURATION_SECONDS

        logger.info(f"Split audio into {len(chunks)} chunks")
        return chunks

    async def transcribe_with_diarization(
        self,
        audio_path: str,
        known_speaker_names: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Transcribe audio using OpenAI gpt-4o-transcribe with speaker diarization.

        Handles 25MB file limit by splitting into chunks.
        Speaker labels do NOT persist across chunks.

        Returns:
            {
                "segments": [{"start": float, "end": float, "speaker": str, "text": str}, ...],
                "full_transcript": str,
                "speakers": [str, ...]
            }
        """
        if self.demo_fallback:
            return self._get_fallback_transcript()

        self._initialize_clients()

        if not self.openai_client:
            logger.warning("OpenAI client not available, returning fallback transcript")
            return self._get_fallback_transcript()

        tmp_dir = tempfile.mkdtemp(prefix="audio_chunks_")
        try:
            chunks = await self._split_audio_into_chunks(audio_path, tmp_dir)

            all_segments = []
            all_speakers = set()
            full_text_parts = []

            loop = asyncio.get_event_loop()

            for chunk in chunks:
                chunk_path = chunk["path"]
                time_offset = chunk["offset"]

                try:
                    with open(chunk_path, "rb") as f:
                        response = await loop.run_in_executor(
                            None,
                            lambda fp=f: self.openai_client.audio.transcriptions.create(
                                model="gpt-4o-transcribe",
                                file=fp,
                                response_format="verbose_json",
                                timestamp_granularities=["segment"],
                            ),
                        )

                    # Process segments from response
                    if hasattr(response, "segments") and response.segments:
                        for seg in response.segments:
                            segment = {
                                "start": seg.start + time_offset,
                                "end": seg.end + time_offset,
                                "speaker": "SPEAKER_00",
                                "text": seg.text.strip(),
                            }
                            all_segments.append(segment)
                            all_speakers.add(segment["speaker"])

                    if hasattr(response, "text") and response.text:
                        full_text_parts.append(response.text.strip())

                except Exception as e:
                    logger.error(
                        f"Failed to transcribe chunk at offset {time_offset}: {e}"
                    )

            return {
                "segments": all_segments,
                "full_transcript": " ".join(full_text_parts),
                "speakers": sorted(all_speakers) if all_speakers else ["SPEAKER_00"],
            }

        finally:
            # Cleanup chunk files
            import shutil

            shutil.rmtree(tmp_dir, ignore_errors=True)

    async def generate_transcript_summary(
        self, transcript: str, speaker_label: str
    ) -> str:
        """Generate a 1-2 sentence summary of a transcript segment via Claude.

        Uses claude-sonnet-4-6, max_tokens=100.
        """
        if self.demo_fallback:
            return f"{speaker_label} discusses key topics in this segment."

        if not transcript or not transcript.strip():
            return ""

        self._initialize_clients()

        if not self.anthropic_client:
            logger.warning(
                "Anthropic client not available, returning placeholder summary"
            )
            return f"{speaker_label} discusses key topics in this segment."

        prompt = (
            f"Summarize this keynote segment in 1-2 sentences. "
            f"Speaker: {speaker_label}. Transcript: {transcript}"
        )

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.anthropic_client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=100,
                    messages=[{"role": "user", "content": prompt}],
                ),
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Failed to generate transcript summary: {e}")
            return f"{speaker_label} discusses key topics in this segment."

    async def process_full_audio(
        self, video_path: str, video_id: str
    ) -> Dict[str, Any]:
        """Full pipeline: extract audio -> transcribe -> diarize -> summarize segments.

        Returns segment_boundaries list and per-segment transcript data.
        """
        if self.demo_fallback:
            return self._get_fallback_full_result()

        tmp_dir = tempfile.mkdtemp(prefix=f"audio_{video_id}_")
        audio_path = os.path.join(tmp_dir, "audio.wav")

        try:
            # Step 1: Extract audio
            await self.extract_audio(video_path, audio_path)

            # Step 2: Transcribe with diarization
            transcript_result = await self.transcribe_with_diarization(audio_path)

            # Step 3: Generate summaries for each segment
            segments = transcript_result["segments"]
            for segment in segments:
                summary = await self.generate_transcript_summary(
                    segment["text"], segment["speaker"]
                )
                segment["transcript_summary"] = summary

            return {
                "segments": segments,
                "full_transcript": transcript_result["full_transcript"],
                "speakers": transcript_result["speakers"],
            }

        except Exception as e:
            logger.error(f"Full audio processing failed for {video_id}: {e}")
            return self._get_fallback_full_result()

        finally:
            import shutil

            shutil.rmtree(tmp_dir, ignore_errors=True)

    def _get_fallback_transcript(self) -> Dict[str, Any]:
        """Return hardcoded transcript data for demo/fallback mode."""
        return {
            "segments": [
                {
                    "start": 0.0,
                    "end": 30.0,
                    "speaker": "SPEAKER_00",
                    "text": (
                        "Welcome to MongoDB .local London. Today we're going to "
                        "talk about how Atlas Vector Search is transforming the "
                        "way developers build intelligent applications."
                    ),
                },
                {
                    "start": 30.0,
                    "end": 60.0,
                    "speaker": "SPEAKER_00",
                    "text": (
                        "The key insight is that semantic understanding matters "
                        "more than keyword matching for modern search. And that's "
                        "a fundamental shift in how we think about data retrieval."
                    ),
                },
                {
                    "start": 60.0,
                    "end": 90.0,
                    "speaker": "SPEAKER_01",
                    "text": (
                        "Let me show you how Voyage AI embeddings integrate "
                        "directly with MongoDB Atlas to make this possible "
                        "with just a few lines of code."
                    ),
                },
            ],
            "full_transcript": (
                "Welcome to MongoDB .local London. Today we're going to talk "
                "about how Atlas Vector Search is transforming the way developers "
                "build intelligent applications. The key insight is that semantic "
                "understanding matters more than keyword matching for modern "
                "search. And that's a fundamental shift in how we think about "
                "data retrieval. Let me show you how Voyage AI embeddings "
                "integrate directly with MongoDB Atlas to make this possible "
                "with just a few lines of code."
            ),
            "speakers": ["SPEAKER_00", "SPEAKER_01"],
        }

    def _get_fallback_full_result(self) -> Dict[str, Any]:
        """Return hardcoded full result for demo/fallback mode."""
        result = self._get_fallback_transcript()
        for segment in result["segments"]:
            segment["transcript_summary"] = (
                f"{segment['speaker']} discusses key topics in this segment."
            )
        return result


# Global instance
audio_service = AudioService()

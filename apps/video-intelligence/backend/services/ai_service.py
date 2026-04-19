import asyncio
import base64
import json
import logging
import os
from typing import Any, Dict, List

import openai
import voyageai
from PIL import Image

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.voyage_client = None
        self.openai_client = None
        self.anthropic_client = None
        self._clients_initialized = False
        self.demo_fallback = (
            os.getenv("DEMO_FALLBACK_MODE", "false").lower() == "true"
        )

        # Get embedding dimensions from environment variable
        self.EMBEDDING_DIM_SIZE = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))
        logger.info(
            f"AI service initialized with embedding dimensions: {self.EMBEDDING_DIM_SIZE}"
        )

    def _initialize_clients(self):
        """Initialize AI service clients (lazy loading)"""
        if self._clients_initialized:
            return

        try:
            # Initialize Voyage AI client
            voyage_api_key = os.getenv("VOYAGE_AI_API_KEY")
            if voyage_api_key and voyage_api_key != "your_voyage_ai_api_key_here":
                self.voyage_client = voyageai.Client(api_key=voyage_api_key)
                logger.info("Voyage AI client initialized")
            else:
                logger.warning("VOYAGE_AI_API_KEY not found or using placeholder value")

            # Initialize OpenAI client
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if openai_api_key and openai_api_key != "your_openai_api_key_here":
                self.openai_client = openai.OpenAI(api_key=openai_api_key)
                logger.info("OpenAI client initialized")
            else:
                logger.warning("OPENAI_API_KEY not found or using placeholder value")

            # Initialize Anthropic client
            anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
            if anthropic_api_key and anthropic_api_key != "your_anthropic_api_key_here":
                import anthropic
                self.anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)
                logger.info("Anthropic client initialized")
            else:
                logger.warning("ANTHROPIC_API_KEY not found or using placeholder value")

            self._clients_initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize AI clients: {e}")

    async def get_voyage_embedding(
        self, data, input_type: str = "document"
    ) -> List[float]:
        """
        Get Voyage AI multimodal embeddings for images and text.

        Args:
            data: PIL Image object, image file path, or text string
            input_type: "document" or "query"

        Returns:
            List of embeddings
        """
        try:
            # Initialize clients if not done yet
            self._initialize_clients()

            if not self.voyage_client:
                raise ValueError("Voyage AI client not initialized")

            # Handle different input types
            if isinstance(data, str) and data.endswith(
                (".jpg", ".jpeg", ".png", ".gif", ".bmp")
            ):
                # For image file paths, load the image with PIL
                image = Image.open(data)
                embed_data = image
            elif hasattr(data, "mode"):  # PIL Image object
                # Already a PIL Image
                embed_data = data
            else:
                # Text data
                embed_data = data

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.voyage_client.multimodal_embed(
                    inputs=[[embed_data]],
                    model="voyage-multimodal-3.5",
                    input_type=input_type,
                ),
            )

            return result.embeddings[0]

        except Exception as e:
            logger.error(f"Failed to get Voyage embedding: {e}")
            # Return dummy embedding for development/testing
            return [0.0] * self.EMBEDDING_DIM_SIZE

    async def generate_frame_description(self, image_path: str) -> str:
        """
        Generate detailed description of a video frame using GPT-4 Vision

        Args:
            image_path: Path to the frame image

        Returns:
            Detailed description of the frame
        """
        try:
            # Initialize clients if not done yet
            self._initialize_clients()

            if not self.openai_client:
                logger.warning(
                    "OpenAI client not available, using placeholder description"
                )
                return "Frame description unavailable - OpenAI API key not configured"

            # Convert image to base64
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode()

            prompt = """Analyze this video frame and provide a detailed description including:
1. Main subjects or people in the scene
2. Actions or activities taking place
3. Setting/environment (indoor/outdoor, location type)
4. Objects, props, or notable elements
5. Overall mood or atmosphere
6. Any text or graphics visible

Keep the description concise but informative, around 2-3 sentences."""

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_data}",
                                        "detail": "low",
                                    },
                                },
                            ],
                        }
                    ],
                    max_tokens=300,
                ),
            )

            description = response.choices[0].message.content.strip()
            return description

        except Exception as e:
            logger.error(f"Failed to generate frame description: {e}")
            return f"Frame at {image_path} - description generation failed"

    async def get_query_embedding(self, query_text: str) -> List[float]:
        """Get embedding for search query"""
        try:
            return await self.get_voyage_embedding(query_text, "query")
        except Exception as e:
            logger.error(f"Failed to get query embedding: {e}")
            return [0.0] * self.EMBEDDING_DIM_SIZE

    async def get_text_embedding(self, text: str, input_type: str = "document") -> List[float]:
        """Get text embedding using voyage-4 (for content_memory).
        IMPORTANT: voyage-multimodal-3.5 and voyage-4 are in DIFFERENT embedding spaces.
        Cannot mix in the same index. video_segments uses multimodal-3.5, content_memory uses voyage-4."""
        try:
            self._initialize_clients()
            if not self.voyage_client:
                raise ValueError("Voyage AI client not initialized")

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.voyage_client.embed(
                    texts=[text],
                    model="voyage-4",
                    input_type=input_type,
                ),
            )
            return result.embeddings[0]
        except Exception as e:
            logger.error(f"Failed to get text embedding: {e}")
            return [0.0] * self.EMBEDDING_DIM_SIZE

    async def rerank_results(self, query: str, documents: List[str], top_k: int = 10) -> List[Dict[str, Any]]:
        """Rerank search results using Voyage rerank-2.5.
        This is a cross-encoder that jointly processes query + each document
        for more accurate relevance scoring than embedding similarity alone.

        NOTE: rerank-2.5 supports instruction-following via query prepend.
        We prepend task-specific instructions to steer relevance scoring.

        Args:
            query: Original search query
            documents: List of transcript texts from candidate segments
            top_k: Number of results to return

        Returns: List of {index, relevance_score} sorted by score descending
        """
        if self.demo_fallback:
            logger.info("DEMO_FALLBACK_MODE: skipping Voyage reranking")
            return [{"index": i, "relevance_score": 1.0 - (i * 0.05)} for i in range(min(top_k, len(documents)))]

        try:
            self._initialize_clients()
            if not self.voyage_client:
                raise ValueError("Voyage AI client not initialized")

            instruction = "Prioritize segments where the speaker directly addresses the audience. "
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.voyage_client.rerank(
                    query=instruction + query,
                    documents=documents,
                    model="rerank-2.5",
                    top_k=top_k,
                ),
            )
            return [{"index": r.index, "relevance_score": r.relevance_score} for r in result.results]
        except Exception as e:
            logger.error(f"Failed to rerank results: {e}")
            return [{"index": i, "relevance_score": 1.0 - (i * 0.05)} for i in range(min(top_k, len(documents)))]

    async def analyze_style_reference(self, frames: List[str]) -> Dict[str, Any]:
        """Analyze style from reference clip frames via Claude.

        Args:
            frames: List of base64-encoded frame images

        Returns:
            Dict with pacing, hook_structure, caption_tone, format_notes
        """
        fallback_result = {
            "pacing": "Fast cuts, ~3-4 per 10 seconds, average shot duration 2.5s",
            "hook_structure": "Bold text overlay in first frame, speaker direct-to-camera within 1s",
            "caption_tone": "Casual, conversational, light emoji usage, short punchy sentences",
            "format_notes": "9:16 vertical, bold sans-serif text overlays, trending jump-cut style",
        }

        if self.demo_fallback:
            logger.info("DEMO_FALLBACK_MODE: returning hardcoded style analysis")
            return fallback_result

        try:
            self._initialize_clients()
            if not self.anthropic_client:
                logger.warning("Anthropic client not available, returning fallback style analysis")
                return fallback_result

            prompt = (
                "Analyze these frames from a social media reference clip. "
                "Describe the style in terms of:\n"
                "- pacing: how many cuts per 10 seconds, average shot duration\n"
                "- hook_structure: how the first 2 seconds grab attention\n"
                "- caption_tone: formal/casual/playful, emoji usage, sentence length\n"
                "- format_notes: aspect ratio, text overlay style, any trending patterns\n\n"
                'Return as JSON matching: {"pacing": "...", "hook_structure": "...", '
                '"caption_tone": "...", "format_notes": "..."}'
            )

            # Build content with frames as images
            content: List[Dict[str, Any]] = []
            for frame_b64 in frames[:20]:  # Limit to 20 frames for token budget
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": frame_b64,
                    },
                })
            content.append({"type": "text", "text": prompt})

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.anthropic_client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=1024,
                    messages=[{"role": "user", "content": content}],
                ),
            )

            response_text = response.content[0].text
            # Parse JSON from response (handle markdown code blocks)
            if "```" in response_text:
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()
            return json.loads(response_text)
        except Exception as e:
            logger.error(f"Failed to analyze style reference: {e}")
            return fallback_result


# Global instance
ai_service = AIService()

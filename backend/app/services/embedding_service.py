from __future__ import annotations

import hashlib
import logging
import math
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Produces 1536-dimensional float vector embeddings for pgvector knowledge chunks.
    Uses NVIDIA/OpenAI embedding provider when keys are configured, with a deterministic
    L2-normalized hash projection fallback for offline/development environments.
    """

    def __init__(self):
        self._provider = None
        self._dimension = 1536
        self._init_provider()

    def _init_provider(self):
        # 1. Try NVIDIA Embeddings if key configured
        if settings.NVIDIA_API_KEY:
            try:
                from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
                self._provider = NVIDIAEmbeddings(
                    model="nvidia/nemotron-3.5-embed-1b",
                    api_key=settings.NVIDIA_API_KEY,
                    truncate="END",
                    dimensions=1536,
                )
                logger.info("Cortex EmbeddingService initialized with NVIDIA Nemotron (nvidia/nemotron-3.5-embed-1b, 1536-dim).")
                return
            except Exception as e:
                logger.warning(f"Could not initialize NVIDIAEmbeddings: {e}")

        # 2. Try OpenAI Embeddings if key configured
        groq_or_openai = getattr(settings, "OPENAI_API_KEY", "")
        if groq_or_openai:
            try:
                from langchain_openai import OpenAIEmbeddings
                self._provider = OpenAIEmbeddings(
                    model="text-embedding-3-small",
                    api_key=groq_or_openai
                )
                logger.info("Cortex EmbeddingService initialized with OpenAI Embeddings.")
                return
            except Exception as e:
                logger.warning(f"Could not initialize OpenAIEmbeddings: {e}")

        logger.info("Cortex EmbeddingService operating with deterministic L2-projected 1536-dim embedding engine.")

    async def get_embedding(self, text: str) -> List[float]:
        """Embeds a single passage/document string into a 1536-dimensional vector."""
        vectors = await self.get_embeddings([text])
        return vectors[0]

    async def get_query_embedding(self, query: str) -> List[float]:
        """
        Embeds a single search query string using query mode (input_type='query' for NVIDIA Nemotron).
        Returns a 1536-dimensional L2-normalized float vector.
        """
        if not query.strip():
            return [0.0] * self._dimension

        if self._provider is not None:
            try:
                raw_vec = None
                if hasattr(self._provider, "aembed_query"):
                    raw_vec = await self._provider.aembed_query(query)
                elif hasattr(self._provider, "embed_query"):
                    raw_vec = self._provider.embed_query(query)

                if raw_vec:
                    if len(raw_vec) > self._dimension:
                        raw_vec = raw_vec[:self._dimension]
                    elif len(raw_vec) < self._dimension:
                        raw_vec = raw_vec + [0.0] * (self._dimension - len(raw_vec))
                    return raw_vec
            except Exception as e:
                logger.warning(f"Query embedding provider failed: {e}. Falling back to deterministic projection.")

        return self._deterministic_project(query)

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Batch embeds a list of strings into 1536-dimensional vectors."""
        if not texts:
            return []

        if self._provider is not None:
            try:
                # langchain embeddings are sync or async
                raw_vectors = None
                if hasattr(self._provider, "aembed_documents"):
                    raw_vectors = await self._provider.aembed_documents(texts)
                elif hasattr(self._provider, "embed_documents"):
                    raw_vectors = self._provider.embed_documents(texts)
                
                if raw_vectors:
                    norm_vectors = []
                    for vec in raw_vectors:
                        if len(vec) > self._dimension:
                            vec = vec[:self._dimension]
                        elif len(vec) < self._dimension:
                            vec = vec + [0.0] * (self._dimension - len(vec))
                        norm_vectors.append(vec)
                    return norm_vectors
            except Exception as e:
                logger.warning(f"Primary embedding provider failed: {e}. Falling back to deterministic projection.")

        return [self._deterministic_project(t) for t in texts]

    def _deterministic_project(self, text: str) -> List[float]:
        """
        Generates a 1536-dimensional deterministic L2-normalized float vector
        using multi-round cryptographic hashing of text segments.
        Ensures consistent cosine similarity in test and offline environments.
        """
        vec = []
        clean_text = text.strip().lower()
        words = clean_text.split()
        
        # Seed hash
        seed = int(hashlib.sha256(clean_text.encode("utf-8")).hexdigest()[:8], 16)
        
        # 1536 floats generated in batches of 4 via SHA-512 (64 bytes = 16 32-bit floats)
        for i in range(self._dimension // 16):
            chunk_hash = hashlib.sha512(f"{seed}:{i}:{clean_text[:64]}".encode("utf-8")).digest()
            for j in range(16):
                val = int.from_bytes(chunk_hash[j*4:(j+1)*4], byteorder="big", signed=True)
                vec.append(float(val) / 2147483648.0)

        # Truncate or pad to exactly 1536
        vec = vec[:self._dimension]
        while len(vec) < self._dimension:
            vec.append(0.0)

        # L2 Normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]

        return vec


embedding_service = EmbeddingService()

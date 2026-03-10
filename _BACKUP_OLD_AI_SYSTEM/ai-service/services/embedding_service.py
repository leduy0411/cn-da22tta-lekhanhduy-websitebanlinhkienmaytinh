"""Embedding service for RAG chatbot."""
from __future__ import annotations

from typing import Iterable

import numpy as np
from loguru import logger
from sentence_transformers import SentenceTransformer

from config import settings


class EmbeddingService:
    """Wrapper around sentence-transformers with normalized vectors."""

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self._model: SentenceTransformer | None = None

    def load(self) -> None:
        if self._model is not None:
            return
        logger.info(f"Loading embedding model: {self.model_name}")
        self._model = SentenceTransformer(self.model_name)

    def embed_texts(self, texts: Iterable[str]) -> np.ndarray:
        self.load()
        text_list = list(texts)
        if not text_list:
            return np.empty((0, settings.EMBEDDING_DIM), dtype=np.float32)

        vectors = self._model.encode(
            text_list,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.astype(np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        if not query or not query.strip():
            raise ValueError("Query is required")
        vector = self.embed_texts([query])[0]
        return vector.astype(np.float32)

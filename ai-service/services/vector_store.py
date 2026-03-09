"""FAISS vector store for product retrieval."""
from __future__ import annotations

import json
from pathlib import Path

import faiss
import numpy as np
from loguru import logger

from config import settings


class VectorStore:
    """Persistent FAISS index + metadata mapping."""

    def __init__(self, index_name: str = "products") -> None:
        base_path = Path(settings.FAISS_INDEX_PATH)
        base_path.mkdir(parents=True, exist_ok=True)

        self.index_path = base_path / f"{index_name}.faiss"
        self.meta_path = base_path / f"{index_name}_meta.json"
        self.index: faiss.Index | None = None
        self.product_ids: list[str] = []

    @property
    def is_ready(self) -> bool:
        return self.index is not None and len(self.product_ids) > 0

    def initialize(self, dimension: int) -> None:
        self.index = faiss.IndexFlatIP(dimension)
        self.product_ids = []
        logger.info(f"Initialized FAISS index with dimension={dimension}")

    def add_vectors(self, product_ids: list[str], vectors: np.ndarray) -> None:
        if vectors.ndim != 2:
            raise ValueError("Vectors must be a 2D array")
        if len(product_ids) != vectors.shape[0]:
            raise ValueError("product_ids and vectors size mismatch")

        if self.index is None:
            self.initialize(vectors.shape[1])

        normalized = vectors.astype(np.float32)
        faiss.normalize_L2(normalized)
        self.index.add(normalized)
        self.product_ids.extend(product_ids)

    def search(self, query_vector: np.ndarray, top_k: int = 5) -> list[dict]:
        if not self.is_ready:
            return []

        if query_vector.ndim == 1:
            query_vector = np.expand_dims(query_vector, axis=0)

        q = query_vector.astype(np.float32)
        faiss.normalize_L2(q)

        k = min(top_k, len(self.product_ids))
        scores, indices = self.index.search(q, k)

        results: list[dict] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            results.append(
                {
                    "product_id": self.product_ids[idx],
                    "score": float(score),
                }
            )
        return results

    def save(self) -> None:
        if self.index is None:
            raise RuntimeError("Cannot save empty index")

        faiss.write_index(self.index, str(self.index_path))
        self.meta_path.write_text(
            json.dumps({"product_ids": self.product_ids}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info(f"Saved FAISS index to {self.index_path}")

    def load(self) -> bool:
        if not self.index_path.exists() or not self.meta_path.exists():
            return False

        self.index = faiss.read_index(str(self.index_path))
        meta = json.loads(self.meta_path.read_text(encoding="utf-8"))
        self.product_ids = list(meta.get("product_ids", []))
        logger.info(
            f"Loaded FAISS index with {len(self.product_ids)} products from {self.index_path}"
        )
        return True

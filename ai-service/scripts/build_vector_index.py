"""Build FAISS product vector index from MongoDB products collection."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable

from bson import ObjectId
from loguru import logger
from pymongo import MongoClient

# Add ai-service root into PYTHONPATH for script execution compatibility.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import settings
from services.embedding_service import EmbeddingService
from services.vector_store import VectorStore


def product_to_text(product: dict) -> str:
    """Convert product document to retrieval-friendly plain text."""
    specs = product.get("specifications") or {}
    specs_text = ", ".join([f"{k}: {v}" for k, v in specs.items()])

    chunks = [
        f"name: {product.get('name', '')}",
        f"description: {product.get('description', '')}",
        f"category: {product.get('category', '')}",
        f"brand: {product.get('brand', '')}",
        f"price: {product.get('price', '')}",
        f"stock: {product.get('stock', '')}",
        f"rating: {product.get('rating', '')}",
        f"specifications: {specs_text}",
    ]
    return " | ".join(chunks)


def chunked(items: list[dict], size: int) -> Iterable[list[dict]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def normalize_id(value: object) -> str:
    if isinstance(value, ObjectId):
        return str(value)
    return str(value)


def main() -> None:
    logger.info("Starting vector index build...")

    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.DB_NAME]

    products = list(
        db.products.find(
            {},
            {
                "name": 1,
                "description": 1,
                "category": 1,
                "brand": 1,
                "price": 1,
                "stock": 1,
                "rating": 1,
                "specifications": 1,
            },
        )
    )

    if not products:
        logger.warning("No products found, index not created.")
        return

    embedding_service = EmbeddingService()
    vector_store = VectorStore(index_name="products")

    product_ids: list[str] = []
    vectors = []

    for batch in chunked(products, 128):
        texts = [product_to_text(p) for p in batch]
        batch_vectors = embedding_service.embed_texts(texts)
        vectors.append(batch_vectors)
        product_ids.extend([normalize_id(p.get("_id")) for p in batch])

    import numpy as np

    matrix = np.vstack(vectors).astype("float32")
    vector_store.initialize(matrix.shape[1])
    vector_store.add_vectors(product_ids, matrix)
    vector_store.save()

    logger.info(f"Vector index build completed. Indexed products: {len(product_ids)}")


if __name__ == "__main__":
    main()

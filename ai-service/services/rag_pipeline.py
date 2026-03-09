"""RAG pipeline for product-grounded chatbot answers."""
from __future__ import annotations

import os

import google.generativeai as genai  # type: ignore[import-not-found]
from bson import ObjectId
from loguru import logger

from database import get_db
from services.embedding_service import EmbeddingService
from services.vector_store import VectorStore


class RAGPipeline:
    """Retrieve product context from FAISS + generate answer with Gemini."""

    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore(index_name="products")
        self.gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")

        self._gemini_model = None
        self._vector_loaded = self.vector_store.load()
        self._init_gemini()

    def _init_gemini(self) -> None:
        if not self.gemini_api_key:
            logger.warning("GEMINI_API_KEY is not configured. Using retrieval-only fallback.")
            return

        genai.configure(api_key=self.gemini_api_key)
        self._gemini_model = genai.GenerativeModel(self.gemini_model_name)

    async def _fetch_products(self, product_ids: list[str]) -> list[dict]:
        if not product_ids:
            return []

        db = get_db()
        products_by_id: dict[str, dict] = {}

        object_ids = []
        for pid in product_ids:
            try:
                object_ids.append(ObjectId(pid))
            except Exception:
                # Ignore non-ObjectId values and keep query tolerant.
                continue

        cursor = db.products.find({"_id": {"$in": object_ids}})
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            products_by_id[doc["_id"]] = doc

        ordered = [products_by_id[p_id] for p_id in product_ids if p_id in products_by_id]
        return ordered

    def _build_context(self, products: list[dict]) -> str:
        if not products:
            return (
                "No matching product records were retrieved from the store database. "
                "Answer only general hardware guidance and be transparent about missing product data."
            )

        context_chunks = []
        for idx, p in enumerate(products, start=1):
            specs = p.get("specifications") or {}
            specs_text = ", ".join([f"{k}: {v}" for k, v in specs.items()])
            chunk = (
                f"[{idx}] Product ID: {p.get('_id')}\n"
                f"Name: {p.get('name', '')}\n"
                f"Category: {p.get('category', '')}\n"
                f"Brand: {p.get('brand', '')}\n"
                f"Price: {p.get('price', 'N/A')}\n"
                f"Stock: {p.get('stock', 'N/A')}\n"
                f"Rating: {p.get('rating', 'N/A')} ({p.get('reviewCount', 0)} reviews)\n"
                f"Description: {p.get('description', '')}\n"
                f"Specifications: {specs_text if specs_text else 'N/A'}"
            )
            context_chunks.append(chunk)

        return "\n\n".join(context_chunks)

    async def answer_question(self, question: str, top_k: int = 5) -> dict:
        if not question or not question.strip():
            raise ValueError("Question cannot be empty")

        query_vector = self.embedding_service.embed_query(question)
        hits = self.vector_store.search(query_vector, top_k=top_k)

        product_ids = [hit["product_id"] for hit in hits]
        products = await self._fetch_products(product_ids)
        context_text = self._build_context(products)

        if not self._gemini_model:
            fallback = self._build_fallback_answer(question, products)
            return {
                "answer": fallback,
                "retrieved_products": products,
                "source": "retrieval_only",
            }

        prompt = (
            "You are a helpful AI sales engineer for a computer hardware e-commerce store.\n"
            "Instructions:\n"
            "- Use the provided product context as the source of truth for store-specific details.\n"
            "- If information is not in context, clearly say it is not available.\n"
            "- For general hardware theory, provide concise practical guidance.\n"
            "- Never invent product price, stock, or specifications.\n\n"
            f"User question:\n{question}\n\n"
            f"Retrieved product context:\n{context_text}\n\n"
            "Answer in Vietnamese."
        )

        result = self._gemini_model.generate_content(prompt)
        answer = (result.text or "").strip()

        return {
            "answer": answer,
            "retrieved_products": products,
            "source": "gemini_rag",
        }

    def _build_fallback_answer(self, question: str, products: list[dict]) -> str:
        if not products:
            return (
                "Hien tai toi chua truy xuat duoc du lieu san pham phu hop tu co so du lieu. "
                "Ban co the hoi lai voi ten san pham, hang hoac tam gia cu the de toi tim chinh xac hon."
            )

        lines = [
            "Toi da tim thay mot so san pham lien quan trong du lieu cua hang:",
        ]

        for p in products[:3]:
            lines.append(
                f"- {p.get('name')} ({p.get('brand', 'N/A')}), gia {p.get('price', 'N/A')}, ton kho {p.get('stock', 'N/A')}"
            )

        lines.append("Toi chua co Gemini API key nen dang tra loi o che do retrieval-only.")
        return "\n".join(lines)

"""Chat routes powered by RAG pipeline."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.rag_pipeline import RAGPipeline

router = APIRouter(prefix="", tags=["chat"])
rag_pipeline = RAGPipeline()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message")
    top_k: int = Field(5, ge=1, le=20, description="Number of retrieved products")


@router.post("/chat")
async def chat_with_rag(payload: ChatRequest):
    """Run RAG chat flow: embed -> retrieve -> generate."""
    try:
        result = await rag_pipeline.answer_question(
            question=payload.message,
            top_k=payload.top_k,
        )
        return {
            "success": True,
            "answer": result["answer"],
            "retrieved_products": result["retrieved_products"],
            "source": result["source"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"RAG chat failed: {exc}") from exc

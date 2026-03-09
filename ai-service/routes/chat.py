"""
Chat API routes — Intent-driven RAG chatbot.

POST /chat        — main endpoint, auto-detects intent and routes to the
                    appropriate answer strategy.
POST /chat/intent — utility endpoint, returns intent label only (for debugging).

Intent routing:
  knowledge_question  → answer_knowledge_question()  (pure Gemini)
  product_search      → answer_question()             (FAISS RAG + Gemini)
  product_price       → answer_price_question()       (MongoDB text search + Gemini)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.intent_service import IntentService, INTENT_KNOWLEDGE, INTENT_PRODUCT, INTENT_PRICE
from services.rag_pipeline import RAGPipeline

router = APIRouter(prefix="", tags=["chat"])

# Singletons — instantiated once on module load.
rag_pipeline   = RAGPipeline()
intent_service = IntentService()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Tin nhắn của người dùng")
    top_k: int   = Field(5, ge=1, le=20, description="Số sản phẩm muốn truy xuất")


class IntentRequest(BaseModel):
    message: str = Field(..., min_length=1)


# ─────────────────────────────────────────────────────────────────────────── #
#  POST /chat                                                                  #
# ─────────────────────────────────────────────────────────────────────────── #

@router.post("/chat")
async def chat_endpoint(payload: ChatRequest):
    """
    Main chatbot endpoint — detects intent and dispatches to the correct handler.

    Response shape:
    {
        "success": true,
        "intent": "product_search | product_price | knowledge_question",
        "answer": "...",
        "retrieved_products": [...],
        "source": "gemini_rag | price_lookup | knowledge_gemini | retrieval_only | ..."
    }
    """
    question = payload.message.strip()

    try:
        # ── 1. Intent detection ─────────────────────────────────────────
        intent = intent_service.detect(question)

        # ── 2. Route to the right answering strategy ────────────────────
        if intent == INTENT_PRICE:
            result = await rag_pipeline.answer_price_question(
                question, top_k=payload.top_k
            )
        elif intent == INTENT_KNOWLEDGE:
            result = await rag_pipeline.answer_knowledge_question(question)
        else:
            # Default: product_search — full FAISS RAG pipeline
            result = await rag_pipeline.answer_question(
                question, top_k=payload.top_k
            )

        return {
            "success": True,
            "intent": intent,
            "answer": result["answer"],
            "retrieved_products": result.get("retrieved_products", []),
            "source": result.get("source", "unknown"),
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────── #
#  POST /chat/intent  (debug utility)                                          #
# ─────────────────────────────────────────────────────────────────────────── #

@router.post("/chat/intent")
async def detect_intent(payload: IntentRequest):
    """
    Utility — returns the detected intent for a message without generating an answer.
    Useful for frontend debugging and testing.
    """
    intent = intent_service.detect(payload.message.strip())
    return {"success": True, "intent": intent, "message": payload.message}

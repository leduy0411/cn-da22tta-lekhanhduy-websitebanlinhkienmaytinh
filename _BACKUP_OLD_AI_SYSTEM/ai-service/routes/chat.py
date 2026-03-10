"""
Chat API routes — Intent-driven RAG chatbot v2.0.

POST /chat        — main endpoint, auto-detects intent and routes to the
                    appropriate answer strategy.
POST /chat/intent — utility endpoint, returns intent label only (for debugging).

Intent routing (v2.0):
  greeting            → quick response (no LLM)
  help                → chatbot features explanation (no LLM)
  knowledge_question  → answer_knowledge_question()  (enhanced Gemini)
  product_search      → answer_question()             (FAISS RAG + Gemini)
  product_price       → answer_price_question()       (MongoDB text search + Gemini)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.intent_service import (
    IntentService,
    INTENT_KNOWLEDGE,
    INTENT_PRODUCT,
    INTENT_PRICE,
    INTENT_GREETING,
    INTENT_HELP,
)
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
#  Quick Responses (no LLM needed)                                             #
# ─────────────────────────────────────────────────────────────────────────── #

def _greeting_response() -> dict:
    """Quick greeting response."""
    return {
        "answer": (
            "Xin chào! 👋 Tôi là trợ lý AI của TechStore. "
            "Tôi có thể giúp bạn:\n"
            "• Tìm kiếm và tư vấn sản phẩm phù hợp\n"
            "• Kiểm tra giá và tồn kho\n"
            "• Giải đáp kiến thức về phần cứng máy tính\n\n"
            "Bạn cần hỗ trợ gì hôm nay?"
        ),
        "retrieved_products": [],
        "source": "greeting",
    }


def _help_response() -> dict:
    """Chatbot capabilities explanation."""
    return {
        "answer": (
            "🤖 **Tôi có thể giúp bạn:**\n\n"
            "**1. Tìm kiếm sản phẩm thông minh** 🔍\n"
            "   • 'Tìm laptop gaming dưới 20 triệu'\n"
            "   • 'VGA tốt cho render video'\n"
            "   • 'PC văn phòng giá rẻ'\n\n"
            "**2. Tra cứu giá & tồn kho** 💰\n"
            "   • 'Giá laptop Asus ROG bao nhiêu?'\n"
            "   • 'Còn hàng RTX 4090 không?'\n\n"
            "**3. Kiến thức phần cứng** 📚\n"
            "   • 'VGA khác CPU thế nào?'\n"
            "   • 'RAM bao nhiêu là đủ cho gaming?'\n"
            "   • 'Tại sao SSD nhanh hơn HDD?'\n\n"
            "Hãy hỏi tôi bất cứ điều gì! 😊"
        ),
        "retrieved_products": [],
        "source": "help",
    }


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
        "intent": "product_search | product_price | knowledge_question | greeting | help",
        "answer": "...",
        "retrieved_products": [...],
        "source": "gemini_rag | price_lookup | knowledge_gemini | greeting | help | ..."
    }
    """
    question = payload.message.strip()

    try:
        # ── 1. Intent detection ─────────────────────────────────────────
        intent = intent_service.detect(question)

        # ── 2. Quick responses (no LLM) ─────────────────────────────────
        if intent == INTENT_GREETING:
            result = _greeting_response()
        elif intent == INTENT_HELP:
            result = _help_response()
        
        # ── 3. Route to RAG pipeline ────────────────────────────────────
        elif intent == INTENT_PRICE:
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

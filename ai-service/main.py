"""
AI Recommendation Service v2.0 — FastAPI Application
Main entry point cho Python AI microservice.

Endpoints:
  GET  /health                          - Health check
  GET  /status                          - Model status
  POST /train                           - Trigger model training
  GET  /recommend/user/{user_id}        - User recommendations
  GET  /recommend/product/{product_id}  - Product recommendations
  POST /recommend/cart                  - Cart recommendations
  GET  /recommend/trending              - Trending products
  GET  /recommend/fbt/{product_id}      - Frequently Bought Together
  POST /recommend/batch                 - Batch recommendations for multiple users
  POST /track                           - Track interaction (online learning)
  POST /search                          - Semantic search via FAISS
  GET  /training/report                 - Latest training report
  GET  /training/history                - Training history
  GET  /ab/variants                     - A/B test variants
  GET  /metrics/models                  - Model performance metrics
"""
import asyncio
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import settings
from database import connect_db, close_db, get_db
from recommendation_engine import recommender

# ==================== Pydantic Models ====================


class CartRequest(BaseModel):
    product_ids: list[str] = Field(..., description="List product IDs trong giỏ hàng")
    user_id: str | None = Field(None, description="User ID (optional)")


class TrackRequest(BaseModel):
    user_id: str
    product_id: str
    interaction_type: str = Field(
        ..., description="view|cart_add|purchase|review|search_click"
    )
    metadata: dict = Field(default_factory=dict)


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(10, ge=1, le=50)


class TrainRequest(BaseModel):
    force: bool = Field(False, description="Force retrain even if recently trained")


class BatchUserRequest(BaseModel):
    user_ids: list[str] = Field(..., description="List user IDs")
    limit: int = Field(10, ge=1, le=50)


class RecommendationResponse(BaseModel):
    success: bool
    count: int
    recommendations: list[dict]
    model_sources: list[str] = []
    latency_ms: float = 0
    ab_variant: str | None = None


# ==================== Scheduler ====================

scheduler = AsyncIOScheduler()


async def scheduled_training():
    """Scheduled daily training."""
    logger.info("⏰ Scheduled training started")
    try:
        result = await recommender.train_all()
        logger.info(f"Scheduled training result: {result.get('status')}")
    except Exception as e:
        logger.error(f"Scheduled training failed: {e}")


# ==================== App Lifecycle ====================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup and shutdown."""
    logger.info("🚀 AI Service v2.0 starting...")
    await connect_db()
    loaded = await recommender.initialize()
    logger.info(f"Models initialized: {loaded}")

    scheduler.add_job(
        scheduled_training,
        "interval",
        hours=settings.RETRAIN_INTERVAL_HOURS,
        id="daily_training",
        next_run_time=None,
    )
    scheduler.start()
    logger.info(
        f"Scheduler started: retrain every {settings.RETRAIN_INTERVAL_HOURS}h"
    )

    yield

    scheduler.shutdown()
    await close_db()
    logger.info("AI Service stopped")


# ==================== FastAPI App ====================

app = FastAPI(
    title="TechStore AI Recommendation Service",
    description=(
        "Hệ thống gợi ý sản phẩm thông minh v2.0 — "
        "SVD, ALS, NCF, FAISS, Association Rules, Hybrid"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Endpoints ====================


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-recommendation",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/status")
async def model_status():
    return {
        "success": True,
        "models": recommender.get_status(),
    }


@app.post("/train")
async def train_models(req: TrainRequest, background_tasks: BackgroundTasks):
    """Trigger model training (runs in background)."""
    if recommender.is_training:
        raise HTTPException(status_code=409, detail="Training already in progress")

    if not req.force and recommender.last_trained:
        hours_since = (
            datetime.utcnow() - recommender.last_trained
        ).total_seconds() / 3600
        if hours_since < 1:
            return {
                "success": False,
                "message": (
                    f"Recently trained {hours_since:.1f}h ago. "
                    "Use force=true to retrain."
                ),
                "last_trained": recommender.last_trained.isoformat(),
            }

    background_tasks.add_task(recommender.train_all)
    return {
        "success": True,
        "message": "Training started in background",
        "status": "training",
    }


@app.get("/recommend/user/{user_id}", response_model=RecommendationResponse)
async def recommend_for_user(
    user_id: str,
    limit: int = Query(10, ge=1, le=50),
    exclude: str = Query(None, description="Comma-separated product IDs to exclude"),
    ab_variant: str = Query(None, description="A/B test variant: A, B, or C"),
):
    """Gợi ý sản phẩm cho user dựa trên hành vi."""
    start = time.time()
    exclude_ids = exclude.split(",") if exclude else []

    recs = await recommender.recommend_for_user(
        user_id=user_id,
        top_k=limit,
        exclude_ids=exclude_ids,
        ab_variant=ab_variant,
    )

    latency = (time.time() - start) * 1000
    sources = set()
    for r in recs:
        sources.update(r.get("sources", []))

    return RecommendationResponse(
        success=True,
        count=len(recs),
        recommendations=recs,
        model_sources=list(sources),
        latency_ms=round(latency, 1),
        ab_variant=ab_variant,
    )


@app.get("/recommend/product/{product_id}", response_model=RecommendationResponse)
async def recommend_for_product(
    product_id: str,
    limit: int = Query(10, ge=1, le=50),
    user_id: str = Query(None),
    exclude: str = Query(None),
):
    """Gợi ý sản phẩm tương tự (content-based + collaborative)."""
    start = time.time()
    exclude_ids = exclude.split(",") if exclude else []

    recs = await recommender.recommend_for_product(
        product_id=product_id,
        top_k=limit,
        user_id=user_id,
        exclude_ids=exclude_ids,
    )

    latency = (time.time() - start) * 1000
    sources = set()
    for r in recs:
        sources.update(r.get("sources", []))

    return RecommendationResponse(
        success=True,
        count=len(recs),
        recommendations=recs,
        model_sources=list(sources),
        latency_ms=round(latency, 1),
    )


@app.post("/recommend/cart", response_model=RecommendationResponse)
async def recommend_for_cart(req: CartRequest):
    """Gợi ý sản phẩm mua kèm dựa trên giỏ hàng (Association Rules)."""
    start = time.time()

    recs = await recommender.recommend_for_cart(
        cart_product_ids=req.product_ids,
        user_id=req.user_id,
    )

    latency = (time.time() - start) * 1000
    sources = set()
    for r in recs:
        sources.update(r.get("sources", []))

    return RecommendationResponse(
        success=True,
        count=len(recs),
        recommendations=recs,
        model_sources=list(sources),
        latency_ms=round(latency, 1),
    )


@app.get("/recommend/trending", response_model=RecommendationResponse)
async def get_trending(
    limit: int = Query(10, ge=1, le=50),
    category: str = Query(None),
):
    """Lấy sản phẩm trending."""
    start = time.time()
    recs = await recommender.get_trending(top_k=limit, category=category)
    latency = (time.time() - start) * 1000

    return RecommendationResponse(
        success=True,
        count=len(recs),
        recommendations=recs,
        model_sources=["popularity"],
        latency_ms=round(latency, 1),
    )


@app.get("/recommend/fbt/{product_id}", response_model=RecommendationResponse)
async def frequently_bought_together(
    product_id: str,
    limit: int = Query(5, ge=1, le=20),
):
    """Sản phẩm thường mua cùng (Frequently Bought Together)."""
    start = time.time()

    recs = []
    if recommender.association_model._fitted:
        assoc_recs = recommender.association_model.get_frequently_bought_together(
            product_id, top_k=limit
        )
        if assoc_recs:
            recs = await recommender._enrich_products(
                [
                    {"product_id": r["product_id"], "score": r["score"], "sources": ["fbt"]}
                    for r in assoc_recs
                ]
            )

    latency = (time.time() - start) * 1000
    return RecommendationResponse(
        success=True,
        count=len(recs),
        recommendations=recs,
        model_sources=["association_rules"],
        latency_ms=round(latency, 1),
    )


@app.post("/recommend/batch")
async def batch_recommendations(req: BatchUserRequest):
    """Batch recommendations for multiple users."""
    start = time.time()
    results = {}

    for uid in req.user_ids[:20]:  # Cap at 20 users
        recs = await recommender.recommend_for_user(user_id=uid, top_k=req.limit)
        results[uid] = recs

    latency = (time.time() - start) * 1000
    return {
        "success": True,
        "count": len(results),
        "results": results,
        "latency_ms": round(latency, 1),
    }


@app.post("/track")
async def track_interaction(req: TrackRequest):
    """Track user interaction cho online learning."""
    await recommender.online_update(
        user_id=req.user_id,
        product_id=req.product_id,
        interaction_type=req.interaction_type,
    )
    return {"success": True, "message": "Interaction tracked"}


@app.post("/search")
async def semantic_search(req: SearchRequest):
    """Semantic search sản phẩm bằng FAISS."""
    if not recommender.content_model._fitted:
        raise HTTPException(
            status_code=503, detail="Content model not trained yet"
        )

    results = recommender.content_model.search_by_text(
        query=req.query, top_k=req.top_k
    )
    enriched = await recommender._enrich_products(results)

    return {
        "success": True,
        "query": req.query,
        "count": len(enriched),
        "results": enriched,
    }


@app.get("/training/report")
async def get_training_report():
    """Get latest training report."""
    return {
        "success": True,
        "last_trained": (
            recommender.last_trained.isoformat()
            if recommender.last_trained
            else None
        ),
        "metrics": recommender.training_metrics,
        "is_training": recommender.is_training,
    }


@app.get("/training/history")
async def get_training_history(
    limit: int = Query(10, ge=1, le=100),
):
    """Get training history from database."""
    db = get_db()
    reports = []
    cursor = (
        db.ai_training_reports.find({"type": "recommendation_training"})
        .sort("createdAt", -1)
        .limit(limit)
    )
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "createdAt" in doc:
            doc["createdAt"] = doc["createdAt"].isoformat()
        reports.append(doc)

    return {"success": True, "count": len(reports), "reports": reports}


@app.get("/ab/variants")
async def get_ab_variants():
    """Get A/B test variants configuration."""
    return {
        "success": True,
        "variants": recommender.ab_variants,
        "current_weights": recommender.weights,
    }


@app.get("/metrics/models")
async def get_model_metrics():
    """Get detailed model performance metrics."""
    status = recommender.get_status()
    training = recommender.training_metrics

    return {
        "success": True,
        "models": status,
        "training_metrics": {
            "svd": training.get("svd", {}),
            "als": training.get("als", {}),
            "ncf": training.get("ncf", {}),
            "association": training.get("association", {}),
            "content_based": training.get("content_based", {}),
        },
        "data_stats": training.get("data", {}),
        "matrix_stats": training.get("matrix", {}),
    }


# ==================== Run ====================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )

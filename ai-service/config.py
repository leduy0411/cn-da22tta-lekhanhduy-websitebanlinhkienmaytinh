"""
AI Recommendation Service - Configuration v3.0 (Maximum Performance Edition)
Optimized for high throughput, low latency, and superior recommendation quality.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/thietbidientu")
    DB_NAME: str = "thietbidientu"

    # Service
    HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", 8000))

    # Backend
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:5000")

    # Model paths
    MODEL_DIR: Path = Path(os.getenv("MODEL_DIR", "./models_cache"))
    FAISS_INDEX_PATH: Path = Path(os.getenv("FAISS_INDEX_PATH", "./faiss_index"))

    # Training — More frequent retraining for fresher models
    RETRAIN_INTERVAL_HOURS: int = int(os.getenv("RETRAIN_INTERVAL_HOURS", 12))
    MIN_INTERACTIONS: int = int(os.getenv("MIN_INTERACTIONS_FOR_TRAINING", 20))

    # Embedding — Upgraded to multilingual model for Vietnamese support
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIMENSION", 768))
    EMBEDDING_MODEL: str = os.getenv(
        "EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"
    )

    # Recommendation defaults
    DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", 15))
    MAX_TOP_K: int = int(os.getenv("MAX_TOP_K", 100))
    RESPONSE_TIMEOUT_MS: int = int(os.getenv("RESPONSE_TIMEOUT_MS", 200))

    # NCF training — deeper training for better convergence
    NCF_EPOCHS: int = int(os.getenv("NCF_EPOCHS", 50))
    NCF_PATIENCE: int = int(os.getenv("NCF_PATIENCE", 8))
    NCF_BATCH_SIZE: int = int(os.getenv("NCF_BATCH_SIZE", 512))
    NCF_LEARNING_RATE: float = float(os.getenv("NCF_LEARNING_RATE", 0.0005))
    NCF_WEIGHT_DECAY: float = float(os.getenv("NCF_WEIGHT_DECAY", 1e-4))

    # SVD / ALS enhanced
    SVD_FACTORS: int = int(os.getenv("SVD_FACTORS", 100))
    ALS_FACTORS: int = int(os.getenv("ALS_FACTORS", 100))
    ALS_ITERATIONS: int = int(os.getenv("ALS_ITERATIONS", 25))
    ALS_REGULARIZATION: float = float(os.getenv("ALS_REGULARIZATION", 0.1))

    # Time decay for interactions
    INTERACTION_HALFLIFE_DAYS: int = int(os.getenv("INTERACTION_HALFLIFE_DAYS", 21))
    INTERACTION_LOOKBACK_DAYS: int = int(os.getenv("INTERACTION_LOOKBACK_DAYS", 120))

    # Cache optimization
    SCORE_CACHE_TTL: int = int(os.getenv("SCORE_CACHE_TTL", 180))  # 3 minutes
    PRODUCT_CACHE_TTL: int = int(os.getenv("PRODUCT_CACHE_TTL", 1800))  # 30 minutes
    POPULAR_CACHE_TTL: int = int(os.getenv("POPULAR_CACHE_TTL", 300))  # 5 minutes
    MAX_SCORE_CACHE_SIZE: int = int(os.getenv("MAX_SCORE_CACHE_SIZE", 5000))

    # Online learning
    ONLINE_UPDATE_BATCH_SIZE: int = int(os.getenv("ONLINE_UPDATE_BATCH_SIZE", 50))
    MICRO_UPDATE_INTERVAL_MINUTES: int = int(os.getenv("MICRO_UPDATE_INTERVAL_MINUTES", 30))

    # Diversity & quality
    MAX_PER_CATEGORY: int = int(os.getenv("MAX_PER_CATEGORY", 3))
    DIVERSITY_FACTOR: float = float(os.getenv("DIVERSITY_FACTOR", 0.3))
    NOVELTY_BOOST: float = float(os.getenv("NOVELTY_BOOST", 0.15))
    RECENCY_BOOST_DAYS: int = int(os.getenv("RECENCY_BOOST_DAYS", 14))

    # Association Rules
    ASSOC_MIN_SUPPORT: float = float(os.getenv("ASSOC_MIN_SUPPORT", 0.003))
    ASSOC_MIN_CONFIDENCE: float = float(os.getenv("ASSOC_MIN_CONFIDENCE", 0.03))
    ASSOC_MIN_LIFT: float = float(os.getenv("ASSOC_MIN_LIFT", 1.0))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "./logs/ai_service.log")

    def __init__(self):
        self.MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.FAISS_INDEX_PATH.mkdir(parents=True, exist_ok=True)
        Path("./logs").mkdir(parents=True, exist_ok=True)


settings = Settings()

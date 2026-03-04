"""
AI Recommendation Service - Configuration v2.0
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

    # Training
    RETRAIN_INTERVAL_HOURS: int = int(os.getenv("RETRAIN_INTERVAL_HOURS", 24))
    MIN_INTERACTIONS: int = int(os.getenv("MIN_INTERACTIONS_FOR_TRAINING", 50))

    # Embedding
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIMENSION", 384))
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # Recommendation defaults
    DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", 10))
    MAX_TOP_K: int = int(os.getenv("MAX_TOP_K", 50))
    RESPONSE_TIMEOUT_MS: int = int(os.getenv("RESPONSE_TIMEOUT_MS", 300))

    # NCF training
    NCF_EPOCHS: int = int(os.getenv("NCF_EPOCHS", 20))
    NCF_PATIENCE: int = int(os.getenv("NCF_PATIENCE", 5))
    NCF_BATCH_SIZE: int = int(os.getenv("NCF_BATCH_SIZE", 256))

    # Time decay for interactions
    INTERACTION_HALFLIFE_DAYS: int = int(os.getenv("INTERACTION_HALFLIFE_DAYS", 30))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "./logs/ai_service.log")

    def __init__(self):
        self.MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.FAISS_INDEX_PATH.mkdir(parents=True, exist_ok=True)
        Path("./logs").mkdir(parents=True, exist_ok=True)


settings = Settings()

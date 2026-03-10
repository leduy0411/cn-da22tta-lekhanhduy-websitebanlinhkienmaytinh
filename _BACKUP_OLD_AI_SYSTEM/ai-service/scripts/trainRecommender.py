"""
trainRecommender.py
Script để train tất cả ML models cho hệ thống recommendation.

Chạy: python scripts/trainRecommender.py [--force]

Models được train:
  - SVD (Singular Value Decomposition)
  - ALS (Alternating Least Squares)
  - NCF (Neural Collaborative Filtering)
  - Content-Based (FAISS + Sentence Transformers)
  - Association Rules (Apriori/FP-Growth)
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add ai-service root to PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from loguru import logger

from config import settings
from database import connect_db, close_db
from recommendation_engine import recommender


async def main(force: bool = False):
    """Main training function."""
    logger.info("=" * 60)
    logger.info("🚀 TechStore AI Model Training")
    logger.info("=" * 60)
    
    # Connect to database
    logger.info(f"📊 Connecting to MongoDB: {settings.DB_NAME}")
    await connect_db()
    
    # Initialize recommender
    logger.info("🔧 Initializing recommendation engine...")
    loaded_models = await recommender.initialize()
    logger.info(f"✅ Loaded existing models: {loaded_models}")
    
    # Start training
    logger.info("")
    logger.info("=" * 60)
    logger.info("🎯 Starting full model training...")
    logger.info(f"   Force retrain: {force}")
    logger.info("=" * 60)
    
    try:
        result = await recommender.train_all(force=force)
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("📈 Training Results:")
        logger.info("=" * 60)
        
        if result.get("status") == "success":
            logger.success(f"✅ Training completed successfully!")
            
            # Print model stats
            if "models_trained" in result:
                logger.info(f"   Models trained: {', '.join(result['models_trained'])}")
            if "training_time" in result:
                logger.info(f"   Training time: {result['training_time']:.2f}s")
            if "metrics" in result:
                logger.info(f"   Metrics:")
                for model, metrics in result["metrics"].items():
                    logger.info(f"     - {model}: {metrics}")
        else:
            logger.warning(f"⚠️ Training completed with status: {result.get('status')}")
            if "error" in result:
                logger.error(f"   Error: {result['error']}")
                
    except Exception as e:
        logger.error(f"❌ Training failed: {e}")
        raise
    finally:
        # Cleanup
        await close_db()
        logger.info("")
        logger.info("🔌 Database connection closed.")
        logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train TechStore AI Recommendation Models"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force retrain even if recently trained"
    )
    args = parser.parse_args()
    
    asyncio.run(main(force=args.force))

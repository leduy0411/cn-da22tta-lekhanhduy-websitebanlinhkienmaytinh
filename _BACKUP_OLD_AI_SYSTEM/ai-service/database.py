"""
Database connection module - Motor async MongoDB driver
"""
from motor.motor_asyncio import AsyncIOMotorClient
from loguru import logger
from config import settings

_client: AsyncIOMotorClient = None
_db = None


async def connect_db():
    """Initialize MongoDB connection"""
    global _client, _db
    try:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
        _db = _client[settings.DB_NAME]
        # Test connection
        await _client.admin.command("ping")
        logger.info(f"✅ Connected to MongoDB: {settings.DB_NAME}")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        raise


async def close_db():
    """Close MongoDB connection"""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


def get_db():
    """Get database instance"""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db

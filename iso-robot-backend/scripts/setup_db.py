"""
Run this once to create all database tables.
Usage: python scripts/setup_db.py
"""
import asyncio
from app.db.session import init_db
from app.core.logger import get_logger

logger = get_logger(__name__)


async def main():
    logger.info("Initialising database...")
    await init_db()
    logger.info("Done. All tables created.")


if __name__ == "__main__":
    asyncio.run(main())

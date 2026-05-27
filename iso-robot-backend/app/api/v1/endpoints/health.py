import time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db
from app.core.config import settings
from app.schemas.common_schema import HealthResponse

router = APIRouter()
START_TIME = time.time()


@router.get("", response_model=HealthResponse, summary="Health check")
async def health_check(db: AsyncSession = Depends(get_db)):
    # Check DB
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    # Check LLM key present
    from app.core.config import settings as s
    llm_ok = bool(s.ANTHROPIC_API_KEY or s.OPENAI_API_KEY)

    return HealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        version=settings.VERSION,
        database=db_status,
        llm="configured" if llm_ok else "not configured",
        uptime_seconds=round(time.time() - START_TIME, 2),
    )


@router.get("/ping", summary="Simple ping")
async def ping():
    return {"ping": "pong"}

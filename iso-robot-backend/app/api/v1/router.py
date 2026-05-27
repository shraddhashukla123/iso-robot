from fastapi import APIRouter

from app.api.v1.endpoints import (
    health,
    auth,
    users,
    business,
    controls,
    issues,
    risks,
    documents,
)

api_router = APIRouter()

api_router.include_router(health.router,    prefix="/health",    tags=["health"])
api_router.include_router(auth.router,      prefix="/auth",      tags=["auth"])
api_router.include_router(users.router,     prefix="/users",     tags=["users"])
api_router.include_router(business.router,  prefix="/business",  tags=["business"])
api_router.include_router(controls.router,  prefix="/controls",  tags=["controls"])
api_router.include_router(issues.router,    prefix="/issues",    tags=["issues"])
api_router.include_router(risks.router,     prefix="/risks",     tags=["risks"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])

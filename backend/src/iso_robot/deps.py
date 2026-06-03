from __future__ import annotations

from typing import Annotated

import aiosqlite
from fastapi import Depends

from iso_robot.config import Settings, get_settings
from iso_robot.repositories.db import get_db
from iso_robot.repositories.control_repository import ControlRepository
from iso_robot.repositories.document_repository import DocumentRepository
from iso_robot.repositories.job_repository import JobRepository
from iso_robot.repositories.org_repository import (
    AuditLogRepository,
    ControlDocumentRepository,
    DemographyRepository,
    FolderRepository,
    IssueScoreRepository,
    OrgRepository,
    RiskRepository,
    TenantRepository,
    UserRepository,
)


# ── Existing dependencies (DO NOT CHANGE) ────────────────────────────────────

async def get_document_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> DocumentRepository:
    return DocumentRepository(db)


async def get_job_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> JobRepository:
    return JobRepository(db)


async def get_control_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> ControlRepository:
    return ControlRepository(db)


def get_app_settings() -> Settings:
    return get_settings()


# ── New dependencies ──────────────────────────────────────────────────────────

async def get_org_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> OrgRepository:
    return OrgRepository(db)


async def get_user_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> UserRepository:
    return UserRepository(db)


async def get_tenant_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> TenantRepository:
    return TenantRepository(db)


async def get_folder_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> FolderRepository:
    return FolderRepository(db)


async def get_demography_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> DemographyRepository:
    return DemographyRepository(db)


async def get_control_document_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> ControlDocumentRepository:
    return ControlDocumentRepository(db)


async def get_issue_score_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> IssueScoreRepository:
    return IssueScoreRepository(db)


async def get_risk_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> RiskRepository:
    return RiskRepository(db)


async def get_audit_repo(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> AuditLogRepository:
    return AuditLogRepository(db)

# ─────────────────────────────────────────────────────────────────────────────
# Auth dependency — verify Bearer JWT, return current user, and slide the window
# by issuing a fresh token on every authenticated request.
# ─────────────────────────────────────────────────────────────────────────────
from typing import Optional  # noqa: E402

from fastapi import Header, Response  # noqa: E402

from iso_robot.errors import APIError  # noqa: E402
from iso_robot.helpers.auth import create_token, decode_token  # noqa: E402
from iso_robot.repositories.org_repository import UserRepository  # noqa: E402


async def get_user_repo_for_auth(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> UserRepository:
    return UserRepository(db)


async def get_current_user(
    response: Response,
    user_repo: Annotated[UserRepository, Depends(get_user_repo_for_auth)],
    authorization: Annotated[Optional[str], Header()] = None,
) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise APIError("Missing or invalid Authorization header", code="UNAUTHORIZED", status_code=401)

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise APIError("Invalid or expired token", code="TOKEN_INVALID", status_code=401)

    user = await user_repo.get_by_id(payload["sub"])
    if not user or not user.get("is_active", 1):
        raise APIError("User not found or inactive", code="UNAUTHORIZED", status_code=401)

    # SLIDING WINDOW: hand back a brand-new token so the idle clock resets.
    response.headers["X-Refresh-Token"] = create_token(
        user["id"], user["client_org_id"], user["role"]
    )
    return user
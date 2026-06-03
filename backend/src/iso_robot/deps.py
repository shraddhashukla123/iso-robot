from __future__ import annotations

from typing import Annotated

import aiosqlite
from fastapi import Depends

from iso_robot.config import Settings, get_settings
from iso_robot.repositories.db import get_db
from iso_robot.repositories.control_repository import ControlRepository
from iso_robot.repositories.document_repository import DocumentRepository
from iso_robot.repositories.job_repository import JobRepository


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

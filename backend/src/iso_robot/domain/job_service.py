from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from iso_robot.repositories.job_repository import JobRepository


async def create_job(
    repo: JobRepository,
    *,
    job_type: str,
    payload: Optional[dict[str, Any]],
    initial_status: str = "pending",
) -> Dict[str, Any]:
    job_id = str(uuid.uuid4())
    return await repo.create(
        job_id=job_id,
        job_type=job_type,
        status=initial_status,
        payload=payload or {},
    )

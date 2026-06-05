from __future__ import annotations

from iso_robot.schemas.api import HealthResponse


async def health() -> HealthResponse:
    return HealthResponse()

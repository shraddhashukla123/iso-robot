from __future__ import annotations

from typing import Any, Dict, List, Optional

from iso_robot.config import Settings


async def ingest_feeds_stub(
    settings: Settings,
    source_keys: Optional[List[str]],
) -> List[Dict[str, Any]]:
    """Placeholder for external feed adapters until endpoints and persistence are wired."""
    _ = (settings, source_keys)
    return []

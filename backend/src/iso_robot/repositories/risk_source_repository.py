from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

import aiosqlite

from iso_robot.repositories.db import dumps_json


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class RiskSourceRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def upsert(
        self,
        *,
        source_id: str,
        name: str,
        source_type: Optional[str] = None,
        url: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        meta = dumps_json(metadata or {})
        now = _now_iso()
        await self._conn.execute(
            """
            INSERT INTO risk_sources (id, name, source_type, url, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              source_type = COALESCE(excluded.source_type, source_type),
              url = COALESCE(excluded.url, url),
              metadata_json = excluded.metadata_json
            """,
            (source_id, name, source_type, url, meta, now),
        )
        await self._conn.commit()

    async def list_all(self, limit: int = 2000, offset: int = 0) -> List[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, name, source_type, url, metadata_json, created_at
            FROM risk_sources
            ORDER BY name
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

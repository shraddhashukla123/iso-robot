from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

import aiosqlite

from iso_robot.repositories.db import dumps_json


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class ControlRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def delete_for_document(self, document_id: str) -> None:
        await self._conn.execute("DELETE FROM controls WHERE document_id = ?", (document_id,))
        await self._conn.commit()

    async def insert_many(
        self,
        rows: List[dict[str, Any]],
    ) -> None:
        for r in rows:
            await self._conn.execute(
                """
                INSERT INTO controls (id, document_id, control_text, section_ref, framework, source_page, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    r["id"],
                    r["document_id"],
                    r.get("control_text"),
                    r.get("section_ref"),
                    r.get("framework"),
                    r.get("source_page"),
                    r.get("created_at") or _now_iso(),
                ),
            )
        await self._conn.commit()

    async def list_all(
        self,
        *,
        limit: int = 500,
        offset: int = 0,
        document_id: Optional[str] = None,
    ) -> List[dict[str, Any]]:
        if document_id:
            cur = await self._conn.execute(
                """
                SELECT id, document_id, control_text, section_ref, framework, source_page, created_at
                FROM controls
                WHERE document_id = ?
                ORDER BY datetime(created_at) DESC
                LIMIT ? OFFSET ?
                """,
                (document_id, limit, offset),
            )
        else:
            cur = await self._conn.execute(
                """
                SELECT id, document_id, control_text, section_ref, framework, source_page, created_at
                FROM controls
                ORDER BY datetime(created_at) DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
        rows = await cur.fetchall()
        return [dict(x) for x in rows]

    async def get_by_document(self, document_id: str) -> List[dict[str, Any]]:
        return await self.list_all(limit=10000, offset=0, document_id=document_id)

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple

import aiosqlite


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class DocumentRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def list_all(self, limit: int = 500, offset: int = 0) -> List[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, filename, path, sha256, mime_type, size_bytes, framework, status, source_url, created_at
            FROM documents
            ORDER BY datetime(created_at) DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

    async def get_by_id(self, doc_id: str) -> Optional[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, filename, path, sha256, mime_type, size_bytes, framework, status, source_url, created_at
            FROM documents WHERE id = ?
            """,
            (doc_id,),
        )
        row = await cur.fetchone()
        return dict(row) if row else None

    async def upsert_by_sha256(
        self,
        *,
        doc_id: str,
        filename: str,
        path: str,
        sha256: str,
        mime_type: Optional[str],
        size_bytes: int,
        framework: Optional[str],
        status: str,
        source_url: Optional[str],
    ) -> Tuple[str, bool]:
        """
        Insert or update by sha256.
        Returns (document_id, created_new).
        """
        cur_chk = await self._conn.execute(
            "SELECT 1 FROM documents WHERE sha256 = ? LIMIT 1",
            (sha256,),
        )
        is_new = await cur_chk.fetchone() is None

        cur = await self._conn.execute(
            """
            INSERT INTO documents (id, filename, path, sha256, mime_type, size_bytes, framework, status, source_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(sha256) DO UPDATE SET
              filename = excluded.filename,
              path = excluded.path,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              framework = COALESCE(excluded.framework, framework),
              status = excluded.status,
              source_url = COALESCE(excluded.source_url, source_url)
            RETURNING id
            """,
            (
                doc_id,
                filename,
                path,
                sha256,
                mime_type,
                size_bytes,
                framework,
                status,
                source_url,
                _now_iso(),
            ),
        )
        row = await cur.fetchone()
        await self._conn.commit()
        final_id = str(row[0]) if row else doc_id
        return final_id, is_new

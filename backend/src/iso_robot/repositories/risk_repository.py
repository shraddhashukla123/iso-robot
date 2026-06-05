from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, List, Optional

import aiosqlite

from iso_robot.repositories.db import dumps_json


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _loads_issue_ids(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    try:
        v = json.loads(raw)
        return [str(x) for x in v] if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


class CandidateRiskRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def clear_all(self) -> None:
        await self._conn.execute("DELETE FROM candidate_risks")
        await self._conn.commit()

    async def insert(
        self,
        *,
        row_id: str,
        issue_ids: List[str],
        title: Optional[str],
        description: Optional[str],
        domain: Optional[str],
        confidence: Optional[float],
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO candidate_risks (id, issue_ids_json, title, description, domain, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (row_id, dumps_json(issue_ids), title, description, domain, confidence, _now_iso()),
        )
        await self._conn.commit()

    async def list_all(self, limit: int = 500, offset: int = 0) -> List[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, issue_ids_json, title, description, domain, confidence, created_at
            FROM candidate_risks
            ORDER BY datetime(created_at) DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        rows = await cur.fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["issue_ids"] = _loads_issue_ids(d.pop("issue_ids_json", None))
            out.append(d)
        return out

    async def get_by_id(self, row_id: str) -> Optional[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, issue_ids_json, title, description, domain, confidence, created_at
            FROM candidate_risks WHERE id = ?
            """,
            (row_id,),
        )
        row = await cur.fetchone()
        if not row:
            return None
        d = dict(row)
        d["issue_ids"] = _loads_issue_ids(d.pop("issue_ids_json", None))
        return d


class RiskLibraryRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def upsert(
        self,
        *,
        row_id: str,
        industry: Optional[str],
        risk_domain: Optional[str],
        title: str,
        description: Optional[str],
        tags: Optional[str],
        source_ref: Optional[str],
        notes: Optional[str],
    ) -> None:
        now = _now_iso()
        await self._conn.execute(
            """
            INSERT INTO risk_library (id, industry, risk_domain, title, description, tags, source_ref, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              industry = COALESCE(excluded.industry, industry),
              risk_domain = COALESCE(excluded.risk_domain, risk_domain),
              title = excluded.title,
              description = COALESCE(excluded.description, description),
              tags = COALESCE(excluded.tags, tags),
              source_ref = COALESCE(excluded.source_ref, source_ref),
              notes = COALESCE(excluded.notes, notes)
            """,
            (row_id, industry, risk_domain, title, description, tags, source_ref, notes, now),
        )
        await self._conn.commit()

    async def list_all(self, limit: int = 2000, offset: int = 0) -> List[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, industry, risk_domain, title, description, tags, source_ref, notes, created_at
            FROM risk_library
            ORDER BY risk_domain, title
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

    async def count(self) -> int:
        cur = await self._conn.execute("SELECT COUNT(1) AS c FROM risk_library")
        row = await cur.fetchone()
        return int(row[0]) if row else 0


class RiskDiscoveryResultRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def delete_for_candidate(self, candidate_risk_id: str) -> None:
        await self._conn.execute(
            "DELETE FROM risk_discovery_results WHERE candidate_risk_id = ?",
            (candidate_risk_id,),
        )
        await self._conn.commit()

    async def insert(
        self,
        *,
        row_id: str,
        candidate_risk_id: str,
        library_risk_id: Optional[str],
        match_status: str,
        rationale: Optional[str],
        bm25_score: Optional[float],
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO risk_discovery_results
              (id, candidate_risk_id, library_risk_id, match_status, rationale, bm25_score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (row_id, candidate_risk_id, library_risk_id, match_status, rationale, bm25_score, _now_iso()),
        )
        await self._conn.commit()

    async def list_for_candidates(self, candidate_ids: List[str]) -> List[dict[str, Any]]:
        if not candidate_ids:
            return []
        ph = ",".join("?" for _ in candidate_ids)
        cur = await self._conn.execute(
            f"""
            SELECT id, candidate_risk_id, library_risk_id, match_status, rationale, bm25_score, created_at
            FROM risk_discovery_results
            WHERE candidate_risk_id IN ({ph})
            ORDER BY datetime(created_at) DESC
            """,
            candidate_ids,
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

    async def list_all(self, limit: int = 2000, offset: int = 0) -> List[dict[str, Any]]:
        cur = await self._conn.execute(
            """
            SELECT id, candidate_risk_id, library_risk_id, match_status, rationale, bm25_score, created_at
            FROM risk_discovery_results
            ORDER BY datetime(created_at) DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

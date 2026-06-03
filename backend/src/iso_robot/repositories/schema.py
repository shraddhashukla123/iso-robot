from pathlib import Path

import aiosqlite


async def ensure_schema(conn: aiosqlite.Connection) -> None:
    """Apply `init_schema.sql` DDL (idempotent)."""
    sql_path = Path(__file__).resolve().parent / "init_schema.sql"
    script = sql_path.read_text(encoding="utf-8")
    await conn.executescript(script)
    await conn.commit()

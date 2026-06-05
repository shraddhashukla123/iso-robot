from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, List, Optional, Union

import aiosqlite
from fastapi import Depends

from iso_robot.config import Settings, get_settings


async def get_db(
    settings: Settings = Depends(get_settings),
) -> AsyncIterator[aiosqlite.Connection]:
    path = str(settings.resolved_database_path())
    conn = await aiosqlite.connect(path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        await conn.close()


def dumps_json(value: Optional[Union[dict[str, Any], List[Any]]]) -> str:
    if value is None:
        return "{}"
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

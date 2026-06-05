from __future__ import annotations

from collections.abc import Mapping
from typing import Optional

import httpx

DEFAULT_CLASSNK_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/pdf;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


async def download_url(
    url: str,
    *,
    headers: Optional[Mapping[str, str]] = None,
    timeout_s: float = 60.0,
) -> httpx.Response:
    merged = {**DEFAULT_CLASSNK_HEADERS, **(dict(headers) if headers else {})}
    async with httpx.AsyncClient(follow_redirects=True) as client:
        return await client.get(url, headers=merged, timeout=timeout_s)

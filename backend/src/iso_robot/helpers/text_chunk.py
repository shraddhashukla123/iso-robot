from __future__ import annotations

from typing import List


def chunk_by_chars(
    text: str,
    *,
    max_chars: int = 6000,
    overlap: int = 400,
) -> List[str]:
    """Split long text into overlapping chunks that stay under ``max_chars``."""
    t = (text or "").strip()
    if not t:
        return []
    if len(t) <= max_chars:
        return [t]
    chunks: List[str] = []
    start = 0
    n = len(t)
    while start < n:
        end = min(start + max_chars, n)
        chunk = t[start:end]
        chunks.append(chunk.strip())
        if end >= n:
            break
        start = max(0, end - overlap)
    return [c for c in chunks if c]

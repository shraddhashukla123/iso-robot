from __future__ import annotations

import re


def slugify(text: str, max_len: int = 96) -> str:
    """Stable URL-safe id fragment from a human-readable label."""
    s = (text or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    if not s:
        s = "unknown"
    return s[:max_len]

from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path
from typing import Optional


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def guess_mime_type(path: Path) -> Optional[str]:
    mt, _ = mimetypes.guess_type(str(path))
    return mt

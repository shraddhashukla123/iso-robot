from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union

from iso_robot.helpers.hashing import guess_mime_type, sha256_file
from iso_robot.repositories.document_repository import DocumentRepository

ALLOWED_SUFFIXES = {".pdf", ".html", ".htm"}


def _collect_files(root: Path) -> List[Path]:
    files: List[Path] = []
    if not root.exists():
        return files
    if root.is_file():
        if root.suffix.lower() in ALLOWED_SUFFIXES:
            return [root]
        return files
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in ALLOWED_SUFFIXES:
            files.append(p)
    return sorted(files)


def _scan_paths_sync(paths: List[Path]) -> Tuple[List[Dict[str, Any]], List[str]]:
    out: List[Dict[str, Any]] = []
    errors: List[str] = []
    for path in paths:
        try:
            resolved = path.resolve()
            digest = sha256_file(resolved)
            stat = resolved.stat()
            out.append(
                {
                    "filename": resolved.name,
                    "path": str(resolved),
                    "sha256": digest,
                    "mime_type": guess_mime_type(resolved),
                    "size_bytes": stat.st_size,
                }
            )
        except OSError as e:
            errors.append(f"{path}: {e}")
    return out, errors


async def scan_documents_directory(
    repo: DocumentRepository,
    root: Path,
) -> Dict[str, Union[int, List[str]]]:
    paths = _collect_files(root.resolve())
    scanned = len(paths)
    if scanned == 0:
        return {"scanned": 0, "added": 0, "updated": 0, "skipped": 0, "errors": []}

    loop = asyncio.get_running_loop()
    file_rows, errors = await loop.run_in_executor(None, _scan_paths_sync, paths)

    added = 0
    updated = 0
    for row in file_rows:
        doc_id = str(uuid.uuid4())
        _, is_new = await repo.upsert_by_sha256(
            doc_id=doc_id,
            filename=str(row["filename"]),
            path=str(row["path"]),
            sha256=str(row["sha256"]),
            mime_type=row.get("mime_type"),
            size_bytes=int(row["size_bytes"] or 0),
            framework=None,
            status="local",
            source_url=None,
        )
        if is_new:
            added += 1
        else:
            updated += 1

    return {
        "scanned": scanned,
        "added": added,
        "updated": updated,
        "skipped": 0,
        "errors": errors,
    }

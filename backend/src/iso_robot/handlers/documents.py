from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import Depends, Query
from fastapi.responses import FileResponse
from urllib.parse import quote

from iso_robot.config import Settings
from iso_robot.deps import get_app_settings, get_document_repo
from iso_robot.domain.document_scan import scan_documents_directory
from iso_robot.errors import APIError
from iso_robot.helpers.path_guard import assert_document_path_allowed
from iso_robot.repositories.document_repository import DocumentRepository
from iso_robot.schemas.api import DocumentResponse, DocumentScanRequest, DocumentScanResponse


async def list_documents(
    repo: Annotated[DocumentRepository, Depends(get_document_repo)],
    limit: int = 500,
    offset: int = 0,
) -> list[DocumentResponse]:
    rows = await repo.list_all(limit=limit, offset=offset)
    return [DocumentResponse(**row) for row in rows]


async def get_document(
    doc_id: str,
    repo: Annotated[DocumentRepository, Depends(get_document_repo)],
) -> DocumentResponse:
    row = await repo.get_by_id(doc_id)
    if row is None:
        raise APIError("Document not found", code="not_found", status_code=404)
    return DocumentResponse(**row)


async def get_document_file(
    doc_id: str,
    settings: Annotated[Settings, Depends(get_app_settings)],
    repo: Annotated[DocumentRepository, Depends(get_document_repo)],
    download: bool = Query(
        False,
        description="When true, force browser download (Content-Disposition: attachment); otherwise serve inline for preview.",
    ),
) -> FileResponse:
    row = await repo.get_by_id(doc_id)
    if row is None:
        raise APIError("Document not found", code="not_found", status_code=404)
    path = Path(str(row["path"]))
    roots = [
        settings.resolved_documents_dir(),
        settings.resolved_documents_dir().parent,
    ]
    try:
        safe = assert_document_path_allowed(path, roots)
    except FileNotFoundError:
        raise APIError("File missing on disk", code="missing_file", status_code=404)
    except PermissionError:
        raise APIError("Access denied", code="forbidden", status_code=403)
    media = row.get("mime_type") or (
        "application/pdf"
        if safe.suffix.lower() == ".pdf"
        else "text/html"
        if safe.suffix.lower() in (".html", ".htm")
        else "application/octet-stream"
    )
    display_name = row.get("filename") or safe.name
    disposition_type = "attachment" if download else "inline"
    quoted = quote(display_name)
    headers = {
        "Content-Disposition": (
            f'{disposition_type}; filename="{display_name}"; filename*=UTF-8\'\'{quoted}'
        )
    }
    # Important: do NOT pass `filename=` to FileResponse, otherwise it would force
    # Content-Disposition: attachment and break inline iframe preview.
    return FileResponse(path=str(safe), media_type=media, headers=headers)


async def scan_documents(
    body: DocumentScanRequest,
    settings: Annotated[Settings, Depends(get_app_settings)],
    repo: Annotated[DocumentRepository, Depends(get_document_repo)],
) -> DocumentScanResponse:
    root = Path(body.folder) if body.folder else settings.resolved_documents_dir()
    root = root.expanduser()
    if not root.exists():
        raise APIError(
            f"Path does not exist: {root}",
            code="invalid_path",
            status_code=400,
        )
    stats = await scan_documents_directory(repo, root)
    return DocumentScanResponse(
        scanned=int(stats["scanned"]),
        added=int(stats["added"]),
        updated=int(stats["updated"]),
        skipped=int(stats["skipped"]),
        errors=list(stats.get("errors") or []),
    )

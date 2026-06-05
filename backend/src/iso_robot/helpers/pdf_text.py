"""Extract plain text from PDFs without cloud OCR (fallback when Document Intelligence fails)."""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Union

PathLike = Union[str, Path]


def extract_pdf_text(file_path: PathLike, max_pages: Optional[int] = 120) -> str:
    """Concatenate text from PDF pages using pypdf. Returns empty string on failure."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    path = Path(file_path)
    if not path.is_file():
        return ""
    try:
        reader = PdfReader(str(path))
    except Exception:
        return ""
    parts: list[str] = []
    n = len(reader.pages)
    cap = n if max_pages is None else min(n, max_pages)
    for i in range(cap):
        try:
            t = reader.pages[i].extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(t)
    return "\n\n".join(parts)


def extract_pdf_text_with_page_markers(file_path: PathLike, max_pages: Optional[int] = 120) -> str:
    """Like extract_pdf_text but inserts ``[PAGE N]`` before each page's text (for control source_page)."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    path = Path(file_path)
    if not path.is_file():
        return ""
    try:
        reader = PdfReader(str(path))
    except Exception:
        return ""
    parts: list[str] = []
    n = len(reader.pages)
    cap = n if max_pages is None else min(n, max_pages)
    for i in range(cap):
        try:
            t = reader.pages[i].extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(f"\n[PAGE {i + 1}]\n{t.strip()}")
    return "\n".join(parts).strip()

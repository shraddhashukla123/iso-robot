from __future__ import annotations

from pathlib import Path


def is_under_directory(path: Path, root: Path) -> bool:
    """True if ``path`` is the same as or inside ``root`` (after resolve)."""
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def assert_document_path_allowed(file_path: Path, allowed_roots: list[Path]) -> Path:
    resolved = file_path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(str(resolved))
    for root in allowed_roots:
        if is_under_directory(resolved, root):
            return resolved
    raise PermissionError(f"Path not under allowed document roots: {resolved}")

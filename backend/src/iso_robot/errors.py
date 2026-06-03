"""Shared API error type."""

from __future__ import annotations


class APIError(Exception):
    """Application error mapped to JSON `{"detail", "code"}`."""

    def __init__(self, message: str, code: str = "error", status_code: int = 400) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)

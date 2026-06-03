from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Optional


# ── This secret is used to sign tokens. In production replace with a real secret.
_TOKEN_SECRET = b"iso-robot-secret-key-change-in-production"


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with a fixed salt. Simple and dependency-free."""
    salt = "iso-robot-salt-v1:"
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain password matches a stored hash."""
    return hash_password(plain_password) == hashed_password


def create_token(user_id: str, client_org_id: str, role: str, ttl_seconds: int = 86400) -> str:
    """
    Create a signed token that encodes user identity.
    Token format: base64(payload).hmac_signature
    Valid for 24 hours by default.
    """
    payload = {
        "sub": user_id,
        "org": client_org_id,
        "role": role,
        "exp": int(time.time()) + ttl_seconds,
    }
    payload_str = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_str.encode("utf-8")).decode("utf-8")
    signature = hmac.new(_TOKEN_SECRET, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify a token.
    Returns the payload dict if valid, or None if invalid or expired.
    """
    try:
        payload_b64, signature = token.rsplit(".", 1)
    except ValueError:
        return None

    # Verify signature
    expected = hmac.new(_TOKEN_SECRET, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None

    # Decode payload
    try:
        # Add padding if needed for base64
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
    except Exception:
        return None

    # Check expiry
    if payload.get("exp", 0) < time.time():
        return None

    return payload
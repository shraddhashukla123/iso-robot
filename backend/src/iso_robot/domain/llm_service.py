from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from iso_robot.config import Settings
from iso_robot.integrations.azure_openai import get_azure_openai_client

logger = logging.getLogger(__name__)


def _parse_json_object_text(text: str) -> Dict[str, Any]:
    """Parse model output as JSON; tolerate markdown fences and trailing prose."""
    raw = (text or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.I)
    if fence:
        try:
            return json.loads(fence.group(1).strip())
        except json.JSONDecodeError:
            pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            pass
    logger.warning("LLM returned non-JSON; raw=%s", raw[:500])
    return {}


def _deployment(settings: Settings) -> str:
    d = (settings.azure_openai_deployment or "").strip()
    if not d:
        raise RuntimeError("AZURE_OPENAI_DEPLOYMENT is not set (chat deployment name).")
    return d


async def chat_json_object(
    settings: Settings,
    *,
    system: str,
    user: str,
    temperature: Optional[float] = None,
) -> Dict[str, Any]:
    """Call Azure OpenAI chat completions with ``response_format`` JSON object.

    If ``temperature`` and ``settings.azure_openai_temperature`` are both unset, the
    parameter is omitted so the model uses its default. Some Azure deployments
    (e.g. o4-mini) only allow the default temperature and return 400 if a value
    like 0.1 is sent.
    """
    client = get_azure_openai_client(settings)
    if client is None:
        raise RuntimeError(
            "Azure OpenAI is not configured (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_KEY)."
        )
    deployment = _deployment(settings)
    eff_temp = temperature if temperature is not None else settings.azure_openai_temperature

    def _call() -> Dict[str, Any]:
        kwargs: Dict[str, Any] = {
            "model": deployment,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }
        if eff_temp is not None:
            kwargs["temperature"] = eff_temp
        response = client.chat.completions.create(**kwargs)
        text = (response.choices[0].message.content or "").strip()
        return _parse_json_object_text(text)

    import asyncio

    return await asyncio.to_thread(_call)


async def generate_structured_stub(
    settings: Settings,
    *,
    prompt: str,
    response_format: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Backward-compatible helper: JSON object chat with a single user prompt."""
    _ = response_format
    return await chat_json_object(
        settings,
        system="You return only valid JSON objects as instructed.",
        user=prompt,
    )

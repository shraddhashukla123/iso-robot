from __future__ import annotations

from typing import Any, Optional

from iso_robot.config import Settings


def get_azure_openai_client(settings: Settings) -> Optional[Any]:
    """Build Azure OpenAI client when credentials are present; otherwise None."""
    if not settings.azure_openai_endpoint or not settings.azure_openai_key:
        return None
    from openai import AzureOpenAI

    return AzureOpenAI(
        api_key=settings.azure_openai_key,
        api_version=settings.azure_openai_api_version,
        azure_endpoint=settings.azure_openai_endpoint,
    )

from __future__ import annotations

from pydantic import BaseModel, Field

from iso_robot.config import Settings, get_settings


class SystemStatusResponse(BaseModel):
    use_llm_fallback: bool = Field(description="When true, heuristics run if Azure calls fail.")
    azure_openai_configured: bool
    document_intelligence_configured: bool
    note: str


async def system_status() -> SystemStatusResponse:
    s: Settings = get_settings()
    oai = bool((s.azure_openai_endpoint or "").strip() and (s.azure_openai_key or "").strip())
    di = bool(
        (s.azure_document_intelligence_endpoint or "").strip()
        and (s.azure_document_intelligence_key or "").strip()
    )
    note = (
        "If Azure returns 401, rotate keys in the portal and reload .env. "
        "With fallback enabled, controls/classification/risk discovery still produce heuristic results."
    )
    return SystemStatusResponse(
        use_llm_fallback=s.use_llm_fallback,
        azure_openai_configured=oai,
        document_intelligence_configured=di,
        note=note,
    )

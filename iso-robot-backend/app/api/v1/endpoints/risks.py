from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from app.core.dependencies import get_current_active_user
from app.schemas.common_schema import SuccessResponse
from app.services.llm_service import llm_service

router = APIRouter()

RISK_SCORE_PROMPT = """
You are a risk scoring analyst. Score the following risk using the standard risk methodology.

Risk: {risk_name}
Description: {description}
Linked controls: {controls}

Return JSON with:
- likelihood: integer 1-5
- impact: integer 1-5
- inherent_risk_score: likelihood * impact
- control_effectiveness: integer 1-5 (1=weak, 5=strong)
- residual_risk_score: integer (inherent reduced by control effectiveness)
- risk_band: "low" | "medium" | "high" | "critical"
- scoring_rationale: one sentence explaining the scores
"""


class RiskScoreRequest(BaseModel):
    risk_id: Optional[str] = None
    risk_name: str
    description: str
    linked_controls: Optional[List[str]] = []


class RiskScoreResult(BaseModel):
    risk_id: Optional[str]
    risk_name: str
    likelihood: int
    impact: int
    inherent_risk_score: int
    control_effectiveness: int
    residual_risk_score: int
    risk_band: str
    scoring_rationale: str


@router.post("/score", response_model=SuccessResponse[RiskScoreResult])
async def score_risk(
    payload: RiskScoreRequest,
    _=Depends(get_current_active_user),
):
    """
    Score a risk using AI — returns likelihood, impact, inherent, residual, and band.
    """
    controls_text = ", ".join(payload.linked_controls) if payload.linked_controls else "None"
    prompt = RISK_SCORE_PROMPT.format(
        risk_name=payload.risk_name,
        description=payload.description,
        controls=controls_text,
    )
    result = await llm_service.complete_json(prompt)
    result["risk_id"] = payload.risk_id
    result["risk_name"] = payload.risk_name
    return SuccessResponse(message="Risk scored", data=result)


@router.post("/expand", response_model=SuccessResponse)
async def expand_risks(
    demography_area: str,
    issues: List[str],
    existing_risks: Optional[List[str]] = None,
    _=Depends(get_current_active_user),
):
    """
    Identify additional risks for a given demography area based on unmitigated issues.
    """
    prompt = f"""
    You are a risk analyst. For the business area '{demography_area}' with these unmitigated issues:
    {chr(10).join(issues)}

    Existing risks already captured:
    {chr(10).join(existing_risks or [])}

    Identify any NEW risks not already in the existing list.
    Return a JSON array of objects with: risk_name, risk_description, risk_category, linked_issues.
    """
    result = await llm_service.complete_json(prompt)
    risks = result if isinstance(result, list) else result.get("risks", [])
    return SuccessResponse(message=f"Identified {len(risks)} additional risks", data=risks)

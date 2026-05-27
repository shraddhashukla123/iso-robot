from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.core.dependencies import get_current_active_user
from app.schemas.common_schema import SuccessResponse
from app.services.llm_service import llm_service

router = APIRouter()

CLASSIFY_PROMPT = """
You are a risk analyst. Classify the following issue into the appropriate categories.

Issue: {issue_text}

Return a JSON object with:
- pestel_category: one of [Political, Economic, Social, Technological, Environmental, Legal] or null
- swot_category: one of [Strength, Weakness, Opportunity, Threat] or null
- threat_type: one of [Cybersecurity, Operational, Financial, Regulatory, Reputational, Strategic] or null
- is_geopolitical: true or false
- severity: one of [low, medium, high, critical]
- summary: one sentence summary of the risk this issue represents
- confidence_score: 0.0 to 1.0
"""


class IssueInput(BaseModel):
    issue_id: Optional[str] = None
    title: str
    description: str
    source: Optional[str] = None


class IssueClassified(BaseModel):
    issue_id: Optional[str]
    title: str
    pestel_category: Optional[str]
    swot_category: Optional[str]
    threat_type: Optional[str]
    is_geopolitical: bool
    severity: str
    summary: str
    confidence_score: float


@router.post("/classify", response_model=SuccessResponse[IssueClassified])
async def classify_issue(
    payload: IssueInput,
    _=Depends(get_current_active_user),
):
    """
    Classify a single issue into PESTEL, SWOT, Threat type, and severity using AI.
    """
    prompt = CLASSIFY_PROMPT.format(
        issue_text=f"{payload.title}\n{payload.description}"
    )
    result = await llm_service.complete_json(prompt)
    result["issue_id"] = payload.issue_id
    result["title"] = payload.title
    return SuccessResponse(message="Issue classified", data=result)


@router.post("/classify/bulk", response_model=SuccessResponse[List[IssueClassified]])
async def classify_issues_bulk(
    issues: List[IssueInput],
    _=Depends(get_current_active_user),
):
    """
    Classify multiple issues in one call.
    """
    if len(issues) > 50:
        raise HTTPException(status_code=400, detail="Max 50 issues per bulk request")

    results = []
    for issue in issues:
        prompt = CLASSIFY_PROMPT.format(issue_text=f"{issue.title}\n{issue.description}")
        result = await llm_service.complete_json(prompt)
        result["issue_id"] = issue.issue_id
        result["title"] = issue.title
        results.append(result)

    return SuccessResponse(
        message=f"Classified {len(results)} issues",
        data=results,
    )

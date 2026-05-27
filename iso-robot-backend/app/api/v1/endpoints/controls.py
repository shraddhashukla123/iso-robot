from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from app.db.session import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.common_schema import SuccessResponse
from app.services.llm_service import llm_service
from app.utils.file_handler import save_upload, read_text_from_file

router = APIRouter()

CONTROL_EXTRACTION_PROMPT = """
You are a risk and compliance analyst. Read the document text below and extract all control statements.

A control is a specific, actionable rule, policy, or procedure that reduces a risk.
Example controls:
- "All access to production systems must be approved by a manager"
- "Passwords must be changed every 90 days"
- "Vendor contracts must include a data protection clause"

For each control found, return a JSON array of objects with these fields:
- control_id: string (e.g. "CTRL-001")
- control_statement: the exact control statement
- source_section: which section it came from
- control_type: "preventive" | "detective" | "corrective"
- applicable_area: which business area or function this applies to

Document text:
{text}
"""


class ControlItem(BaseModel):
    control_id: str
    control_statement: str
    source_section: Optional[str] = None
    control_type: str
    applicable_area: Optional[str] = None


class ControlIdentifyResponse(BaseModel):
    source_document: str
    source_type: str
    controls_found: int
    controls: List[ControlItem]


@router.post("/identify", response_model=SuccessResponse[ControlIdentifyResponse])
async def identify_controls(
    file: UploadFile = File(...),
    source_type: str = "internal",
    _=Depends(get_current_active_user),
):
    """
    Upload a document (PDF, DOCX, TXT) and extract control statements using AI.
    source_type: 'internal' (company SOPs/policies) or 'external' (ISO standards, frameworks)
    """
    filepath = await save_upload(file, subfolder="controls")
    text = read_text_from_file(filepath)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from document")

    # Chunk if too long (>3000 words)
    words = text.split()
    chunk_size = 3000
    chunks = [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]

    all_controls = []
    for idx, chunk in enumerate(chunks):
        prompt = CONTROL_EXTRACTION_PROMPT.format(text=chunk)
        result = await llm_service.complete_json(prompt)
        controls = result if isinstance(result, list) else result.get("controls", [])
        for i, c in enumerate(controls):
            c["control_id"] = f"CTRL-{(idx * 100) + i + 1:03d}"
        all_controls.extend(controls)

    return SuccessResponse(
        message=f"Extracted {len(all_controls)} controls",
        data=ControlIdentifyResponse(
            source_document=file.filename or "unknown",
            source_type=source_type,
            controls_found=len(all_controls),
            controls=all_controls,
        ),
    )


@router.post("/build", response_model=SuccessResponse)
async def build_control(
    payload: ControlItem,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """
    Save a structured control record to the database.
    """
    # Placeholder — connect to your Control model here
    return SuccessResponse(message="Control saved", data=payload)

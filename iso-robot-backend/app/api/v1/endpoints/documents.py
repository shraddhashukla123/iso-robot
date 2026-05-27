from fastapi import APIRouter, Depends, UploadFile, File
from app.core.dependencies import get_current_active_user
from app.schemas.common_schema import SuccessResponse
from app.utils.file_handler import save_upload, read_text_from_file

router = APIRouter()


@router.post("/upload", response_model=SuccessResponse)
async def upload_document(
    file: UploadFile = File(...),
    _=Depends(get_current_active_user),
):
    """
    Upload any document (PDF, DOCX, TXT). Returns filepath and extracted text preview.
    """
    filepath = await save_upload(file, subfolder="documents")
    text = read_text_from_file(filepath)
    preview = text[:500] + "..." if len(text) > 500 else text
    return SuccessResponse(
        message="Document uploaded",
        data={
            "filepath": filepath,
            "filename": file.filename,
            "text_preview": preview,
            "word_count": len(text.split()),
        },
    )

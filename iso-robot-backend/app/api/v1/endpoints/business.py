from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.core.dependencies import get_current_active_user, get_admin_user
from app.schemas.common_schema import SuccessResponse

router = APIRouter()


class BusinessCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[str] = None


class BusinessResponse(BaseModel):
    id: int
    name: str
    industry: Optional[str]
    country: Optional[str]
    description: Optional[str]
    contact_email: Optional[str]

    class Config:
        from_attributes = True


@router.post("", response_model=SuccessResponse[BusinessResponse], status_code=201)
async def create_business(
    payload: BusinessCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_admin_user),
):
    from app.models.business import Business
    business = Business(**payload.model_dump())
    db.add(business)
    await db.flush()
    await db.refresh(business)
    return SuccessResponse(message="Business created", data=business)


@router.get("/{business_id}", response_model=SuccessResponse[BusinessResponse])
async def get_business(
    business_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    from app.models.business import Business
    from sqlalchemy import select
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return SuccessResponse(data=business)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_active_user, get_admin_user
from app.schemas.user_schema import UserResponse, UserUpdate
from app.schemas.common_schema import SuccessResponse, PaginatedResponse
from app.services import user_service
from app.utils.pagination import paginate, get_skip

router = APIRouter()


@router.get("/me", response_model=SuccessResponse[UserResponse])
async def get_me(current_user=Depends(get_current_active_user)):
    return SuccessResponse(data=current_user)


@router.put("/me", response_model=SuccessResponse[UserResponse])
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    updated = await user_service.update_user(db, current_user, payload)
    return SuccessResponse(message="Profile updated", data=updated)


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_admin_user),
):
    skip = get_skip(page, page_size)
    users = await user_service.get_all_users(db, skip=skip, limit=page_size)
    total = len(users)
    return paginate([u for u in users], total, page, page_size)


@router.delete("/{user_id}", response_model=SuccessResponse)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_admin_user),
):
    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await user_service.delete_user(db, user)
    return SuccessResponse(message="User deleted")

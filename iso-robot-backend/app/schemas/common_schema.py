from pydantic import BaseModel
from typing import TypeVar, Generic, Optional, List, Any

T = TypeVar("T")


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    total: int
    page: int
    page_size: int
    pages: int
    data: List[T]


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[Any] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    llm: str
    uptime_seconds: float

import math
from typing import TypeVar, List
from app.schemas.common_schema import PaginatedResponse

T = TypeVar("T")


def paginate(items: List[T], total: int, page: int, page_size: int) -> PaginatedResponse:
    pages = math.ceil(total / page_size) if page_size else 1
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        data=items,
    )


def get_skip(page: int, page_size: int) -> int:
    return (page - 1) * page_size

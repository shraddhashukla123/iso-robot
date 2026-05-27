from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from app.core.logger import get_logger

logger = get_logger(__name__)


async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP {exc.status_code} | {request.method} {request.url} | {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "detail": None,
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    logger.warning(f"Validation error | {request.method} {request.url} | {errors}")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Validation error — check your request body",
            "detail": errors,
        },
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error | {request.method} {request.url} | {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Database error. Please try again.",
            "detail": None,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error | {request.method} {request.url} | {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": None,
        },
    )

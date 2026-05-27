import pytest
from httpx import AsyncClient
from main import app


@pytest.mark.asyncio
async def test_ping():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/health/ping")
    assert response.status_code == 200
    assert response.json()["ping"] == "pong"


@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    assert "version" in response.json()

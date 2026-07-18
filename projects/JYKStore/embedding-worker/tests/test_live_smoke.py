"""Live smoke tests against the real sentence-transformers model.

Skipped unless E5_WORKER_STUB=false. Run with:
  E5_WORKER_STUB=false E5_MODEL_REVISION=<40-char-sha> E5_WORKER_TOKEN=<token> \\
    python -m pytest tests/test_live_smoke.py
Validates relative ranking (never a hardcoded absolute score).
"""
import os

import pytest
from fastapi.testclient import TestClient

if os.getenv("E5_WORKER_STUB", "true").lower() in ("1", "true", "yes", "on"):
    pytest.skip("live model tests require E5_WORKER_STUB=false", allow_module_level=True)

os.environ.setdefault("E5_WORKER_ENV", "development")


def auth_headers() -> dict[str, str]:
    token = os.getenv("E5_WORKER_TOKEN", "")
    return {"Authorization": f"Bearer {token}"} if token else {}


from app.main import app  # noqa: E402

MODEL = os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2")


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _embed(client: TestClient, path: str, text: str) -> list[float]:
    res = client.post(
        path,
        json={"model": MODEL, "texts": [text], "normalize": True},
        headers=auth_headers(),
    )
    assert res.status_code == 200, res.text
    return res.json()["vectors"][0]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_ready_reports_live_backend(client: TestClient):
    data = client.get("/ready", headers=auth_headers()).json()
    assert data["backend"] == "sentence-transformers"
    assert data["stub"] is False
    assert data["dimension"] == 384
    assert len(data["revision"]) == 40


def test_korean_relative_ranking(client: TestClient):
    query = _embed(client, "/embed/query", "query: 그리드에 행을 추가하는 방법")
    positive = _embed(
        client, "/embed/passages", "passage: Grid에 새로운 행을 추가하려면 appendRow API를 사용합니다."
    )
    negative = _embed(client, "/embed/passages", "passage: 차트의 범례 색상을 변경하는 방법입니다.")
    assert _cosine(query, positive) > _cosine(query, negative)


def test_english_relative_ranking(client: TestClient):
    query = _embed(client, "/embed/query", "query: How do I append a row to the grid?")
    positive = _embed(client, "/embed/passages", "passage: Use the appendRow API to add a new row.")
    negative = _embed(
        client, "/embed/passages", "passage: This section describes chart legend colors."
    )
    assert _cosine(query, positive) > _cosine(query, negative)

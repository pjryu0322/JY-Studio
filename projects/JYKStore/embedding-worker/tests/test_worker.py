import os

import pytest
from fastapi.testclient import TestClient

os.environ["E5_WORKER_STUB"] = "true"

from app.main import app  # noqa: E402

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_and_ready(client: TestClient):
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200


def test_korean_query_embedding(client: TestClient):
    body = {
        "model": "dragonkue/multilingual-e5-small-ko-v2",
        "texts": ["query: 한국어 검색 질문"],
        "normalize": True,
    }
    res = client.post("/embed/query", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["dimension"] == 384
    assert len(data["vectors"]) == 1
    assert len(data["vectors"][0]) == 384
    norm = sum(v * v for v in data["vectors"][0]) ** 0.5
    assert abs(norm - 1.0) < 1e-3


def test_passage_prefix_required(client: TestClient):
    body = {
        "model": "dragonkue/multilingual-e5-small-ko-v2",
        "texts": ["no prefix"],
        "normalize": True,
    }
    res = client.post("/embed/passages", json=body)
    assert res.status_code == 400


def test_batch_order_preserved(client: TestClient):
    texts = ["passage: a", "passage: b", "passage: c"]
    body = {"model": "dragonkue/multilingual-e5-small-ko-v2", "texts": texts, "normalize": True}
    res = client.post("/embed/passages", json=body)
    assert res.status_code == 200
    vectors = res.json()["vectors"]
    assert len(vectors) == 3
    assert vectors[0] != vectors[1]


def test_token_limit_rejected(client: TestClient):
    huge = "passage: " + ("가" * 3000)
    body = {"model": "dragonkue/multilingual-e5-small-ko-v2", "texts": [huge], "normalize": True}
    res = client.post("/embed/passages", json=body)
    assert res.status_code == 400

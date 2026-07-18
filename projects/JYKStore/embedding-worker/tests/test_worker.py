import importlib
import os

import pytest
from fastapi.testclient import TestClient

os.environ["E5_WORKER_ENV"] = "test"
os.environ["E5_WORKER_STUB"] = "true"

from app.main import app  # noqa: E402

MODEL = "dragonkue/multilingual-e5-small-ko-v2"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_is_minimal(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_ready_schema_reports_stub(client: TestClient):
    res = client.get("/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["ready"] is True
    assert data["backend"] == "stub"
    assert data["stub"] is True
    assert data["model"] == MODEL
    assert data["revision"] == "stub"
    assert data["dimension"] == 384
    assert data["maxSequenceTokens"] == 512
    assert data["normalized"] is True
    assert data["device"] == "cpu"
    assert data["modelSource"] == "stub"
    assert data["offline"] is False


def test_korean_query_embedding(client: TestClient):
    body = {"model": MODEL, "texts": ["query: 한국어 검색 질문"], "normalize": True}
    res = client.post("/embed/query", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["dimension"] == 384
    assert data["revision"] == "stub"
    assert len(data["vectors"]) == 1
    assert len(data["vectors"][0]) == 384
    norm = sum(v * v for v in data["vectors"][0]) ** 0.5
    assert abs(norm - 1.0) < 1e-3


def test_passage_prefix_required(client: TestClient):
    body = {"model": MODEL, "texts": ["no prefix"], "normalize": True}
    res = client.post("/embed/passages", json=body)
    assert res.status_code == 400


def test_batch_order_preserved(client: TestClient):
    texts = ["passage: a", "passage: b", "passage: c"]
    res = client.post("/embed/passages", json={"model": MODEL, "texts": texts, "normalize": True})
    assert res.status_code == 200
    vectors = res.json()["vectors"]
    assert len(vectors) == 3
    assert vectors[0] != vectors[1]


def test_token_limit_rejected_with_diagnostic(client: TestClient):
    huge = "passage: " + ("가" * 3000)
    res = client.post("/embed/passages", json={"model": MODEL, "texts": [huge], "normalize": True})
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["code"] == "EMBEDDING_TOKEN_LIMIT_EXCEEDED"
    assert detail["maxSequenceTokens"] == 512
    assert detail["index"] == 0
    assert detail["tokenCount"] > 512
    # never leak the full text back
    assert "가가가" not in str(detail)


def test_batch_over_limit_rejected(client: TestClient):
    texts = [f"passage: {i}" for i in range(33)]
    res = client.post("/embed/passages", json={"model": MODEL, "texts": texts, "normalize": True})
    assert res.status_code == 400


def test_text_byte_limit_rejected(client: TestClient):
    big = "passage: " + ("a" * 20001)
    res = client.post("/embed/passages", json={"model": MODEL, "texts": [big], "normalize": True})
    assert res.status_code == 400


def test_normalize_false_rejected(client: TestClient):
    res = client.post(
        "/embed/passages", json={"model": MODEL, "texts": ["passage: a"], "normalize": False}
    )
    assert res.status_code == 400


def test_model_mismatch_rejected(client: TestClient):
    res = client.post(
        "/embed/query", json={"model": "other/model", "texts": ["query: a"], "normalize": True}
    )
    assert res.status_code == 400


def _restore_test_settings(monkeypatch):
    monkeypatch.setenv("E5_WORKER_ENV", "test")
    monkeypatch.setenv("E5_WORKER_STUB", "true")
    monkeypatch.delenv("E5_WORKER_TOKEN", raising=False)
    monkeypatch.delenv("E5_MODEL_REVISION", raising=False)
    monkeypatch.delenv("E5_MODEL_DIR", raising=False)
    import app.settings as settings_module

    importlib.reload(settings_module)


def test_production_stub_startup_fails(monkeypatch):
    monkeypatch.setenv("E5_WORKER_ENV", "production")
    monkeypatch.setenv("E5_WORKER_STUB", "true")
    import app.settings as settings_module

    with pytest.raises(RuntimeError, match="E5_WORKER_STUB"):
        importlib.reload(settings_module)

    _restore_test_settings(monkeypatch)


def test_production_token_required(monkeypatch):
    monkeypatch.setenv("E5_WORKER_ENV", "production")
    monkeypatch.setenv("E5_WORKER_STUB", "false")
    monkeypatch.setenv("E5_MODEL_REVISION", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    monkeypatch.setenv(
        "E5_MODEL_DIR",
        "C:/JYKStore/models/multilingual-e5-small-ko-v2/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    monkeypatch.delenv("E5_WORKER_TOKEN", raising=False)
    import app.settings as settings_module

    with pytest.raises(RuntimeError, match="E5_WORKER_TOKEN"):
        importlib.reload(settings_module)

    _restore_test_settings(monkeypatch)


def test_production_valid_sha_requires_model_dir(monkeypatch):
    monkeypatch.setenv("E5_WORKER_ENV", "production")
    monkeypatch.setenv("E5_WORKER_STUB", "false")
    monkeypatch.setenv("E5_MODEL_REVISION", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    monkeypatch.setenv("E5_WORKER_TOKEN", "tok")
    monkeypatch.delenv("E5_MODEL_DIR", raising=False)
    import app.settings as settings_module

    with pytest.raises(RuntimeError, match="E5_MODEL_DIR"):
        importlib.reload(settings_module)

    _restore_test_settings(monkeypatch)


def test_production_invalid_revision_rejected(monkeypatch):
    monkeypatch.setenv("E5_WORKER_ENV", "production")
    monkeypatch.setenv("E5_WORKER_STUB", "false")
    monkeypatch.setenv("E5_MODEL_REVISION", "main")
    monkeypatch.setenv("E5_WORKER_TOKEN", "tok")
    monkeypatch.setenv(
        "E5_MODEL_DIR",
        "C:/JYKStore/models/multilingual-e5-small-ko-v2/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    import app.settings as settings_module

    with pytest.raises(RuntimeError, match="40-char"):
        importlib.reload(settings_module)

    _restore_test_settings(monkeypatch)


def test_production_valid_sha_and_token_accepted(monkeypatch):
    monkeypatch.setenv("E5_WORKER_ENV", "production")
    monkeypatch.setenv("E5_WORKER_STUB", "false")
    monkeypatch.setenv("E5_MODEL_REVISION", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    monkeypatch.setenv(
        "E5_MODEL_DIR",
        "C:/JYKStore/models/multilingual-e5-small-ko-v2/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    monkeypatch.setenv("E5_WORKER_TOKEN", "tok")
    import app.settings as settings_module

    reloaded = importlib.reload(settings_module)
    assert reloaded.settings.token == "tok"
    assert reloaded.settings.model_revision == "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    assert "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" in reloaded.settings.model_dir

    _restore_test_settings(monkeypatch)


def test_auth_required_when_token_set(monkeypatch):
    monkeypatch.setenv("E5_WORKER_TOKEN", "secret-token")
    import app.settings as settings_module
    import app.main as main_module

    importlib.reload(settings_module)
    importlib.reload(main_module)
    embed = importlib.import_module("app.model")
    embed.warmup()

    with TestClient(main_module.app) as authed:
        missing = authed.get("/ready")
        assert missing.status_code == 401

        bad = authed.get("/ready", headers={"Authorization": "Bearer wrong"})
        assert bad.status_code == 401

        ok = authed.get("/ready", headers={"Authorization": "Bearer secret-token"})
        assert ok.status_code == 200

    monkeypatch.delenv("E5_WORKER_TOKEN", raising=False)
    importlib.reload(settings_module)
    importlib.reload(main_module)

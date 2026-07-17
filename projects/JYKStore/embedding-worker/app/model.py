from __future__ import annotations

import hashlib
import math
import threading
from typing import TYPE_CHECKING

from app.settings import settings

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

_lock = threading.Lock()
_model: "SentenceTransformer | None" = None
_ready = False


def estimate_token_count(text: str) -> int:
    trimmed = text.strip()
    if not trimmed:
        return 0
    return math.ceil(len(trimmed) / 4)


def assert_query_prefix(text: str) -> None:
    if not text.strip().startswith("query:"):
        raise ValueError("E5 query text must start with 'query:'")


def assert_passage_prefix(text: str) -> None:
    if not text.strip().startswith("passage:"):
        raise ValueError("E5 passage text must start with 'passage:'")


def assert_within_token_limit(text: str, context: str) -> None:
    tokens = estimate_token_count(text)
    if tokens > settings.max_sequence_tokens:
        raise ValueError(
            f"{context}: input exceeds {settings.max_sequence_tokens} token limit (estimate {tokens})"
        )


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm <= 0 or not math.isfinite(norm):
        raise ValueError("vector normalization failed")
    return [v / norm for v in vector]


def _stub_vector(text: str) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    while len(values) < settings.dimension:
        for i in range(0, len(digest), 4):
            if len(values) >= settings.dimension:
                break
            chunk = digest[i : i + 4]
            if len(chunk) < 4:
                chunk = chunk.ljust(4, b"\0")
            raw = int.from_bytes(chunk, "big", signed=False)
            values.append((raw % 10_000) / 10_000.0 - 0.5)
        digest = hashlib.sha256(digest).digest()
    if settings.normalize:
        return _l2_normalize(values)
    return values


def _load_model() -> None:
    global _model, _ready
    with _lock:
        if _ready:
            return
        if settings.stub_mode:
            _ready = True
            return
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(settings.model_id, device="cpu")
        _ready = True


def is_ready() -> bool:
    return _ready


def warmup() -> None:
    _load_model()
    if settings.stub_mode:
        _stub_vector("passage: warmup")
    else:
        assert _model is not None
        _model.encode(["passage: warmup"], normalize_embeddings=settings.normalize)


def embed_texts(texts: list[str], *, kind: str, normalize: bool) -> list[list[float]]:
    _load_model()
    if not is_ready():
        raise RuntimeError("model not ready")

    for text in texts:
        if not text or not text.strip():
            raise ValueError("empty text is not allowed")
        if kind == "query":
            assert_query_prefix(text)
        else:
            assert_passage_prefix(text)
        assert_within_token_limit(text, kind)

    if settings.stub_mode:
        vectors = [_stub_vector(t) for t in texts]
        if normalize and not settings.normalize:
            return vectors
        if normalize:
            return [_l2_normalize(v) for v in vectors]
        return vectors

    assert _model is not None
    encoded = _model.encode(texts, normalize_embeddings=normalize, batch_size=min(16, len(texts)))
    vectors: list[list[float]] = []
    for row in encoded:
        vec = [float(x) for x in row]
        if len(vec) != settings.dimension:
            raise ValueError(f"dimension mismatch: expected {settings.dimension}, got {len(vec)}")
        for v in vec:
            if not math.isfinite(v):
                raise ValueError("vector contains NaN or Infinity")
        vectors.append(vec)
    return vectors

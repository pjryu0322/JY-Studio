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
_tokenizer = None
_ready = False
_device = "cpu"


def estimate_token_count(text: str) -> int:
    """Fast pre-check only (chars/4). Not authoritative — the real tokenizer decides."""
    trimmed = text.strip()
    if not trimmed:
        return 0
    return math.ceil(len(trimmed) / 4)


def count_tokens(text: str) -> int:
    """Authoritative token count. Uses the model tokenizer in live mode."""
    if settings.stub_mode or _tokenizer is None:
        return estimate_token_count(text)
    encoded = _tokenizer(
        text,
        truncation=False,
        add_special_tokens=True,
        return_attention_mask=False,
        return_token_type_ids=False,
    )
    return len(encoded["input_ids"])


def assert_query_prefix(text: str) -> None:
    if not text.strip().startswith("query:"):
        raise ValueError("E5 query text must start with 'query:'")


def assert_passage_prefix(text: str) -> None:
    if not text.strip().startswith("passage:"):
        raise ValueError("E5 passage text must start with 'passage:'")


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
    return _l2_normalize(values)


def _load_model() -> None:
    global _model, _tokenizer, _ready
    with _lock:
        if _ready:
            return
        if settings.stub_mode:
            _ready = True
            return
        from sentence_transformers import SentenceTransformer

        revision = settings.model_revision or None
        _model = SentenceTransformer(settings.model_id, revision=revision, device="cpu")
        # Tokenizer must use the same revision as the model.
        _tokenizer = _model.tokenizer
        _ready = True


def is_ready() -> bool:
    return _ready


def device() -> str:
    return _device


def warmup() -> None:
    _load_model()
    if settings.stub_mode:
        _stub_vector("passage: warmup")
    else:
        assert _model is not None
        _model.encode(["passage: warmup"], normalize_embeddings=settings.normalize)


class TokenLimitError(ValueError):
    def __init__(self, index: int, token_count: int, max_tokens: int) -> None:
        self.index = index
        self.token_count = token_count
        self.max_tokens = max_tokens
        super().__init__(
            f"input[{index}] token count {token_count} exceeds {max_tokens}"
        )


def embed_texts(texts: list[str], *, kind: str, normalize: bool) -> list[list[float]]:
    _load_model()
    if not is_ready():
        raise RuntimeError("model not ready")
    if not normalize:
        raise ValueError("normalize=true is required")

    for index, text in enumerate(texts):
        if not text or not text.strip():
            raise ValueError(f"input[{index}] empty text is not allowed")
        if kind == "query":
            assert_query_prefix(text)
        else:
            assert_passage_prefix(text)
        tokens = count_tokens(text)
        if tokens > settings.max_sequence_tokens:
            raise TokenLimitError(index, tokens, settings.max_sequence_tokens)

    if settings.stub_mode:
        return [_stub_vector(t) for t in texts]

    assert _model is not None
    encoded = _model.encode(
        texts,
        normalize_embeddings=True,
        batch_size=min(settings.max_batch_size, len(texts)),
    )
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

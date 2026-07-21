"""Embedding generation for JYKStore Python Worker.

The Worker produces ``embeddings.json`` locally from ``chunks.json``. It never
writes to the Store DB, a vector index, or Object Storage, and never calls an
external API.

Two modes are supported:

- ``local_e5``          : production / default. Local CPU E5 model via
                          ``sentence-transformers`` (offline model files).
- ``deterministic_stub``: **test-only**. Reproducible vectors derived from a
                          hash of the embedding input text — no model download.

The embedding input text follows the Store E5 passage policy
(``src/lib/embedding/e5-embedding-text.ts``): ``passage: `` prefix over
``title / section / tags(keywords) / content``.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Keep aligned with src/lib/embedding/e5-embedding-constants.ts
DEFAULT_E5_PROVIDER = "local-e5"
DEFAULT_E5_MODEL_NAME = "dragonkue/multilingual-e5-small-ko-v2"
DEFAULT_E5_DIMENSION = 384
E5_PASSAGE_PREFIX = "passage: "

STUB_PROVIDER = "test-stub"
STUB_MODEL = "deterministic-stub"
DEFAULT_STUB_DIMENSION = 8

MODE_LOCAL_E5 = "local_e5"
MODE_DETERMINISTIC_STUB = "deterministic_stub"


class EmbeddingError(Exception):
    """Raised when embeddings cannot be produced for the given chunks."""


def resolve_embedding_config(
    options: dict[str, Any] | None,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Merge embedding options (options JSON) with environment defaults.

    Precedence: options JSON > environment variable > built-in default.
    """
    opts = dict(options or {})
    environ = env if env is not None else os.environ

    mode = (
        opts.get("mode")
        or environ.get("JYKSTORE_PYTHON_WORKER_EMBEDDING_MODE")
        or MODE_LOCAL_E5
    ).strip()
    if mode not in (MODE_LOCAL_E5, MODE_DETERMINISTIC_STUB):
        raise EmbeddingError(f"unknown embedding mode: {mode}")

    if mode == MODE_DETERMINISTIC_STUB:
        return {
            "mode": mode,
            "provider": opts.get("provider") or STUB_PROVIDER,
            "model": opts.get("model") or STUB_MODEL,
            "modelRevision": opts.get("modelRevision"),
            "dimension": int(opts.get("dimension") or DEFAULT_STUB_DIMENSION),
        }

    model_name = (
        opts.get("model")
        or environ.get("JYKSTORE_PYTHON_WORKER_E5_MODEL_NAME")
        or DEFAULT_E5_MODEL_NAME
    )
    model_path = (
        opts.get("modelPath")
        or environ.get("JYKSTORE_PYTHON_WORKER_E5_MODEL_PATH")
        or None
    )
    dimension = opts.get("dimension")
    return {
        "mode": mode,
        "provider": opts.get("provider") or DEFAULT_E5_PROVIDER,
        "model": model_name,
        "modelPath": model_path,
        "modelRevision": opts.get("modelRevision"),
        "dimension": int(dimension) if dimension else None,
    }


def build_passage_text(chunk: dict[str, Any]) -> str:
    """Build the E5 passage input text for a chunk (matches Store policy)."""
    title = chunk.get("title") or ""
    section = (chunk.get("section") or "").strip()
    tags = [t for t in (chunk.get("keywords") or []) if isinstance(t, str)]
    content = chunk.get("content") or ""
    parts = [title, section, *tags, content]
    body = "\n".join(p for p in parts if isinstance(p, str) and p.strip()).strip()
    if body.startswith("passage:"):
        return body
    return f"{E5_PASSAGE_PREFIX}{body}"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _stable_stringify_content(
    *, title: str, content: str, section: str, tags: list[str]
) -> str:
    """Replicate Store ``stableStringify`` for {title, content, section, tags}.

    Store (src/lib/chunk-embedding-service.ts) sorts object keys and renders
    scalars raw (no quotes): ``{content:..,section:..,tags:[..],title:..}``.
    Byte-identical output keeps ``contentHash`` compatible with Store stale
    detection.
    """
    tags_str = "[" + ",".join(tags) + "]"
    return f"{{content:{content},section:{section},tags:{tags_str},title:{title}}}"


def build_content_hash(chunk: dict[str, Any]) -> str:
    """Hash of the chunk's content fields, aligned with Store computeChunkContentHash.

    Only ``title / content / section / tags`` participate — ``keywords`` and
    ``symbols`` are never hashed directly. ``tags`` is the value that maps to the
    Store chunk ``tags`` at DB import (worker chunks expose ``keywords`` as the
    tag source when no explicit ``tags`` field is present).
    """
    if chunk.get("tags") is not None:
        raw_tags = chunk.get("tags") or []
    elif chunk.get("keywords") is not None:
        raw_tags = chunk.get("keywords") or []
    else:
        raw_tags = []
    tags = sorted(str(t) for t in raw_tags)
    return _sha256(
        _stable_stringify_content(
            title=chunk.get("title") or "",
            content=chunk.get("content") or "",
            section=chunk.get("section") or "",
            tags=tags,
        )
    )


def _stub_vector(text: str, dimension: int) -> list[float]:
    """Deterministic, L2-normalized vector derived from ``text`` (test only)."""
    values: list[float] = []
    counter = 0
    while len(values) < dimension:
        digest = hashlib.sha256(f"{counter}:{text}".encode("utf-8")).digest()
        for i in range(0, len(digest), 4):
            if len(values) >= dimension:
                break
            raw = int.from_bytes(digest[i : i + 4], "big") / 0xFFFFFFFF
            values.append(raw * 2.0 - 1.0)  # map to [-1, 1)
        counter += 1
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def _load_e5_model(config: dict[str, Any]):
    # local_e5 must never trigger a network download. A local model path is
    # required and validated before importing / loading the model.
    model_path = config.get("modelPath")
    if not model_path:
        raise EmbeddingError(
            "local_e5 requires a local modelPath; set options.embedding.modelPath "
            "or JYKSTORE_PYTHON_WORKER_E5_MODEL_PATH"
        )
    if not Path(model_path).exists():
        raise EmbeddingError(f"local_e5 modelPath does not exist: {model_path}")

    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # noqa: BLE001
        raise EmbeddingError(
            "sentence-transformers is not installed; install it or use "
            "deterministic_stub mode for tests"
        ) from exc

    try:
        return SentenceTransformer(
            str(model_path), device="cpu", local_files_only=True
        )
    except TypeError:
        # Older sentence-transformers may not accept local_files_only.
        return SentenceTransformer(str(model_path), device="cpu")
    except Exception as exc:  # noqa: BLE001
        raise EmbeddingError(
            f"failed to load local E5 model at '{model_path}': {exc}"
        ) from exc


def _encode_local_e5(
    texts: list[str], config: dict[str, Any]
) -> list[list[float]]:
    model = _load_e5_model(config)
    try:
        raw = model.encode(
            texts,
            batch_size=16,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise EmbeddingError(f"E5 encode failed: {exc}") from exc
    return [[float(x) for x in row] for row in raw]


def _assert_finite_vector(vector: list[float], chunk_id: str) -> None:
    if not vector:
        raise EmbeddingError(f"empty embedding vector for chunk {chunk_id}")
    for value in vector:
        if not math.isfinite(value):
            raise EmbeddingError(
                f"non-finite embedding value for chunk {chunk_id}"
            )


def build_embeddings(
    chunks: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build one embedding per chunk. Empty chunks -> empty list.

    Raises ``EmbeddingError`` on any generation problem so the caller can fail
    the run while still writing a contract-valid ``embeddings.json``.
    """
    if not chunks:
        return []

    mode = config.get("mode") or MODE_LOCAL_E5
    provider = config.get("provider") or (
        STUB_PROVIDER if mode == MODE_DETERMINISTIC_STUB else DEFAULT_E5_PROVIDER
    )
    model = config.get("model") or (
        STUB_MODEL if mode == MODE_DETERMINISTIC_STUB else DEFAULT_E5_MODEL_NAME
    )
    model_revision = config.get("modelRevision")
    configured_dim = config.get("dimension")
    created_at = datetime.now(timezone.utc).isoformat()

    passage_texts = [build_passage_text(c) for c in chunks]

    if mode == MODE_DETERMINISTIC_STUB:
        dimension = int(configured_dim or DEFAULT_STUB_DIMENSION)
        if dimension <= 0:
            raise EmbeddingError(f"invalid stub dimension: {dimension}")
        vectors = [_stub_vector(text, dimension) for text in passage_texts]
    else:
        vectors = _encode_local_e5(passage_texts, config)
        if len(vectors) != len(chunks):
            raise EmbeddingError(
                f"E5 returned {len(vectors)} vectors for {len(chunks)} chunks"
            )

    embeddings: list[dict[str, Any]] = []
    for chunk, passage_text, vector in zip(chunks, passage_texts, vectors):
        chunk_id = chunk.get("chunkId")
        if not chunk_id:
            raise EmbeddingError("chunk without chunkId cannot be embedded")
        _assert_finite_vector(vector, chunk_id)
        if configured_dim and len(vector) != int(configured_dim):
            raise EmbeddingError(
                f"chunk {chunk_id} vector length {len(vector)} != "
                f"configured dimension {configured_dim}"
            )
        embeddings.append(
            {
                "chunkId": chunk_id,
                "provider": provider,
                "model": model,
                "modelRevision": model_revision,
                "dimension": len(vector),
                "vector": vector,
                "contentHash": build_content_hash(chunk),
                "embeddingTextHash": _sha256(passage_text),
                "createdAt": created_at,
            }
        )
    return embeddings


def write_embeddings(embeddings: list[dict[str, Any]], path: Path) -> None:
    """Write embeddings.json. Rejects NaN/Infinity so JSON stays strict."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(embeddings, ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )

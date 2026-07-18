from __future__ import annotations

import os
import re
from dataclasses import dataclass

ALLOWED_ENVIRONMENTS = ("development", "test", "production")
HF_COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def assert_pinned_revision(revision: str, *, context: str) -> None:
    if not revision:
        raise RuntimeError(f"{context} must be set (40-char Hugging Face commit SHA)")
    if revision == "legacy-unknown":
        raise RuntimeError(f"{context}: legacy-unknown is not allowed for new worker configs")
    if revision == "stub":
        raise RuntimeError(f"{context}: stub revision is not allowed outside stub mode")
    if not HF_COMMIT_SHA_RE.match(revision):
        raise RuntimeError(
            f"{context} must be a 40-char lowercase hex commit SHA (got length {len(revision)})"
        )


@dataclass(frozen=True)
class Settings:
    environment: str
    model_id: str
    model_revision: str
    dimension: int
    max_sequence_tokens: int
    stub_mode: bool
    normalize: bool
    host: str
    port: int
    token: str
    max_batch_size: int
    max_text_bytes: int
    max_request_bytes: int
    max_concurrency: int

    @staticmethod
    def from_env() -> "Settings":
        # Validation order: environment → stub → revision → token → dimension → tokens → concurrency
        environment = os.getenv("E5_WORKER_ENV", "development").strip().lower()
        if environment not in ALLOWED_ENVIRONMENTS:
            raise RuntimeError(
                f"E5_WORKER_ENV must be one of {ALLOWED_ENVIRONMENTS}, got '{environment}'"
            )

        stub_mode = _as_bool(os.getenv("E5_WORKER_STUB"), default=False)
        if environment == "production" and stub_mode:
            raise RuntimeError("E5_WORKER_STUB must be false in production")

        model_revision = os.getenv("E5_MODEL_REVISION", "").strip()
        if stub_mode:
            # Stub may omit revision; resolved_revision returns "stub".
            pass
        else:
            # Live backends always require a pinned 40-char commit SHA.
            assert_pinned_revision(model_revision, context="E5_MODEL_REVISION")

        token = os.getenv("E5_WORKER_TOKEN", "").strip()
        if environment == "production" and not token:
            raise RuntimeError("E5_WORKER_TOKEN must be set in production")

        dimension = int(os.getenv("E5_EMBEDDING_DIMENSION", "384"))
        if dimension != 384:
            raise RuntimeError(f"E5_EMBEDDING_DIMENSION must be 384, got {dimension}")

        max_sequence_tokens = int(os.getenv("E5_MAX_SEQUENCE_TOKENS", "512"))
        if max_sequence_tokens != 512:
            raise RuntimeError(
                f"E5_MAX_SEQUENCE_TOKENS must be 512, got {max_sequence_tokens}"
            )

        max_concurrency = int(os.getenv("E5_MAX_CONCURRENCY", "1"))
        if max_concurrency < 1:
            raise RuntimeError("E5_MAX_CONCURRENCY must be >= 1")

        return Settings(
            environment=environment,
            model_id=os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2").strip(),
            model_revision=model_revision,
            dimension=dimension,
            max_sequence_tokens=max_sequence_tokens,
            stub_mode=stub_mode,
            normalize=not _as_bool(os.getenv("E5_NORMALIZE_DISABLE"), default=False),
            host=os.getenv("E5_WORKER_HOST", "0.0.0.0").strip(),
            port=int(os.getenv("E5_WORKER_PORT", "8000")),
            token=token,
            max_batch_size=int(os.getenv("E5_MAX_BATCH_SIZE", "32")),
            max_text_bytes=int(os.getenv("E5_MAX_TEXT_BYTES", "20000")),
            max_request_bytes=int(os.getenv("E5_MAX_REQUEST_BYTES", "300000")),
            max_concurrency=max_concurrency,
        )

    @property
    def configured_revision(self) -> str:
        if self.stub_mode:
            return "stub"
        return self.model_revision

    @property
    def backend(self) -> str:
        return "stub" if self.stub_mode else "sentence-transformers"


settings = Settings.from_env()

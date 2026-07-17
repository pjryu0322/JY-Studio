from __future__ import annotations

import os
from dataclasses import dataclass

ALLOWED_ENVIRONMENTS = ("development", "test", "production")


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


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
        environment = os.getenv("E5_WORKER_ENV", "development").strip().lower()
        if environment not in ALLOWED_ENVIRONMENTS:
            raise RuntimeError(
                f"E5_WORKER_ENV must be one of {ALLOWED_ENVIRONMENTS}, got '{environment}'"
            )

        stub_mode = _as_bool(os.getenv("E5_WORKER_STUB"), default=False)

        # A. Operational stub block: production must never run the stub backend.
        if environment == "production" and stub_mode:
            raise RuntimeError("E5_WORKER_STUB must be false in production")

        model_revision = os.getenv("E5_MODEL_REVISION", "").strip()
        if environment == "production" and not stub_mode and not model_revision:
            raise RuntimeError("E5_MODEL_REVISION must be set (fixed commit SHA) in production")

        return Settings(
            environment=environment,
            model_id=os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2").strip(),
            model_revision=model_revision,
            dimension=int(os.getenv("E5_EMBEDDING_DIMENSION", "384")),
            max_sequence_tokens=int(os.getenv("E5_MAX_SEQUENCE_TOKENS", "512")),
            stub_mode=stub_mode,
            normalize=not _as_bool(os.getenv("E5_NORMALIZE_DISABLE"), default=False),
            host=os.getenv("E5_WORKER_HOST", "0.0.0.0").strip(),
            port=int(os.getenv("E5_WORKER_PORT", "8000")),
            token=os.getenv("E5_WORKER_TOKEN", "").strip(),
            max_batch_size=int(os.getenv("E5_MAX_BATCH_SIZE", "32")),
            max_text_bytes=int(os.getenv("E5_MAX_TEXT_BYTES", "20000")),
            max_request_bytes=int(os.getenv("E5_MAX_REQUEST_BYTES", "300000")),
            max_concurrency=int(os.getenv("E5_MAX_CONCURRENCY", "1")),
        )

    @property
    def effective_revision(self) -> str:
        if self.stub_mode:
            return "stub"
        return self.model_revision or "legacy-unknown"

    @property
    def backend(self) -> str:
        return "stub" if self.stub_mode else "sentence-transformers"


settings = Settings.from_env()

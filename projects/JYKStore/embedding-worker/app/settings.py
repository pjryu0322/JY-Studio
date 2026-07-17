from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    model_id: str
    dimension: int
    max_sequence_tokens: int
    stub_mode: bool
    normalize: bool
    host: str
    port: int

    @staticmethod
    def from_env() -> "Settings":
        stub_raw = os.getenv("E5_WORKER_STUB", "false").strip().lower()
        return Settings(
            model_id=os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2").strip(),
            dimension=int(os.getenv("E5_EMBEDDING_DIMENSION", "384")),
            max_sequence_tokens=int(os.getenv("E5_MAX_SEQUENCE_TOKENS", "512")),
            stub_mode=stub_raw in ("1", "true", "yes", "on"),
            normalize=os.getenv("E5_NORMALIZE", "true").strip().lower() not in ("0", "false", "no", "off"),
            host=os.getenv("E5_WORKER_HOST", "0.0.0.0").strip(),
            port=int(os.getenv("E5_WORKER_PORT", "8000")),
        )


settings = Settings.from_env()

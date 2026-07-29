"""Load canonical chunk policy (Worker ZIP SoT)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_DEFAULTS: dict[str, Any] = {
    "policyVersion": "chunk-policy-v1",
    "hardMaxTokens": 512,
    "targetPassageTokens": 480,
    "overlapTokens": 0,
    "smallChunkMaxChars": 120,
    "minContentTokens": 48,
    "charsPerTokenEstimate": 4,
}


def default_chunk_policy_path() -> Path:
    return Path(__file__).resolve().parent.parent / "config" / "chunk_policy.json"


@lru_cache(maxsize=1)
def load_chunk_policy() -> dict[str, Any]:
    path = default_chunk_policy_path()
    if not path.is_file():
        return dict(_DEFAULTS)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return dict(_DEFAULTS)
        merged = dict(_DEFAULTS)
        merged.update({k: data[k] for k in _DEFAULTS if k in data})
        return merged
    except (OSError, json.JSONDecodeError):
        return dict(_DEFAULTS)


def chunk_policy_version() -> str:
    return str(load_chunk_policy().get("policyVersion") or _DEFAULTS["policyVersion"])


def target_passage_tokens() -> int:
    return int(load_chunk_policy().get("targetPassageTokens") or 480)


def hard_max_tokens() -> int:
    return int(load_chunk_policy().get("hardMaxTokens") or 512)


def small_chunk_max_chars() -> int:
    return int(load_chunk_policy().get("smallChunkMaxChars") or 120)


def min_content_tokens() -> int:
    return int(load_chunk_policy().get("minContentTokens") or 48)


def chars_per_token_estimate() -> int:
    return int(load_chunk_policy().get("charsPerTokenEstimate") or 4)

"""
Local E5 model asset helpers — Manifest + install-complete validation.
Worker runtime loads ONLY from a local directory (no Hub download).
"""

from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

HF_COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
MANIFEST_NAME = "jykstore-model-manifest.json"
INSTALL_COMPLETE_NAME = ".install-complete"
MANIFEST_SCHEMA_VERSION = 1


class ModelAssetError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(f"{code}: {message}")


@dataclass(frozen=True)
class ModelManifest:
    schema_version: int
    model_id: str
    configured_revision: str
    resolved_revision: str
    dimension: int
    max_sequence_tokens: int
    normalized: bool
    runtime: str
    installed_at: str
    install_source: str
    offline_ready: bool

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "ModelManifest":
        try:
            return ModelManifest(
                schema_version=int(data["schemaVersion"]),
                model_id=str(data["modelId"]),
                configured_revision=str(data["configuredRevision"]),
                resolved_revision=str(data["resolvedRevision"]),
                dimension=int(data["dimension"]),
                max_sequence_tokens=int(data["maxSequenceTokens"]),
                normalized=bool(data["normalized"]),
                runtime=str(data["runtime"]),
                installed_at=str(data["installedAt"]),
                install_source=str(data["installSource"]),
                offline_ready=bool(data["offlineReady"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ModelAssetError(
                "E5_MODEL_MANIFEST_INVALID",
                f"manifest fields invalid: {exc}",
            ) from exc

    def to_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "modelId": self.model_id,
            "configuredRevision": self.configured_revision,
            "resolvedRevision": self.resolved_revision,
            "dimension": self.dimension,
            "maxSequenceTokens": self.max_sequence_tokens,
            "normalized": self.normalized,
            "runtime": self.runtime,
            "installedAt": self.installed_at,
            "installSource": self.install_source,
            "offlineReady": self.offline_ready,
        }


def assert_pinned_sha(revision: str, *, context: str) -> None:
    if not revision or not HF_COMMIT_SHA_RE.match(revision):
        raise ModelAssetError(
            "E5_MODEL_REVISION_MISMATCH",
            f"{context} must be a 40-char lowercase hex commit SHA",
        )


def manifest_path(model_dir: str | Path) -> Path:
    return Path(model_dir) / MANIFEST_NAME


def install_complete_path(model_dir: str | Path) -> Path:
    return Path(model_dir) / INSTALL_COMPLETE_NAME


def read_manifest(model_dir: str | Path) -> ModelManifest:
    path = manifest_path(model_dir)
    if not path.is_file():
        raise ModelAssetError("E5_MODEL_MANIFEST_MISSING", f"missing {MANIFEST_NAME}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelAssetError("E5_MODEL_MANIFEST_INVALID", f"cannot read manifest: {exc}") from exc
    if not isinstance(data, dict):
        raise ModelAssetError("E5_MODEL_MANIFEST_INVALID", "manifest root must be an object")
    return ModelManifest.from_dict(data)


def write_manifest(model_dir: str | Path, manifest: ModelManifest) -> None:
    path = manifest_path(model_dir)
    path.write_text(
        json.dumps(manifest.to_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_install_complete(model_dir: str | Path) -> None:
    install_complete_path(model_dir).write_text("ok\n", encoding="utf-8")


def validate_installed_model_dir(
    model_dir: str | Path,
    *,
    expected_model_id: str,
    expected_revision: str,
    expected_dimension: int = 384,
    expected_max_sequence_tokens: int = 512,
) -> ModelManifest:
    root = Path(model_dir)
    if not model_dir or not str(model_dir).strip():
        raise ModelAssetError("E5_MODEL_DIR_REQUIRED", "E5_MODEL_DIR is required")
    if not root.is_dir():
        raise ModelAssetError("E5_MODEL_NOT_INSTALLED", f"model directory missing: {root}")
    if not install_complete_path(root).is_file():
        raise ModelAssetError(
            "E5_MODEL_INSTALL_INCOMPLETE",
            f"missing {INSTALL_COMPLETE_NAME}",
        )
    manifest = read_manifest(root)
    if manifest.schema_version != MANIFEST_SCHEMA_VERSION:
        raise ModelAssetError(
            "E5_MODEL_MANIFEST_INVALID",
            f"unsupported schemaVersion {manifest.schema_version}",
        )
    if manifest.model_id != expected_model_id:
        raise ModelAssetError(
            "E5_MODEL_ID_MISMATCH",
            "manifest modelId does not match E5_MODEL_ID",
        )
    assert_pinned_sha(expected_revision, context="E5_MODEL_REVISION")
    assert_pinned_sha(manifest.configured_revision, context="manifest.configuredRevision")
    assert_pinned_sha(manifest.resolved_revision, context="manifest.resolvedRevision")
    if manifest.configured_revision != expected_revision:
        raise ModelAssetError(
            "E5_MODEL_REVISION_MISMATCH",
            "manifest configuredRevision does not match E5_MODEL_REVISION",
        )
    if manifest.resolved_revision != expected_revision:
        raise ModelAssetError(
            "E5_MODEL_REVISION_MISMATCH",
            "manifest resolvedRevision does not match E5_MODEL_REVISION",
        )
    if manifest.configured_revision != manifest.resolved_revision:
        raise ModelAssetError(
            "E5_MODEL_REVISION_MISMATCH",
            "manifest configuredRevision != resolvedRevision",
        )
    if manifest.dimension != expected_dimension:
        raise ModelAssetError(
            "E5_MODEL_DIMENSION_MISMATCH",
            f"expected dimension {expected_dimension}, got {manifest.dimension}",
        )
    if manifest.max_sequence_tokens != expected_max_sequence_tokens:
        raise ModelAssetError(
            "E5_MODEL_MANIFEST_INVALID",
            f"expected maxSequenceTokens {expected_max_sequence_tokens}",
        )
    if not manifest.normalized:
        raise ModelAssetError("E5_MODEL_MANIFEST_INVALID", "normalized must be true")
    if not manifest.offline_ready:
        raise ModelAssetError("E5_MODEL_MANIFEST_INVALID", "offlineReady must be true")
    # Basic presence of model / tokenizer files (SentenceTransformer layout).
    has_model = any(
        (root / name).exists()
        for name in ("model.safetensors", "pytorch_model.bin", "model.onnx")
    )
    has_tokenizer = (root / "tokenizer.json").is_file() or (root / "tokenizer_config.json").is_file()
    if not has_model:
        raise ModelAssetError("E5_MODEL_INSTALL_INCOMPLETE", "model weights missing")
    if not has_tokenizer:
        raise ModelAssetError("E5_MODEL_INSTALL_INCOMPLETE", "tokenizer files missing")
    return manifest


def assert_vector_ok(vector: list[float], *, expected_dimension: int = 384) -> None:
    if len(vector) != expected_dimension:
        raise ModelAssetError(
            "E5_MODEL_DIMENSION_MISMATCH",
            f"expected {expected_dimension}, got {len(vector)}",
        )
    for value in vector:
        if not math.isfinite(value):
            raise ModelAssetError("E5_MODEL_LOCAL_LOAD_FAILED", "vector contains NaN or Infinity")


def set_offline_hub_env() -> None:
    """Force Hugging Face / Transformers offline for worker runtime."""
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"

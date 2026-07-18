"""Unit tests for Local E5 model asset validation (no Hub download)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.model_asset import (
    ModelAssetError,
    ModelManifest,
    validate_installed_model_dir,
    write_install_complete,
    write_manifest,
)

SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
MODEL_ID = "dragonkue/multilingual-e5-small-ko-v2"


def _write_fake_model(root: Path, *, revision: str = SHA, model_id: str = MODEL_ID) -> None:
    root.mkdir(parents=True, exist_ok=True)
    (root / "model.safetensors").write_bytes(b"fake")
    (root / "tokenizer.json").write_text("{}", encoding="utf-8")
    write_manifest(
        root,
        ModelManifest(
            schema_version=1,
            model_id=model_id,
            configured_revision=revision,
            resolved_revision=revision,
            dimension=384,
            max_sequence_tokens=512,
            normalized=True,
            runtime="sentence-transformers",
            installed_at="2026-07-18T00:00:00.000Z",
            install_source="huggingface",
            offline_ready=True,
        ),
    )
    write_install_complete(root)


def test_validate_ok(tmp_path: Path):
    model_dir = tmp_path / SHA
    _write_fake_model(model_dir)
    manifest = validate_installed_model_dir(
        model_dir, expected_model_id=MODEL_ID, expected_revision=SHA
    )
    assert manifest.resolved_revision == SHA


def test_missing_dir(tmp_path: Path):
    with pytest.raises(ModelAssetError) as exc:
        validate_installed_model_dir(
            tmp_path / "missing", expected_model_id=MODEL_ID, expected_revision=SHA
        )
    assert exc.value.code == "E5_MODEL_NOT_INSTALLED"


def test_missing_marker(tmp_path: Path):
    model_dir = tmp_path / SHA
    _write_fake_model(model_dir)
    (model_dir / ".install-complete").unlink()
    with pytest.raises(ModelAssetError) as exc:
        validate_installed_model_dir(
            model_dir, expected_model_id=MODEL_ID, expected_revision=SHA
        )
    assert exc.value.code == "E5_MODEL_INSTALL_INCOMPLETE"


def test_revision_mismatch(tmp_path: Path):
    model_dir = tmp_path / SHA
    _write_fake_model(model_dir)
    other = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    with pytest.raises(ModelAssetError) as exc:
        validate_installed_model_dir(
            model_dir, expected_model_id=MODEL_ID, expected_revision=other
        )
    assert exc.value.code == "E5_MODEL_REVISION_MISMATCH"


def test_invalid_revision_format(tmp_path: Path):
    model_dir = tmp_path / "x"
    _write_fake_model(model_dir)
    with pytest.raises(ModelAssetError):
        validate_installed_model_dir(
            model_dir, expected_model_id=MODEL_ID, expected_revision="main"
        )


def test_model_source_local_has_no_snapshot_download_in_runtime():
    text = Path(__file__).resolve().parents[1].joinpath("app", "model.py").read_text(encoding="utf-8")
    assert "from huggingface_hub import snapshot_download" not in text
    assert "HfApi()" not in text
    assert "local_files_only=True" in text
    assert "SentenceTransformer(" in text
    assert "settings.model_dir" in text

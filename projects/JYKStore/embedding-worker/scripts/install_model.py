"""
Explicit one-time Local E5 model installer.
Network download is allowed ONLY here — never in worker runtime.
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Allow `python scripts/install_model.py` from embedding-worker/
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.model_asset import (  # noqa: E402
    HF_COMMIT_SHA_RE,
    MANIFEST_SCHEMA_VERSION,
    ModelAssetError,
    ModelManifest,
    assert_vector_ok,
    validate_installed_model_dir,
    write_install_complete,
    write_manifest,
)


def _log(message: str) -> None:
    print(message, flush=True)


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ModelAssetError("E5_MODEL_DIR_REQUIRED" if "DIR" in name else "E5_MODEL_REVISION_MISMATCH", f"{name} is required")
    return value


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


def install(*, force: bool = False) -> int:
    model_id = os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2").strip()
    revision = _require_env("E5_MODEL_REVISION")
    model_dir = Path(_require_env("E5_MODEL_DIR"))
    dimension = int(os.getenv("E5_EMBEDDING_DIMENSION", "384"))
    max_tokens = int(os.getenv("E5_MAX_SEQUENCE_TOKENS", "512"))

    if not HF_COMMIT_SHA_RE.match(revision):
        raise ModelAssetError(
            "E5_MODEL_REVISION_MISMATCH",
            "E5_MODEL_REVISION must be a 40-char lowercase hex commit SHA",
        )
    if dimension != 384:
        raise ModelAssetError("E5_MODEL_DIMENSION_MISMATCH", "dimension must be 384")
    if max_tokens != 512:
        raise ModelAssetError("E5_MODEL_MANIFEST_INVALID", "maxSequenceTokens must be 512")

    if model_dir.is_dir() and not force:
        try:
            validate_installed_model_dir(
                model_dir,
                expected_model_id=model_id,
                expected_revision=revision,
                expected_dimension=dimension,
                expected_max_sequence_tokens=max_tokens,
            )
            _log(f"INSTALL_SKIP already installed at {model_dir}")
            return 0
        except ModelAssetError as exc:
            _log(f"INSTALL_REPAIR previous install incomplete ({exc.code}); reinstalling")

    parent = model_dir.parent
    parent.mkdir(parents=True, exist_ok=True)
    tmp_root = parent / f".installing-{uuid.uuid4().hex}"
    tmp_root.mkdir(parents=True, exist_ok=False)
    _log(f"INSTALL_TMP {tmp_root}")

    try:
        from huggingface_hub import snapshot_download
        from sentence_transformers import SentenceTransformer

        snapshot_path = Path(
            snapshot_download(
                repo_id=model_id,
                revision=revision,
                local_dir=str(tmp_root),
                local_dir_use_symlinks=False,
            )
        )
        _log(f"INSTALL_DOWNLOAD_OK revision={revision}")

        # Load from the local temp directory only for validation.
        model = SentenceTransformer(str(snapshot_path), device="cpu", local_files_only=True)
        tokenizer = model.tokenizer
        if tokenizer is None:
            raise ModelAssetError("E5_MODEL_LOCAL_LOAD_FAILED", "tokenizer missing after download")

        ko_passages = [
            "passage: Grid의 sort API를 사용하면 컬럼 기준으로 행을 정렬할 수 있습니다.",
            "passage: 차트의 범례 위치를 변경하는 방법입니다.",
        ]
        en_passages = [
            "passage: Use the Grid sort API to order rows by a column.",
            "passage: This section explains how to change a chart legend position.",
        ]
        ko_query = "query: 그리드에서 행을 정렬하는 방법"
        en_query = "query: how to sort rows in the grid"

        encoded = model.encode(
            [ko_query, *ko_passages, en_query, *en_passages],
            normalize_embeddings=True,
        )
        vectors = [[float(x) for x in row] for row in encoded]
        for vec in vectors:
            assert_vector_ok(vec, expected_dimension=dimension)

        ko_q, ko_rel, ko_unrel, en_q, en_rel, en_unrel = vectors
        if _cosine(ko_q, ko_rel) <= _cosine(ko_q, ko_unrel):
            raise ModelAssetError(
                "E5_MODEL_LOCAL_LOAD_FAILED",
                "Korean related passage similarity must exceed unrelated",
            )
        if _cosine(en_q, en_rel) <= _cosine(en_q, en_unrel):
            raise ModelAssetError(
                "E5_MODEL_LOCAL_LOAD_FAILED",
                "English related passage similarity must exceed unrelated",
            )
        _log("INSTALL_VECTOR_OK dimension=384 korean/english ranking ok")

        installed_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        manifest = ModelManifest(
            schema_version=MANIFEST_SCHEMA_VERSION,
            model_id=model_id,
            configured_revision=revision,
            resolved_revision=revision,
            dimension=dimension,
            max_sequence_tokens=max_tokens,
            normalized=True,
            runtime="sentence-transformers",
            installed_at=installed_at,
            install_source="huggingface",
            offline_ready=True,
        )
        write_manifest(snapshot_path, manifest)
        write_install_complete(snapshot_path)

        if model_dir.exists():
            shutil.rmtree(model_dir)
        snapshot_path.rename(model_dir)
        tmp_root = None  # renamed away

        validate_installed_model_dir(
            model_dir,
            expected_model_id=model_id,
            expected_revision=revision,
            expected_dimension=dimension,
            expected_max_sequence_tokens=max_tokens,
        )
        size_bytes = sum(p.stat().st_size for p in model_dir.rglob("*") if p.is_file())
        _log(f"INSTALL_OK path={model_dir}")
        _log(f"INSTALL_SIZE_BYTES {size_bytes}")
        _log(f"INSTALL_REVISION {revision}")
        return 0
    except Exception:
        if tmp_root is not None and Path(tmp_root).exists():
            shutil.rmtree(tmp_root, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Install Local E5 model asset")
    parser.add_argument("--force", action="store_true", help="Reinstall even if complete")
    args = parser.parse_args()
    try:
        return install(force=args.force)
    except ModelAssetError as exc:
        _log(f"INSTALL_FAIL {exc.code}: {exc}")
        return 1
    except Exception as exc:  # noqa: BLE001
        _log(f"INSTALL_FAIL unexpected: {type(exc).__name__}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

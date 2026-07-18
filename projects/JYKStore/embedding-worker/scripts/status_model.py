"""Offline status check for installed Local E5 model (no Hub network)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.model_asset import ModelAssetError, set_offline_hub_env, validate_installed_model_dir  # noqa: E402


def main() -> int:
    set_offline_hub_env()
    model_id = os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2").strip()
    revision = os.getenv("E5_MODEL_REVISION", "").strip()
    model_dir = os.getenv("E5_MODEL_DIR", "").strip()
    try:
        manifest = validate_installed_model_dir(
            model_dir,
            expected_model_id=model_id,
            expected_revision=revision,
        )
    except ModelAssetError as exc:
        print(json.dumps({"ok": False, "code": exc.code, "message": str(exc)}, ensure_ascii=False))
        return 1
    size_bytes = sum(p.stat().st_size for p in Path(model_dir).rglob("*") if p.is_file())
    print(
        json.dumps(
            {
                "ok": True,
                "modelId": manifest.model_id,
                "configuredRevision": manifest.configured_revision,
                "resolvedRevision": manifest.resolved_revision,
                "dimension": manifest.dimension,
                "maxSequenceTokens": manifest.max_sequence_tokens,
                "normalized": manifest.normalized,
                "offlineReady": manifest.offline_ready,
                "installedAt": manifest.installed_at,
                "sizeBytes": size_bytes,
                "modelDirConfigured": bool(model_dir),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

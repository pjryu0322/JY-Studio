"""Offline verify: load local model + emit 384-d vectors (no Hub network)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.model_asset import (  # noqa: E402
    ModelAssetError,
    assert_vector_ok,
    set_offline_hub_env,
    validate_installed_model_dir,
)


def main() -> int:
    set_offline_hub_env()
    model_id = os.getenv("E5_MODEL_ID", "dragonkue/multilingual-e5-small-ko-v2").strip()
    revision = os.getenv("E5_MODEL_REVISION", "").strip()
    model_dir = os.getenv("E5_MODEL_DIR", "").strip()
    try:
        validate_installed_model_dir(
            model_dir,
            expected_model_id=model_id,
            expected_revision=revision,
        )
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(model_dir, device="cpu", local_files_only=True)
        vectors = model.encode(
            [
                "query: 그리드에서 행을 정렬하는 방법",
                "passage: Grid의 sort API를 사용하면 컬럼 기준으로 행을 정렬할 수 있습니다.",
            ],
            normalize_embeddings=True,
        )
        out = [[float(x) for x in row] for row in vectors]
        for vec in out:
            assert_vector_ok(vec)
    except ModelAssetError as exc:
        print(json.dumps({"ok": False, "code": exc.code, "message": str(exc)}, ensure_ascii=False))
        return 1
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": "E5_MODEL_LOCAL_LOAD_FAILED",
                    "message": type(exc).__name__,
                },
                ensure_ascii=False,
            )
        )
        return 1
    print(
        json.dumps(
            {
                "ok": True,
                "dimension": 384,
                "vectorCount": len(out),
                "localFilesOnly": True,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

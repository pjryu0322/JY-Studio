"""Validation / processing report builder."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def build_validation_report(
    *,
    inventory: list[dict[str, Any]],
    parser_results: dict[str, list[dict[str, Any]]],
    license_signals: dict[str, Any],
    warnings: list[str],
    errors: list[str],
    chunks_count: int,
    documents_count: int,
    status: str,
    embeddings_count: int = 0,
    embedding_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    classifications = Counter(e.get("classification") for e in inventory)
    parser_summary: dict[str, Any] = {}

    for parser_name, results in parser_results.items():
        ok = sum(1 for r in results if r.get("status", "ok") == "ok")
        skipped = sum(1 for r in results if r.get("status") == "skipped")
        failed = sum(1 for r in results if r.get("status") == "failed")
        parser_summary[parser_name] = {
            "attempted": len(results),
            "ok": ok,
            "skipped": skipped,
            "failed": failed,
            "details": [
                {
                    "sourcePath": r.get("sourcePath"),
                    "status": r.get("status", "ok"),
                    "reason": r.get("skipReason") or r.get("error"),
                }
                for r in results
                if r.get("status") in {"skipped", "failed"}
            ],
        }

    total_ok = sum(v["ok"] for v in parser_summary.values())
    total_failed = sum(v["failed"] for v in parser_summary.values())
    total_skipped = sum(v["skipped"] for v in parser_summary.values())

    embedding_block = embedding_summary or {
        "mode": None,
        "provider": None,
        "model": None,
        "dimension": None,
        "status": "skipped",
        "embeddedChunks": 0,
        "missingEmbeddings": chunks_count,
        "tokenLimitExceeded": 0,
    }

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "totals": {
            "files": len(inventory),
            "knowledgeTargets": classifications.get("knowledge_target", 0),
            "reviewTargets": classifications.get("review_target", 0),
            "supportingAssets": classifications.get("supporting_asset", 0),
            "excluded": classifications.get("excluded", 0),
            "documents": documents_count,
            "chunks": chunks_count,
            "embeddings": embeddings_count,
            "parseOk": total_ok,
            "parseFailed": total_failed,
            "parseSkipped": total_skipped,
        },
        "embedding": embedding_block,
        "parsers": parser_summary,
        "license": {
            "licenseDetected": bool(license_signals.get("licenseDetected")),
            "licenseKeyDetected": bool(license_signals.get("licenseKeyDetected")),
            "licenseFileCount": len(license_signals.get("licenseFiles") or []),
        },
        "warnings": warnings,
        "errors": errors,
    }


def write_validation_report(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

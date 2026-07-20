"""License / copyright file inspector."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..policies import is_license_filename

PARSER_NAME = "license_inspector"
PARSER_VERSION = "0.1.0"


def detect_license_signals(
    inventory: list[dict[str, Any]],
    extract_root: Path,
) -> dict[str, Any]:
    """
    Scan inventory for license/copyright review targets and LicenseKey folders.
    Returns a summary suitable for validation_report.
    """
    license_files: list[dict[str, Any]] = []
    license_key_detected = False
    review_paths: list[str] = []

    for entry in inventory:
        source = entry.get("sourcePath", "")
        parts = source.replace("\\", "/").lower().split("/")
        if "licensekey" in parts:
            license_key_detected = True

        if entry.get("classification") == "review_target" or is_license_filename(
            Path(source).name
        ):
            review_paths.append(source)
            abs_path = extract_root / source
            preview = ""
            if abs_path.is_file():
                try:
                    text = abs_path.read_text(encoding="utf-8", errors="replace")
                    preview = text[:500]
                except OSError:
                    preview = ""
            license_files.append(
                {
                    "sourcePath": source,
                    "parser": PARSER_NAME,
                    "parserVersion": PARSER_VERSION,
                    "preview": preview,
                    "classification": entry.get("classification"),
                }
            )

    return {
        "licenseDetected": len(license_files) > 0,
        "licenseKeyDetected": license_key_detected,
        "licenseFiles": license_files,
        "reviewPaths": review_paths,
    }


def write_license_artifacts(
    signals: dict[str, Any],
    artifacts_dir: Path,
) -> Path | None:
    if not signals.get("licenseFiles"):
        return None
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out = artifacts_dir / "license_inspection.json"
    out.write_text(
        json.dumps(signals, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return out

"""Build inventory.json from extracted archive files."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .policies import classify_file


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def build_inventory(
    extract_root: Path,
    path_meta: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Walk extracted files and produce inventory entries.

    sourcePath is the recovered display path (POSIX-style).
    path_meta maps sourcePath → encoding metadata from ZIP extraction.
    """
    entries: list[dict[str, Any]] = []
    if not extract_root.exists():
        return entries

    meta_by_path = path_meta or {}

    for file_path in sorted(extract_root.rglob("*")):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(extract_root).as_posix()
        size = file_path.stat().st_size
        try:
            digest = sha256_file(file_path)
        except OSError:
            digest = ""
        classification = classify_file(rel)
        meta = meta_by_path.get(rel, {})
        entries.append(
            {
                "sourcePath": rel,
                "rawSourcePath": meta.get("rawSourcePath", rel),
                "pathEncoding": meta.get("pathEncoding", "utf-8"),
                "pathDecoded": bool(meta.get("pathDecoded", True)),
                "extension": file_path.suffix.lower() or "",
                "size": size,
                "sha256": digest,
                "fileType": classification.file_type,
                "classification": classification.classification,
                "parser": classification.parser,
                "excludedReason": classification.excluded_reason,
            }
        )
    return entries


def write_inventory(entries: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def inventory_by_path(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {e["sourcePath"]: e for e in entries}


def stamp_inventory_provenance(
    entries: list[dict[str, Any]],
    *,
    inventory_item_id_by_path: dict[str, str] | None = None,
    working_copy_id: str | None = None,
    source_revision_id: str | None = None,
    inventory_id: str | None = None,
) -> list[dict[str, Any]]:
    """Attach Store inventory / WC / revision ids onto Worker inventory entries."""
    path_map = inventory_item_id_by_path or {}
    for entry in entries:
        source_path = str(entry.get("sourcePath") or "").replace("\\", "/")
        item_id = path_map.get(source_path)
        if item_id:
            entry["inventoryItemId"] = item_id
        if working_copy_id:
            entry["workingCopyId"] = working_copy_id
        if source_revision_id:
            entry["sourceRevisionId"] = source_revision_id
        if inventory_id:
            entry["inventoryId"] = inventory_id
    return entries

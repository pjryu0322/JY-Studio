#!/usr/bin/env python3
"""JYKStore Python Worker CLI — parse a product document/sample ZIP archive."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import sys
import zipfile
from pathlib import Path
from typing import Any

# Allow running as `python parse_archive.py` from python-worker/
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.chunker import build_chunks_and_traces, write_chunks, write_traces
from src.exclusion_policy import (
    REASON_BLOCKED_ABSOLUTE_PATH,
    REASON_BLOCKED_PATH_TRAVERSAL,
    REASON_BLOCKED_SYMLINK,
    REASON_FILE_SIZE_EXCEEDED,
    ExclusionPolicy,
    evaluate_entry,
    load_exclusion_policy,
)
from src.embedding import (
    EmbeddingError,
    build_embeddings,
    count_token_limit_exceeded,
    resolve_embedding_config,
    write_embeddings,
)
from src.inventory import build_inventory, inventory_by_path, write_inventory
from src.markdown_writer import write_markdown_review
from src.normalizer import normalize_documents, write_normalized_documents
from src.parsers import html_api, html_sample, license_inspector, pdf_docling
from src.report import build_validation_report, write_validation_report
from src.zip_paths import decode_zip_filename

DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MiB per file
DEFAULT_MAX_TOTAL_BYTES = 500 * 1024 * 1024  # 500 MiB total


def load_options_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("options JSON must be an object")
    return data


def merge_config(args: argparse.Namespace) -> dict[str, Any]:
    cfg: dict[str, Any] = {
        "archivePath": None,
        "packName": "untitled-pack",
        "productVersion": "",
        "language": "ko",
        "output": None,
        "options": {
            "parsePdf": True,
            "parseApiHtml": True,
            "parseSamples": True,
            "includeOriginalDownload": False,
            "maxFileBytes": DEFAULT_MAX_FILE_BYTES,
            "maxTotalBytes": DEFAULT_MAX_TOTAL_BYTES,
        },
    }
    if args.options_json:
        file_cfg = load_options_json(Path(args.options_json))
        for key in ("archivePath", "packName", "productVersion", "language"):
            if key in file_cfg and file_cfg[key] is not None:
                cfg[key] = file_cfg[key]
        if "output" in file_cfg and file_cfg["output"]:
            cfg["output"] = file_cfg["output"]
        if isinstance(file_cfg.get("options"), dict):
            cfg["options"].update(file_cfg["options"])

    if args.input:
        cfg["archivePath"] = args.input
    if args.output:
        cfg["output"] = args.output
    if args.pack_name:
        cfg["packName"] = args.pack_name
    if args.product_version:
        cfg["productVersion"] = args.product_version
    if args.language:
        cfg["language"] = args.language
    if args.max_file_bytes is not None:
        cfg["options"]["maxFileBytes"] = args.max_file_bytes
    if args.max_total_bytes is not None:
        cfg["options"]["maxTotalBytes"] = args.max_total_bytes
    return cfg


def is_safe_zip_member(member_name: str, dest_root: Path) -> tuple[bool, str | None]:
    """Reject absolute paths, drive letters, and Zip Slip (../) traversals.

    Reasons are fixed, testable enum strings from ``exclusion_policy`` so the
    validation report can group security blocks the same way as business
    exclusions. These guards are hardcoded and cannot be relaxed by config.
    """
    name = member_name.replace("\\", "/")
    if not name or name.endswith("/"):
        return True, None  # directories handled separately
    if name.startswith("/") or name.startswith("\\"):
        return False, REASON_BLOCKED_ABSOLUTE_PATH
    # Windows drive / UNC
    if len(name) >= 2 and name[1] == ":":
        return False, REASON_BLOCKED_ABSOLUTE_PATH
    if name.startswith("//") or name.startswith("\\\\"):
        return False, REASON_BLOCKED_ABSOLUTE_PATH
    parts = name.split("/")
    if any(p == ".." for p in parts):
        return False, REASON_BLOCKED_PATH_TRAVERSAL
    target = (dest_root / Path(*parts)).resolve()
    try:
        target.relative_to(dest_root.resolve())
    except ValueError:
        return False, REASON_BLOCKED_PATH_TRAVERSAL
    return True, None


def _is_symlink_entry(info: zipfile.ZipInfo) -> bool:
    """Detect symlink members via the stored unix mode bits (external_attr)."""
    mode = info.external_attr >> 16
    return bool(mode) and stat.S_ISLNK(mode)


def safe_extract_zip(
    archive_path: Path,
    dest_root: Path,
    *,
    max_file_bytes: int,
    max_total_bytes: int,
    policy: ExclusionPolicy | None = None,
    admin_exclude_paths: list[str] | None = None,
) -> dict[str, Any]:
    """
    Safely extract a ZIP into dest_root with Korean filename recovery.

    Applies, per entry, in order: hardcoded security guards → Admin 사전정리
    path exclusions → default exclusion policy (directory / file name /
    extension / size) → extract. The original archive is never modified; only
    what is extracted is limited.

    Returns extraction stats including excluded/failed entries, structured
    ``excludedFiles`` (path/reason/detail), and path_meta keyed by recovered
    sourcePath for inventory encoding fields.
    """
    dest_root.mkdir(parents=True, exist_ok=True)
    active_policy = policy if policy is not None else load_exclusion_policy()
    admin_paths = [p for p in (admin_exclude_paths or []) if isinstance(p, str) and p.strip()]
    result: dict[str, Any] = {
        "ok": False,
        "extracted": [],
        "excluded": [],
        "excludedFiles": [],
        "failed": [],
        "warnings": [],
        "pathMeta": {},
        "totalBytes": 0,
        "error": None,
    }

    def record_exclusion(
        source_path: str,
        raw_source_path: str,
        reason: str,
        detail: str | None,
        *,
        extra: dict[str, Any] | None = None,
    ) -> None:
        entry: dict[str, Any] = {
            "sourcePath": source_path,
            "rawSourcePath": raw_source_path,
            "reason": reason,
            "detail": detail,
        }
        if extra:
            entry.update(extra)
        result["excluded"].append(entry)
        result["excludedFiles"].append(
            {"path": source_path, "reason": reason, "detail": detail}
        )

    if not archive_path.is_file():
        result["error"] = f"archive not found: {archive_path}"
        return result

    try:
        zf = zipfile.ZipFile(archive_path, "r")
    except zipfile.BadZipFile as exc:
        result["error"] = f"invalid zip: {exc}"
        return result

    total = 0
    with zf:
        for info in zf.infolist():
            decoded = decode_zip_filename(info)
            name = decoded.source_path
            raw_name = decoded.raw_source_path

            if decoded.warning:
                result["warnings"].append(decoded.warning)

            # 1. Security guards (hardcoded) — apply to both recovered and raw paths.
            for candidate, label in ((name, "decoded"), (raw_name, "raw")):
                safe, reason = is_safe_zip_member(candidate, dest_root)
                if not safe:
                    record_exclusion(
                        name,
                        raw_name,
                        reason or REASON_BLOCKED_PATH_TRAVERSAL,
                        label,
                        extra={
                            "pathEncoding": decoded.path_encoding,
                            "pathDecoded": decoded.path_decoded,
                        },
                    )
                    break
            else:
                # both paths safe
                if info.is_dir() or name.endswith("/"):
                    parts = [p for p in name.replace("\\", "/").split("/") if p]
                    if parts:
                        dir_path = dest_root.joinpath(*parts)
                        dir_path.mkdir(parents=True, exist_ok=True)
                    continue

                # 1b. Symlink guard (hardcoded security) — never extracted.
                if _is_symlink_entry(info):
                    record_exclusion(name, raw_name, REASON_BLOCKED_SYMLINK, None)
                    continue

                # 2-5. Admin 사전정리 paths + default exclusion policy
                # (directory → file name → extension → size).
                policy_reason, policy_detail = evaluate_entry(
                    active_policy,
                    name,
                    info.file_size,
                    admin_exclude_paths=admin_paths,
                )
                if policy_reason is not None:
                    record_exclusion(name, raw_name, policy_reason, policy_detail)
                    continue

                # 5. Hardcoded per-file ceiling (security). Kept independent of
                # the (relaxable) policy size so it can never be turned off.
                if info.file_size > max_file_bytes:
                    record_exclusion(
                        name,
                        raw_name,
                        REASON_FILE_SIZE_EXCEEDED,
                        str(info.file_size),
                    )
                    continue
                if total + info.file_size > max_total_bytes:
                    result["excluded"].append(
                        {
                            "sourcePath": name,
                            "rawSourcePath": raw_name,
                            "reason": "extract aborted: maxTotalBytes exceeded",
                        }
                    )
                    result["failed"].append(
                        {
                            "sourcePath": name,
                            "rawSourcePath": raw_name,
                            "reason": "maxTotalBytes exceeded",
                        }
                    )
                    result["error"] = "maxTotalBytes exceeded during extraction"
                    return result

                parts = [p for p in name.replace("\\", "/").split("/") if p]
                target = dest_root.joinpath(*parts)
                try:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(info, "r") as src, target.open("wb") as dst:
                        remaining = info.file_size
                        while remaining > 0:
                            chunk = src.read(min(1024 * 1024, remaining))
                            if not chunk:
                                break
                            dst.write(chunk)
                            remaining -= len(chunk)
                    written = target.stat().st_size
                    total += written
                    meta = {
                        "rawSourcePath": raw_name,
                        "pathEncoding": decoded.path_encoding,
                        "pathDecoded": decoded.path_decoded,
                    }
                    result["pathMeta"][name] = meta
                    result["extracted"].append(
                        {
                            "sourcePath": name,
                            "rawSourcePath": raw_name,
                            "pathEncoding": decoded.path_encoding,
                            "pathDecoded": decoded.path_decoded,
                            "size": written,
                        }
                    )
                except Exception as exc:  # noqa: BLE001
                    result["failed"].append(
                        {
                            "sourcePath": name,
                            "rawSourcePath": raw_name,
                            "reason": str(exc),
                        }
                    )
                continue

            # for-else break path (unsafe) — already recorded
            continue

    result["totalBytes"] = total
    # Empty but valid zip is ok=True with 0 files
    if result["error"] is None:
        result["ok"] = True
    return result


def run_pipeline(cfg: dict[str, Any]) -> int:
    warnings: list[str] = []
    errors: list[str] = []
    archive_path = Path(cfg["archivePath"]) if cfg.get("archivePath") else None
    output_dir = Path(cfg["output"] or "./output/run")
    output_dir.mkdir(parents=True, exist_ok=True)

    opts = cfg.get("options") or {}
    max_file = int(opts.get("maxFileBytes", DEFAULT_MAX_FILE_BYTES))
    max_total = int(opts.get("maxTotalBytes", DEFAULT_MAX_TOTAL_BYTES))
    # P7.4: default exclusion policy (config file, merged over built-in defaults).
    exclusion_policy = load_exclusion_policy(opts.get("exclusionPolicyPath"))
    raw_admin_paths = opts.get("adminExcludePaths")
    admin_exclude_paths: list[str] = []
    if isinstance(raw_admin_paths, list):
        admin_exclude_paths = [
            str(p).replace("\\", "/").strip("/")
            for p in raw_admin_paths
            if isinstance(p, (str, int, float)) and str(p).strip()
        ]
    excluded_files: list[dict[str, Any]] = []

    extract_root = output_dir / "_extracted"
    artifacts_root = output_dir / "parser_artifacts"

    # Clear prior extract/artifacts so stale mojibake paths cannot pollute inventory
    if extract_root.exists():
        shutil.rmtree(extract_root, ignore_errors=True)
    if artifacts_root.exists():
        shutil.rmtree(artifacts_root, ignore_errors=True)

    inventory: list[dict[str, Any]] = []
    api_artifacts: list[dict[str, Any]] = []
    sample_artifacts: list[dict[str, Any]] = []
    pdf_artifacts: list[dict[str, Any]] = []
    parser_results: dict[str, list[dict[str, Any]]] = {
        "html_api": [],
        "html_sample": [],
        "docling_pdf": [],
        "license_inspector": [],
    }
    license_signals: dict[str, Any] = {
        "licenseDetected": False,
        "licenseKeyDetected": False,
        "licenseFiles": [],
    }
    status = "ok"

    if not archive_path:
        errors.append("archivePath / --input is required")
        status = "failed"
        report = build_validation_report(
            inventory=[],
            parser_results=parser_results,
            license_signals=license_signals,
            warnings=warnings,
            errors=errors,
            chunks_count=0,
            documents_count=0,
            status=status,
            excluded_files=excluded_files,
        )
        write_validation_report(report, output_dir / "validation_report.json")
        write_inventory([], output_dir / "inventory.json")
        write_normalized_documents([], output_dir / "normalized_documents.json")
        write_chunks([], output_dir / "chunks.json")
        write_embeddings([], output_dir / "embeddings.json")
        write_traces([], output_dir / "source_trace.json")
        return 1

    extraction = safe_extract_zip(
        archive_path,
        extract_root,
        max_file_bytes=max_file,
        max_total_bytes=max_total,
        policy=exclusion_policy,
        admin_exclude_paths=admin_exclude_paths,
    )
    excluded_files = extraction.get("excludedFiles") or []
    for item in extraction.get("excluded") or []:
        warnings.append(
            f"excluded zip entry: {item.get('sourcePath')} ({item.get('reason')})"
        )
    for item in extraction.get("failed") or []:
        errors.append(
            f"failed zip entry: {item.get('sourcePath')} ({item.get('reason')})"
        )
    for w in extraction.get("warnings") or []:
        warnings.append(w)

    if not extraction.get("ok") or extraction.get("error"):
        errors.append(extraction.get("error") or "zip extraction failed")
        status = "failed"
        report = build_validation_report(
            inventory=[],
            parser_results=parser_results,
            license_signals=license_signals,
            warnings=warnings,
            errors=errors,
            chunks_count=0,
            documents_count=0,
            status=status,
            excluded_files=excluded_files,
        )
        write_validation_report(report, output_dir / "validation_report.json")
        write_inventory([], output_dir / "inventory.json")
        write_normalized_documents([], output_dir / "normalized_documents.json")
        write_chunks([], output_dir / "chunks.json")
        write_embeddings([], output_dir / "embeddings.json")
        write_traces([], output_dir / "source_trace.json")
        write_markdown_review(
            path=output_dir / "normalized_documents.md",
            pack_name=cfg["packName"],
            product_version=cfg.get("productVersion") or "",
            language=cfg.get("language") or "ko",
            inventory=[],
            documents=[],
            chunks=[],
            report=report,
        )
        return 1

    inventory = build_inventory(extract_root, extraction.get("pathMeta") or {})
    write_inventory(inventory, output_dir / "inventory.json")
    by_path = inventory_by_path(inventory)

    license_signals = license_inspector.detect_license_signals(inventory, extract_root)
    license_inspector.write_license_artifacts(
        license_signals, artifacts_root / "license"
    )
    if license_signals.get("licenseKeyDetected"):
        warnings.append("LicenseKey folder detected; contents excluded from knowledge")
    if license_signals.get("licenseDetected"):
        warnings.append("License/copyright review files detected")
    parser_results["license_inspector"] = [
        {"sourcePath": f.get("sourcePath"), "status": "ok"}
        for f in license_signals.get("licenseFiles") or []
    ]

    knowledge = [e for e in inventory if e.get("classification") == "knowledge_target"]

    api_index = 0
    sample_index = 0
    pdf_index = 0

    for entry in knowledge:
        source_path = entry["sourcePath"]
        abs_path = extract_root / source_path
        parser = entry.get("parser")
        if not abs_path.is_file():
            errors.append(f"missing extracted file: {source_path}")
            continue

        try:
            if parser == "html_api" and opts.get("parseApiHtml", True):
                api_index += 1
                art = html_api.parse_and_save(
                    abs_path,
                    source_path,
                    artifacts_root / "api_html",
                    index=api_index,
                )
                art["status"] = "ok"
                api_artifacts.append(art)
                parser_results["html_api"].append(art)
            elif parser == "html_sample" and opts.get("parseSamples", True):
                sample_index += 1
                art = html_sample.parse_and_save(
                    abs_path,
                    source_path,
                    artifacts_root / "samples",
                    index=sample_index,
                )
                art["status"] = "ok"
                sample_artifacts.append(art)
                parser_results["html_sample"].append(art)
            elif parser == "docling_pdf" and opts.get("parsePdf", True):
                pdf_index += 1
                art = pdf_docling.parse_and_save(
                    abs_path,
                    source_path,
                    artifacts_root / "pdf",
                    index=pdf_index,
                )
                pdf_artifacts.append(art)
                parser_results["docling_pdf"].append(art)
                if art.get("status") == "skipped":
                    warnings.append(
                        f"PDF skipped: {source_path} ({art.get('skipReason')})"
                    )
                elif art.get("status") == "failed":
                    errors.append(
                        f"PDF failed: {source_path} ({art.get('skipReason')})"
                    )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"parser error [{parser}] {source_path}: {exc}")
            if parser:
                parser_results.setdefault(parser, []).append(
                    {
                        "sourcePath": source_path,
                        "status": "failed",
                        "error": str(exc),
                    }
                )

    documents = normalize_documents(
        pack_name=cfg["packName"],
        product_version=cfg.get("productVersion") or "",
        language=cfg.get("language") or "ko",
        api_artifacts=api_artifacts,
        sample_artifacts=sample_artifacts,
        pdf_artifacts=pdf_artifacts,
        license_files=license_signals.get("licenseFiles") or [],
    )
    write_normalized_documents(documents, output_dir / "normalized_documents.json")

    chunks, traces = build_chunks_and_traces(documents, by_path)
    write_chunks(chunks, output_dir / "chunks.json")
    write_traces(traces, output_dir / "source_trace.json")

    # Always emit embeddings.json to satisfy the required output contract, even
    # if generation fails. The Worker never writes DB / Object Storage.
    embedding_failed = False
    embeddings: list[dict[str, Any]] = []
    embedding_cfg: dict[str, Any] | None = None
    try:
        embedding_cfg = resolve_embedding_config(opts.get("embedding") or {}, os.environ)
        embeddings = build_embeddings(chunks, embedding_cfg)
    except EmbeddingError as exc:
        embedding_failed = True
        errors.append(f"embedding generation failed: {exc}")
    write_embeddings(embeddings, output_dir / "embeddings.json")

    # Self-check chunks <-> embeddings parity so the cause is visible in-report.
    if chunks and len(embeddings) != len(chunks):
        if not embedding_failed:
            errors.append(
                f"embedding count mismatch: {len(embeddings)} embeddings "
                f"for {len(chunks)} chunks"
            )
        embedding_failed = True

    token_limit_exceeded = count_token_limit_exceeded(chunks)
    if not chunks:
        embedding_status = "skipped"
    elif embedding_failed:
        embedding_status = "failed"
    else:
        embedding_status = "ok"
    embedding_dimension = (
        embeddings[0]["dimension"]
        if embeddings
        else (embedding_cfg.get("dimension") if embedding_cfg else None)
    )
    embedding_summary = {
        "mode": embedding_cfg.get("mode") if embedding_cfg else None,
        "provider": embedding_cfg.get("provider") if embedding_cfg else None,
        "model": embedding_cfg.get("model") if embedding_cfg else None,
        "dimension": embedding_dimension,
        "status": embedding_status,
        "embeddedChunks": len(embeddings),
        "missingEmbeddings": max(len(chunks) - len(embeddings), 0),
        "tokenLimitExceeded": token_limit_exceeded,
    }

    if not knowledge:
        if not inventory and excluded_files:
            # Every archive entry was removed by the default exclusion policy or
            # a security guard — nothing left to structure. Make this explicit so
            # the Admin sees a clear "보완 필요" cause rather than an empty result.
            errors.append(
                "all archive files were excluded by the default exclusion policy "
                f"(excluded {len(excluded_files)} entries); nothing to structure"
            )
        else:
            errors.append("no knowledge_target files found in archive")
        status = "failed"
    elif not documents and not chunks:
        errors.append("no structured documents produced")
        status = "failed"
    elif errors and (api_artifacts or sample_artifacts or any(
        p.get("status") == "ok" for p in pdf_artifacts
    )):
        status = "partial"
    elif errors:
        status = "failed"

    # Missing embeddings for produced chunks is a hard failure for Store import.
    if embedding_failed:
        status = "failed"

    report = build_validation_report(
        inventory=inventory,
        parser_results=parser_results,
        license_signals=license_signals,
        warnings=warnings,
        errors=errors,
        chunks_count=len(chunks),
        documents_count=len(documents),
        status=status,
        embeddings_count=len(embeddings),
        embedding_summary=embedding_summary,
        excluded_files=excluded_files,
    )
    write_validation_report(report, output_dir / "validation_report.json")
    write_markdown_review(
        path=output_dir / "normalized_documents.md",
        pack_name=cfg["packName"],
        product_version=cfg.get("productVersion") or "",
        language=cfg.get("language") or "ko",
        inventory=inventory,
        documents=documents,
        chunks=chunks,
        report=report,
    )

    print(f"Status: {status}")
    print(f"Output: {output_dir.resolve()}")
    print(
        f"Files={len(inventory)} docs={len(documents)} chunks={len(chunks)} "
        f"embeddings={len(embeddings)} warnings={len(warnings)} errors={len(errors)}"
    )
    return 0 if status in {"ok", "partial"} else 1


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="JYKStore Python Worker — structure product document ZIP packages"
    )
    p.add_argument("--input", "-i", help="Path to input ZIP archive")
    p.add_argument("--output", "-o", help="Output directory for artifacts")
    p.add_argument("--pack-name", help="Knowledge pack / product display name")
    p.add_argument("--product-version", help="Product version string (e.g. v6.0)")
    p.add_argument("--language", default=None, help="Language code (default: ko)")
    p.add_argument(
        "--options-json",
        help="Optional JSON config (archivePath, packName, options, ...)",
    )
    p.add_argument("--max-file-bytes", type=int, default=None)
    p.add_argument("--max-total-bytes", type=int, default=None)
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    try:
        cfg = merge_config(args)
    except Exception as exc:  # noqa: BLE001
        print(f"Config error: {exc}", file=sys.stderr)
        return 2
    return run_pipeline(cfg)


if __name__ == "__main__":
    raise SystemExit(main())

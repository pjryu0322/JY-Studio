"""Normalize parser artifacts into Store-compatible documents."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def _slug(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w]+", "-", text, flags=re.UNICODE)
    return text.strip("-")[:80] or "doc"


def _stem(source_path: str) -> str:
    return Path(source_path).stem


def _document_id(pack_slug: str, source_type: str, source_path: str) -> str:
    return f"{pack_slug}-{source_type.replace('_', '-')}-{_slug(_stem(source_path))}"


def _from_api(artifact: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any]:
    source_path = artifact["sourcePath"]
    return {
        "documentId": _document_id(ctx["pack_slug"], "docs-api", source_path),
        "sourcePath": source_path,
        "sourceType": "api_html",
        "title": artifact.get("title") or artifact.get("apiName") or _stem(source_path),
        "language": ctx["language"],
        "productVersion": ctx["product_version"],
        "sections": artifact.get("sections") or [],
        "entities": artifact.get("entities") or [],
        "codeBlocks": artifact.get("codeBlocks") or [],
        "metadata": {
            "parser": artifact.get("parser", "html_api"),
            "parserVersion": artifact.get("parserVersion", "0.1.0"),
            "symbols": artifact.get("symbols") or [],
            "keywords": artifact.get("keywords") or [],
            "apiName": artifact.get("apiName"),
        },
    }


def _from_sample(artifact: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any]:
    source_path = artifact["sourcePath"]
    return {
        "documentId": _document_id(ctx["pack_slug"], "sample", source_path),
        "sourcePath": source_path,
        "sourceType": "sample_html",
        "title": artifact.get("title") or artifact.get("sampleName") or _stem(source_path),
        "language": ctx["language"],
        "productVersion": ctx["product_version"],
        "sections": artifact.get("sections") or [],
        "entities": [
            {"type": "sample", "name": artifact.get("sampleName") or _stem(source_path)}
        ],
        "codeBlocks": artifact.get("codeBlocks") or [],
        "metadata": {
            "parser": artifact.get("parser", "html_sample"),
            "parserVersion": artifact.get("parserVersion", "0.1.0"),
            "symbols": artifact.get("symbols") or [],
            "keywords": artifact.get("keywords") or [],
            "relatedFiles": artifact.get("relatedFiles") or [],
            "referencedApiCandidates": artifact.get("referencedApiCandidates") or [],
            "description": artifact.get("description") or "",
        },
    }


def _from_pdf(artifact: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any] | None:
    if artifact.get("status") in {"skipped", "failed"} and not artifact.get("sections"):
        return None
    source_path = artifact["sourcePath"]
    return {
        "documentId": _document_id(ctx["pack_slug"], "pdf", source_path),
        "sourcePath": source_path,
        "sourceType": "pdf_manual",
        "title": artifact.get("title") or _stem(source_path),
        "language": ctx["language"],
        "productVersion": ctx["product_version"],
        "sections": artifact.get("sections") or [],
        "entities": [{"type": "manual", "name": artifact.get("title") or _stem(source_path)}],
        "codeBlocks": artifact.get("codeBlocks") or [],
        "metadata": {
            "parser": artifact.get("parser", "docling_pdf"),
            "parserVersion": artifact.get("parserVersion", "0.1.0"),
            "status": artifact.get("status", "ok"),
            "skipReason": artifact.get("skipReason"),
        },
    }


def _from_license(entry: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any]:
    source_path = entry["sourcePath"]
    return {
        "documentId": _document_id(ctx["pack_slug"], "license", source_path),
        "sourcePath": source_path,
        "sourceType": "license_review",
        "title": _stem(source_path),
        "language": ctx["language"],
        "productVersion": ctx["product_version"],
        "sections": [
            {
                "heading": "License Preview",
                "content": entry.get("preview") or "",
                "tables": [],
                "codeBlocks": [],
            }
        ],
        "entities": [{"type": "license", "name": _stem(source_path)}],
        "codeBlocks": [],
        "metadata": {
            "parser": "license_inspector",
            "parserVersion": "0.1.0",
            "reviewOnly": True,
        },
    }


def normalize_documents(
    *,
    pack_name: str,
    product_version: str,
    language: str,
    api_artifacts: list[dict[str, Any]],
    sample_artifacts: list[dict[str, Any]],
    pdf_artifacts: list[dict[str, Any]],
    license_files: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    pack_slug = _slug(pack_name) or "pack"
    if product_version:
        pack_slug = f"{pack_slug}-{_slug(product_version)}"
    ctx = {
        "pack_slug": pack_slug,
        "language": language,
        "product_version": product_version,
    }

    docs: list[dict[str, Any]] = []
    for art in api_artifacts:
        docs.append(_from_api(art, ctx))
    for art in sample_artifacts:
        docs.append(_from_sample(art, ctx))
    for art in pdf_artifacts:
        doc = _from_pdf(art, ctx)
        if doc:
            docs.append(doc)
    for lic in license_files or []:
        docs.append(_from_license(lic, ctx))
    return docs


def write_normalized_documents(docs: list[dict[str, Any]], path: Path | str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(docs, ensure_ascii=False, indent=2), encoding="utf-8")

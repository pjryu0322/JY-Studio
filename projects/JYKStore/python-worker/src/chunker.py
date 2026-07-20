"""Chunk normalized documents and build source traces."""

from __future__ import annotations

import json
import re
from typing import Any


def _slug(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w]+", "-", text, flags=re.UNICODE)
    return text.strip("-")[:60] or "chunk"


def _is_low_value_section(
    *,
    heading: str,
    body: str,
    code_blocks: list[dict[str, Any]],
    title: str,
    source_type: str | None = None,
) -> bool:
    """Drop chrome-only / empty sections that hurt retrieval quality."""
    h = (heading or "").strip()
    b = (body or "").strip()
    if code_blocks or "```" in b:
        return False
    if re.match(
        r"^(rMate(Grid)?H5(\s*[\d.]*)?|rMate\s*HTML5\s*Grid)(\s*\(.*\))?$",
        h,
        re.I,
    ):
        return True
    # PDF: skip empty / title-only stubs and company cover lines
    if source_type == "pdf_manual":
        if len(b) < 40:
            return True
        if re.match(r"^㈜|^주식회사", h):
            return True
        if h == title and len(b) < 80:
            return True
    # Tiny empty stubs only
    if not b and len(h) < 3:
        return True
    return False


def build_chunks_and_traces(
    documents: list[dict[str, Any]],
    inventory_by_path: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    chunks: list[dict[str, Any]] = []
    traces: list[dict[str, Any]] = []

    for doc in documents:
        # Skip license_review from search chunks — review only
        if doc.get("sourceType") == "license_review":
            continue

        source_path = doc["sourcePath"]
        inv = inventory_by_path.get(source_path, {})
        source_hash = inv.get("sha256", "")
        meta = doc.get("metadata") or {}
        parser = meta.get("parser") or "unknown"
        parser_version = meta.get("parserVersion") or "0.1.0"
        symbols = list(meta.get("symbols") or [])
        keywords = list(meta.get("keywords") or [])
        for ent in doc.get("entities") or []:
            name = ent.get("name")
            if name and name not in symbols:
                symbols.append(name)

        # Prefer document-level API name in symbols/keywords
        api_name = meta.get("apiName")
        if api_name and api_name not in symbols:
            symbols.insert(0, api_name)

        sections = doc.get("sections") or []
        if not sections:
            sections = [
                {
                    "heading": doc.get("title") or source_path,
                    "content": "",
                    "codeBlocks": doc.get("codeBlocks") or [],
                }
            ]

        doc_code_attached = False
        section_no = 0
        for section in sections:
            heading = section.get("heading") or doc.get("title") or "section"
            title = doc.get("title") or heading
            body = section.get("content") or ""
            code_blocks = list(section.get("codeBlocks") or [])

            if _is_low_value_section(
                heading=heading,
                body=body,
                code_blocks=code_blocks,
                title=title,
                source_type=doc.get("sourceType"),
            ):
                continue

            content_parts: list[str] = []
            if title:
                content_parts.append(str(title))
            if heading and heading != title:
                content_parts.append(str(heading))
            if body:
                content_parts.append(body)
            for cb in code_blocks:
                code = cb.get("content") or ""
                if code:
                    content_parts.append(code)
            content = "\n\n".join(p for p in content_parts if p).strip()

            # Attach document-level code once for sample docs lacking section code
            if (
                not code_blocks
                and not doc_code_attached
                and doc.get("sourceType") == "sample_html"
                and doc.get("codeBlocks")
            ):
                code_blocks = list(doc["codeBlocks"])
                doc_code_attached = True
                for cb in code_blocks:
                    code = cb.get("content") or ""
                    if code and code not in content:
                        content = f"{content}\n\n{code}".strip()

            if not content and not code_blocks:
                continue

            section_no += 1
            base = _slug(f"{doc.get('documentId', '')}-{heading}")
            chunk_id = f"{base}-{section_no:03d}"
            if len(chunk_id) > 120:
                chunk_id = f"{_slug(doc.get('documentId', 'doc'))}-{section_no:03d}"
            trace_id = f"trace-{chunk_id}"

            chunk = {
                "chunkId": chunk_id,
                "title": title,
                "content": content[:20000],
                "sourceType": doc.get("sourceType"),
                "sourcePath": source_path,
                "section": heading,
                "symbols": symbols[:50],
                "keywords": keywords[:50],
                "codeBlocks": code_blocks,
                "traceId": trace_id,
            }
            trace = {
                "traceId": trace_id,
                "chunkId": chunk_id,
                "sourcePath": source_path,
                "sourceHash": source_hash,
                "section": heading,
                "parser": parser,
                "parserVersion": parser_version,
            }
            chunks.append(chunk)
            traces.append(trace)

    return chunks, traces


def write_chunks(chunks: list[dict[str, Any]], path) -> None:
    from pathlib import Path

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")


def write_traces(traces: list[dict[str, Any]], path) -> None:
    from pathlib import Path

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(traces, ensure_ascii=False, indent=2), encoding="utf-8")

"""Chunk normalized documents and build source traces."""

from __future__ import annotations

import json
import re
from typing import Any

from src.embedding import (
    E5_MAX_SEQUENCE_TOKENS,
    build_passage_text,
    estimate_embedding_token_count,
)
from src.section_merge import merge_heading_fragments

# The E5 passage input has a hard 512-token gate in build_embeddings (matching
# the Store policy). The chunker must never emit a chunk whose passage exceeds
# that limit, or the whole knowledge build fails at embedding time. We size to a
# preferred budget below the hard gate to leave headroom for token estimation
# rounding and the "passage: "/title/section/keywords overhead.
E5_TARGET_PASSAGE_TOKENS = 480
_CHARS_PER_TOKEN = 4
# Always keep enough content budget that a chunk carries meaningful text even
# when the fixed overhead (title/section/keywords) is large.
_MIN_CONTENT_TOKENS = 48


def _slug(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w]+", "-", text, flags=re.UNICODE)
    return text.strip("-")[:60] or "chunk"


def _dedupe_id(candidate: str, seen: set[str]) -> str:
    """Guarantee a globally-unique id (<=120 chars).

    chunkId is built from a 60-char-truncated ``documentId-heading`` slug plus a
    per-document ``section_no``. The truncation can drop the distinguishing tail
    of two different documents (e.g. ``excel_export_titlefooter*``), collapsing
    them to the same base; since ``section_no`` is only unique *within* a
    document, that yields cross-document duplicate ids (and a "duplicate
    embedding for chunkId" validation failure). Append an incrementing suffix on
    collision so every chunk/embedding id stays unique.
    """
    if candidate not in seen:
        seen.add(candidate)
        return candidate
    n = 2
    while True:
        suffix = f"-{n}"
        trimmed = candidate[: 120 - len(suffix)]
        deduped = f"{trimmed}{suffix}"
        if deduped not in seen:
            seen.add(deduped)
            return deduped
        n += 1


def _fit_keywords(title: str, heading: str, keywords: list[str]) -> list[str]:
    """Trim keywords so the passage overhead alone can't blow the token budget.

    Rare: only triggers when a section carries an unusually large keyword set.
    Content always keeps at least ``_MIN_CONTENT_TOKENS`` of budget.
    """
    kws = list(keywords)
    ceiling = E5_TARGET_PASSAGE_TOKENS - _MIN_CONTENT_TOKENS
    while kws:
        probe = {"title": title, "section": heading, "keywords": kws, "content": ""}
        if estimate_embedding_token_count(build_passage_text(probe)) <= ceiling:
            break
        kws.pop()
    return kws


def _content_char_budget(title: str, heading: str, keywords: list[str]) -> int:
    """Chars of ``content`` that keep the whole E5 passage within budget."""
    probe = {"title": title, "section": heading, "keywords": keywords, "content": ""}
    overhead = estimate_embedding_token_count(build_passage_text(probe))
    content_tokens = max(E5_TARGET_PASSAGE_TOKENS - overhead, _MIN_CONTENT_TOKENS)
    return content_tokens * _CHARS_PER_TOKEN


def _split_content(content: str, char_budget: int) -> list[str]:
    """Split ``content`` into parts each within ``char_budget`` characters.

    Prefers paragraph ("\\n\\n") then line boundaries; hard-splits only when a
    single paragraph is itself larger than the budget. Never returns empty parts.
    """
    content = content or ""
    if len(content) <= char_budget:
        return [content] if content.strip() else []

    parts: list[str] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            parts.append(current.strip())
        current = ""

    for para in content.split("\n\n"):
        # A single paragraph larger than the budget is hard-split on line/space.
        while len(para) > char_budget:
            head = para[:char_budget]
            cut = max(head.rfind("\n"), head.rfind(" "))
            if cut < char_budget // 2:
                cut = char_budget
            flush()
            piece = para[:cut].strip()
            if piece:
                parts.append(piece)
            para = para[cut:]

        candidate = f"{current}\n\n{para}".strip() if current else para
        if len(candidate) > char_budget and current:
            flush()
            current = para
        else:
            current = candidate

    flush()
    return [p for p in parts if p.strip()]


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
    # Track chunk ids across ALL documents so truncated-slug collisions between
    # different documents can't produce duplicate chunk/embedding ids.
    seen_chunk_ids: set[str] = set()

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
        # Safety net: fold short Returns/Type/Events fragments even if the
        # upstream parser did not (legacy artifacts / PDF-like structures).
        sections = merge_heading_fragments(list(sections))

        entity_key = (
            (meta.get("apiName") or "").strip()
            or (doc.get("title") or "").strip()
            or source_path
        )

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

            # Keep chunk passages within the E5 512-token gate: trim any oversized
            # keyword set, then split the section content into budget-fitting parts
            # so a single large section never fails the whole embedding build.
            chunk_keywords = _fit_keywords(title, heading, keywords[:50])
            char_budget = _content_char_budget(title, heading, chunk_keywords)
            content_parts = _split_content(content[:20000], char_budget) or [""]
            merged_headings = list(section.get("mergedHeadings") or [])
            merge_reason = section.get("mergeReason")
            section_path = [title, heading] if heading and heading != title else [title or heading]

            for part_index, part_content in enumerate(content_parts):
                section_no += 1
                base = _slug(f"{doc.get('documentId', '')}-{heading}")
                chunk_id = f"{base}-{section_no:03d}"
                if len(chunk_id) > 120:
                    chunk_id = f"{_slug(doc.get('documentId', 'doc'))}-{section_no:03d}"
                chunk_id = _dedupe_id(chunk_id, seen_chunk_ids)
                trace_id = f"trace-{chunk_id}"

                chunk = {
                    "chunkId": chunk_id,
                    "title": title,
                    "content": part_content,
                    "sourceType": doc.get("sourceType"),
                    "sourcePath": source_path,
                    "section": heading,
                    "sectionPath": section_path,
                    "entityKey": entity_key,
                    "mergedHeadings": merged_headings,
                    "mergeReason": merge_reason,
                    "symbols": symbols[:50],
                    "keywords": chunk_keywords,
                    # Code block metadata rides on the first part only to avoid
                    # duplicating it across a split section's chunks.
                    "codeBlocks": code_blocks if part_index == 0 else [],
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

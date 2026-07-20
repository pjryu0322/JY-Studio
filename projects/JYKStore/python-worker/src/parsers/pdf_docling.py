"""PDF parser using Docling when available; graceful skip otherwise."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from ..zip_paths import artifact_output_path

PARSER_NAME = "docling_pdf"
PARSER_VERSION = "0.1.1"

# Sentence-like or fragment headings produced by OCR/layout noise
_FALSE_HEADING_RE = re.compile(
    r"("
    r"습니다\.?\s*$|"
    r"됩니다\.?\s*$|"
    r"같습니다\.?\s*$|"
    r"입니다\.?\s*$|"
    r"다음과 같습니다|"
    r"아래와 같습니다|"
    r"^면\s|"
    r"^위\s+파일|"
    r"^다음은\s|"
    r"^읽어들이"
    r")"
)

# Prefer real outline headings: 1. / 1.1. / 가. / 나. / Chapter-like
_REAL_HEADING_RE = re.compile(
    r"^("
    r"\d+(\.\d+)*\.?\s+\S|"  # 1. 개요 / 1.1. 특징
    r"[가나다라마바사아자차카타파하]\s*\.\s+\S|"  # 가. rMateGridH5
    r"제\s*\d+\s*장|"
    r"목\s*차|"
    r"Version\s*\d|"
    r"rMate\s*Grid|"
    r"Appendix|부록"
    r")",
    re.I,
)


def is_docling_available() -> bool:
    try:
        import docling  # noqa: F401

        return True
    except ImportError:
        return False


def _fallback_empty_result(source_path: str, reason: str) -> dict[str, Any]:
    return {
        "parser": PARSER_NAME,
        "parserVersion": PARSER_VERSION,
        "sourcePath": source_path,
        "title": Path(source_path).stem,
        "sections": [],
        "tables": [],
        "codeBlocks": [],
        "bodyText": "",
        "status": "skipped",
        "skipReason": reason,
    }


def _strip_noise(text: str) -> str:
    text = text.replace("<!-- image -->", " ")
    text = re.sub(r"<!--.*?-->", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _is_false_heading(heading: str) -> bool:
    h = heading.strip()
    if not h:
        return True
    if len(h) > 80:
        return True
    if h.endswith(".") and not _REAL_HEADING_RE.match(h):
        return True
    if _FALSE_HEADING_RE.search(h) and not _REAL_HEADING_RE.match(h):
        return True
    # Bare numbers like "12." / "13."
    if re.match(r"^\d+\.\s*$", h):
        return True
    # Bullet fragments treated as headings
    if h.startswith("⚫") or h.startswith("•"):
        return True
    # Truncated XML/code fragments
    if h.startswith("&lt;") or h.startswith("<"):
        return True
    return False


def _heading_level(line: str) -> int | None:
    m = re.match(r"^(#{1,6})\s+(.*)$", line)
    if not m:
        return None
    return len(m.group(1))


def _extract_section_tables(content: str) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    rows: list[str] = []
    for line in content.splitlines():
        if "|" in line and re.search(r"\|.+\|", line):
            rows.append(line.strip())
        elif rows:
            tables.append({"markdownRows": rows[:80]})
            rows = []
    if rows:
        tables.append({"markdownRows": rows[:80]})
    return tables


def _extract_code_blocks_from_text(content: str) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for match in re.finditer(r"```(\w+)?\n(.*?)```", content, flags=re.S):
        blocks.append(
            {
                "language": match.group(1),
                "content": match.group(2).strip(),
            }
        )
    return blocks


def _sections_from_markdown(markdown: str, default_title: str) -> tuple[str, list[dict[str, Any]]]:
    """
    Split Docling markdown into sections.

    - Prefer real outline headings
    - Fold false/noisy headings into previous section body
    - Drop empty sections
    """
    title = default_title
    sections: list[dict[str, Any]] = []
    current_heading = default_title
    current_lines: list[str] = []
    saw_real_title = False

    def flush() -> None:
        nonlocal current_lines, current_heading
        raw = "\n".join(current_lines).strip()
        content = _strip_noise(raw)
        codes = _extract_code_blocks_from_text(raw)
        tables = _extract_section_tables(raw)
        if not content and not codes:
            current_lines = []
            return
        sections.append(
            {
                "heading": current_heading,
                "content": content,
                "tables": tables,
                "codeBlocks": codes,
            }
        )
        current_lines = []

    for line in markdown.splitlines():
        level = _heading_level(line)
        if level is None:
            current_lines.append(line)
            continue

        heading_text = line.lstrip("#").strip()
        if not heading_text:
            continue

        # First strong title candidate
        if not saw_real_title and (
            "사용 설명서" in heading_text
            or "사용설명서" in heading_text
            or (level <= 2 and "rMate" in heading_text)
        ):
            title = heading_text
            saw_real_title = True

        if _is_false_heading(heading_text):
            # Keep as body text under previous heading
            current_lines.append(heading_text)
            continue

        flush()
        current_heading = heading_text

    flush()

    # Drop leading empty-title-only duplicate if next section has better name
    if (
        len(sections) >= 2
        and sections[0]["heading"] == default_title
        and len(sections[0].get("content") or "") < 20
    ):
        sections = sections[1:]

    return title, sections


def _parse_with_docling(file_path: Path, source_path: str) -> dict[str, Any]:
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    result = converter.convert(str(file_path))
    doc = result.document

    default_title = Path(source_path).stem
    if hasattr(doc, "name") and doc.name:
        default_title = str(doc.name)

    markdown = ""
    try:
        markdown = doc.export_to_markdown()
    except Exception:
        try:
            markdown = str(doc)
        except Exception:
            markdown = ""

    title, sections = _sections_from_markdown(markdown, default_title)

    code_blocks: list[dict[str, Any]] = []
    for section in sections:
        code_blocks.extend(section.get("codeBlocks") or [])

    tables: list[dict[str, Any]] = []
    try:
        for table in getattr(doc, "tables", []) or []:
            tables.append({"raw": str(table)[:5000]})
    except Exception:
        pass
    if not tables:
        for section in sections:
            tables.extend(section.get("tables") or [])

    if not sections and markdown:
        sections.append(
            {
                "heading": title,
                "content": _strip_noise(markdown)[:50000],
                "tables": tables,
                "codeBlocks": code_blocks,
            }
        )

    return {
        "parser": PARSER_NAME,
        "parserVersion": PARSER_VERSION,
        "sourcePath": source_path,
        "title": title,
        "sections": sections,
        "tables": tables,
        "codeBlocks": code_blocks,
        "bodyText": _strip_noise(markdown)[:100000],
        "status": "ok",
        "skipReason": None,
    }


def parse_pdf(file_path: Path, source_path: str) -> dict[str, Any]:
    if not is_docling_available():
        return _fallback_empty_result(
            source_path, "docling not installed; PDF parsing skipped"
        )
    try:
        return _parse_with_docling(file_path, source_path)
    except Exception as exc:  # noqa: BLE001 — record and continue
        result = _fallback_empty_result(source_path, f"docling parse failed: {exc}")
        result["status"] = "failed"
        return result


def parse_and_save(
    file_path: Path,
    source_path: str,
    artifacts_dir: Path,
    *,
    index: int = 1,
) -> dict[str, Any]:
    result = parse_pdf(file_path, source_path)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out = artifact_output_path(
        artifacts_dir, kind="pdf", index=index, source_path=source_path
    )
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["_artifactPath"] = str(out)
    return result

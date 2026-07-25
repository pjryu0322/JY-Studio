"""Merge short API heading fragments into parent sections (entity grouping)."""

from __future__ import annotations

import re
from typing import Any

_FRAGMENT_ALWAYS_RE = re.compile(
    r"^(returns?:?|type|types|parameters?|arguments?|args|see\s*also|"
    r"remarks?|notes?|inherits?(?:\s+from)?|constructor|signature|"
    r"overview|description|default|read-?only|value|syntax|throws?|"
    r"exceptions?|반환(?:\s*값)?|타입|매개변수|인수|비고|설명|기본값)$",
    re.I,
)

_FRAGMENT_SOFT_RE = re.compile(
    r"^(events?|properties|methods|members|styles|examples?|"
    r"속성|메서드|이벤트|멤버|스타일|예제)$",
    re.I,
)

_FRAGMENT_MERGE_ALWAYS_MAX = 160
_FRAGMENT_MERGE_SOFT_MAX = 80


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def fragment_heading_tail(heading: str) -> str:
    h = _clean_text(heading)
    if " > " in h:
        return h.rsplit(" > ", 1)[-1].strip()
    return h


def is_fragment_heading_name(heading: str) -> bool:
    """True when the heading label itself is member/metadata chrome."""
    tail = fragment_heading_tail(heading)
    if not tail:
        return False
    return bool(_FRAGMENT_ALWAYS_RE.match(tail) or _FRAGMENT_SOFT_RE.match(tail))


def is_heading_fragment(
    heading: str,
    content: str,
    code_blocks: list | None = None,
    *,
    tables: list | None = None,
) -> bool:
    """True when the section is metadata/member chrome, not an independent unit."""
    codes = code_blocks or []
    if codes:
        return False
    if tables:
        return False
    tail = fragment_heading_tail(heading)
    if not tail:
        return False
    body = _clean_text(content)
    if _FRAGMENT_ALWAYS_RE.match(tail):
        return len(body) < _FRAGMENT_MERGE_ALWAYS_MAX
    if _FRAGMENT_SOFT_RE.match(tail):
        return len(body) < _FRAGMENT_MERGE_SOFT_MAX
    return False


def merge_heading_fragments(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fold short Returns/Type/Events/... pieces into the preceding parent section."""
    if not sections:
        return sections
    merged: list[dict[str, Any]] = []
    for section in sections:
        heading = section.get("heading") or ""
        content = section.get("content") or ""
        code_blocks = list(section.get("codeBlocks") or [])
        tables = list(section.get("tables") or [])
        if merged and is_heading_fragment(
            heading, content, code_blocks, tables=tables
        ):
            parent = merged[-1]
            block_parts = [f"## {heading}"]
            if str(content).strip():
                block_parts.append(str(content).strip())
            block = "\n".join(block_parts)
            parent_content = (parent.get("content") or "").strip()
            parent["content"] = (
                f"{parent_content}\n\n{block}".strip() if parent_content else block
            )
            parent_codes = list(parent.get("codeBlocks") or [])
            parent_codes.extend(code_blocks)
            parent["codeBlocks"] = parent_codes
            parent_tables = list(parent.get("tables") or [])
            parent_tables.extend(list(section.get("tables") or []))
            parent["tables"] = parent_tables
            merged_headings = list(parent.get("mergedHeadings") or [])
            merged_headings.append(heading)
            parent["mergedHeadings"] = merged_headings
            parent["mergeReason"] = "heading_fragment_merged"
            continue
        next_section = dict(section)
        next_section.setdefault(
            "mergedHeadings", list(section.get("mergedHeadings") or [])
        )
        merged.append(next_section)
    return merged

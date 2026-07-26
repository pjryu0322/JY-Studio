"""Merge short API heading fragments into parent sections (hierarchy-aware)."""

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

_ENTITY_HEADING_RE = re.compile(
    r"^(?:class|component|function|interface|type|api|enum|module|"
    r"클래스|컴포넌트|함수|인터페이스|모듈)\s*:?\s*.+",
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


def _heading_level(section: dict[str, Any]) -> int:
    level = section.get("headingLevel")
    if isinstance(level, int) and level > 0:
        return level
    path = _heading_path(section)
    if path and " > " in path:
        return path.count(" > ") + 1
    heading = _clean_text(section.get("heading") or "")
    if " > " in heading:
        return heading.count(" > ") + 1
    return 2


def _heading_path(section: dict[str, Any]) -> str:
    for key in ("headingPath", "parentPath"):
        value = section.get(key)
        if isinstance(value, str) and value.strip():
            return _clean_text(value)
        if isinstance(value, (list, tuple)) and value:
            return " > ".join(_clean_text(str(part)) for part in value if str(part).strip())
    heading = _clean_text(section.get("heading") or "")
    return heading


def _parent_path(section: dict[str, Any]) -> str:
    path = _heading_path(section)
    if " > " in path:
        return path.rsplit(" > ", 1)[0].strip()
    parent_title = section.get("parentTitle")
    if isinstance(parent_title, str) and parent_title.strip():
        return _clean_text(parent_title)
    return ""


def _looks_like_entity_section(section: dict[str, Any]) -> bool:
    heading = _clean_text(section.get("heading") or "")
    if not heading:
        return False
    if is_fragment_heading_name(heading):
        return False
    if _ENTITY_HEADING_RE.match(heading):
        return True
    explicit = (section.get("entityName") or "").strip()
    if explicit:
        return True
    body = _clean_text(section.get("content") or "")
    codes = section.get("codeBlocks") or []
    return _heading_level(section) <= 2 and (len(body) >= 40 or bool(codes))


def find_merge_parent(
    merged: list[dict[str, Any]], fragment: dict[str, Any]
) -> dict[str, Any]:
    """Prefer path and heading-level parents before same-entity fallback."""
    if not merged:
        raise ValueError("merged sections must not be empty")

    frag_parent_path = _parent_path(fragment)
    frag_level = _heading_level(fragment)

    # 1) Direct parent by headingPath / parent path.
    if frag_parent_path:
        parent_key = frag_parent_path.lower()
        for candidate in reversed(merged):
            cand_path = _heading_path(candidate).lower()
            cand_heading = _clean_text(candidate.get("heading") or "").lower()
            if cand_path == parent_key or cand_heading == parent_key:
                return candidate

    # 2) Heading-level parent: nearest shallower section.
    for candidate in reversed(merged):
        if _heading_level(candidate) < frag_level:
            return candidate

    # 3) Same parent path: preceding semantic sibling/context section.
    if frag_parent_path:
        parent_key = frag_parent_path.lower()
        for candidate in reversed(merged):
            if _parent_path(candidate).lower() != parent_key:
                continue
            cand_heading = candidate.get("heading") or ""
            if is_fragment_heading_name(cand_heading):
                continue
            return candidate

    # 4) Same entity / root — only after hierarchy signals fail.
    for candidate in reversed(merged):
        if _looks_like_entity_section(candidate):
            return candidate

    # 5) Adjacent fallback.
    return merged[-1]


def _append_fragment_to_parent(
    parent: dict[str, Any],
    heading: str,
    content: str,
    code_blocks: list,
    tables: list,
) -> None:
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
    parent_tables.extend(tables)
    parent["tables"] = parent_tables
    merged_headings = list(parent.get("mergedHeadings") or [])
    merged_headings.append(heading)
    parent["mergedHeadings"] = merged_headings
    parent["mergeReason"] = "heading_fragment_merged"


def merge_heading_fragments(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fold short Returns/Type/Events/... pieces into a hierarchy-aware parent."""
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
            parent = find_merge_parent(merged, section)
            _append_fragment_to_parent(
                parent, heading, content, code_blocks, tables
            )
            continue
        next_section = dict(section)
        next_section.setdefault(
            "mergedHeadings", list(section.get("mergedHeadings") or [])
        )
        merged.append(next_section)
    return merged

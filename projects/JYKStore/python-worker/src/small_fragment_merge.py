"""Merge undersized non-meaningful section fragments into adjacent parents.

Distinct from ``section_merge.merge_heading_fragments`` (heading chrome only).
Does NOT use an LLM. Protects short but meaningful units (API signatures,
errors, code, tables, config-like lines).
"""

from __future__ import annotations

import re
from typing import Any

from src.chunk_policy import small_chunk_max_chars

_MEANINGFUL_SHORT_RE = re.compile(
    r"("
    r"^\s*(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/"  # HTTP
    r"|^\s*(?:function|class|interface|enum|type|const|let|var|def|fn)\s+\w"  # defs
    r"|^\s*\w[\w.]*\s*\([^)]*\)\s*(?:;|:|\{|$)"  # signature-ish
    r"|^\s*(?:error|err|errno|status|code)\s*[:=#]"  # error/status
    r"|^\s*(?:warning|warn|주의|경고)\b"
    r"|^\s*[\w.-]+\s*[:=]\s*\S+"  # config key=value
    r"|^\s*(?:npm|npx|yarn|pnpm|docker|kubectl|curl|git)\s+\S+"  # commands
    r")",
    re.I | re.M,
)

_CONTINUATION_RE = re.compile(
    r"^(?:그리고|또한|즉|예를\s*들어|for\s+example|e\.g\.|i\.e\.|see\s+above|continued)\b",
    re.I,
)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def is_meaningful_short_unit(section: dict[str, Any]) -> bool:
    """Protect short but independent knowledge units from auto-merge."""
    if section.get("codeBlocks"):
        return True
    if section.get("tables"):
        return True
    body = _clean(section.get("content") or "")
    heading = _clean(section.get("heading") or "")
    if not body and heading:
        # heading-only chrome handled elsewhere; treat bare heading as mergeable
        return False
    if _MEANINGFUL_SHORT_RE.search(body) or _MEANINGFUL_SHORT_RE.search(heading):
        return True
    # Heading + short description with a clear entity-like heading stays independent
    if heading and body and len(body) < small_chunk_max_chars():
        if re.match(
            r"^(?:class|component|function|interface|api|method|property|enum)\b",
            heading,
            re.I,
        ):
            return True
    return False


def is_undersized_merge_candidate(section: dict[str, Any]) -> bool:
    if is_meaningful_short_unit(section):
        return False
    if section.get("codeBlocks") or section.get("tables"):
        return False
    body = _clean(section.get("content") or "")
    if not body:
        return True
    if len(body) >= small_chunk_max_chars():
        return False
    # Prefer continuation-like or bare fragments
    if _CONTINUATION_RE.match(body):
        return True
    # Short body without independent markers
    return True


def _compatible(a: dict[str, Any], b: dict[str, Any]) -> bool:
    # Same structural neighborhood: prefer shared parent path / similar heading level
    path_a = (a.get("headingPath") or a.get("parentPath") or "") or ""
    path_b = (b.get("headingPath") or b.get("parentPath") or "") or ""
    if path_a and path_b and path_a != path_b:
        # Allow sibling under same parent prefix
        parent_a = path_a.rsplit(" > ", 1)[0] if " > " in path_a else path_a
        parent_b = path_b.rsplit(" > ", 1)[0] if " > " in path_b else path_b
        if parent_a != parent_b:
            return False
    return True


def merge_undersized_fragments(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge undersized non-meaningful sections into the previous compatible section."""
    if not sections:
        return sections
    max_chars = small_chunk_max_chars()
    out: list[dict[str, Any]] = []
    auto_events: list[dict[str, Any]] = []

    for section in sections:
        current = dict(section)
        if (
            out
            and is_undersized_merge_candidate(current)
            and _compatible(out[-1], current)
        ):
            parent = out[-1]
            parent_body = parent.get("content") or ""
            child_body = current.get("content") or ""
            child_heading = _clean(current.get("heading") or "")
            addition = child_body
            if child_heading and child_heading != _clean(parent.get("heading") or ""):
                addition = f"## {child_heading}\n{child_body}".strip()
            merged_content = f"{parent_body}\n\n{addition}".strip() if parent_body else addition
            # Abort if merge would create an oversized blob (char heuristic ~ target)
            if len(_clean(merged_content)) > max_chars * 20:
                out.append(current)
                continue
            parent["content"] = merged_content
            merged = list(parent.get("mergedHeadings") or [])
            if child_heading:
                merged.append(child_heading)
            parent["mergedHeadings"] = merged
            parent["mergeReason"] = "undersized_fragment_merged"
            auto_events.append(
                {
                    "autoCorrectionType": "UNDERSIZED_FRAGMENT_MERGE",
                    "reason": "undersized_non_meaningful_fragment",
                    "policyVersion": "chunk-policy-v1",
                    "beforeChars": len(_clean(child_body)),
                    "afterChars": len(_clean(merged_content)),
                }
            )
            parent.setdefault("autoCorrections", [])
            parent["autoCorrections"].extend(auto_events[-1:])
            continue
        out.append(current)

    return out


def dedupe_exact_section_contents(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop exact-duplicate bodies that share the same normalized content within a doc."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for section in sections:
        body = _clean(section.get("content") or "")
        codes = section.get("codeBlocks") or []
        if codes or section.get("tables"):
            out.append(section)
            continue
        if not body:
            out.append(section)
            continue
        key = body.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(section)
    return out

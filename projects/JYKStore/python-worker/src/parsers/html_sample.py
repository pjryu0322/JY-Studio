"""Sample HTML parser (Samples / React_Vue_Samples / ServerSamples)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup, Tag

from ..zip_paths import artifact_output_path

PARSER_NAME = "html_sample"
PARSER_VERSION = "0.1.1"

_GENERIC_SAMPLE_TITLE_RE = re.compile(
    r"^(rMate(Grid)?H5(\s*\(.*\))?|rMate\s*HTML5\s*Grid|rMate\s*Grid|"
    r"React App|Vue App)\s*$",
    re.I,
)


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _humanize_stem(source_path: str) -> str:
    stem = Path(source_path).stem
    return stem.replace("_", " ").replace("-", " ").strip() or stem


def _sample_name(source_path: str, soup: BeautifulSoup) -> str:
    fallback = _humanize_stem(source_path)
    candidates: list[str] = []
    if soup.title and soup.title.string:
        candidates.append(_clean_text(soup.title.string))
    h1 = soup.find("h1")
    if h1:
        candidates.append(_clean_text(h1.get_text(" ", strip=True)))
    for cand in candidates:
        if cand and not _GENERIC_SAMPLE_TITLE_RE.match(cand):
            return cand
    return fallback

def _extract_description(soup: BeautifulSoup) -> str:
    meta = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    if meta and meta.get("content"):
        return _clean_text(meta["content"])
    for sel in ("#description", ".description", ".sample-desc", ".desc"):
        node = soup.select_one(sel)
        if node:
            return _clean_text(node.get_text(" ", strip=True))
    # First paragraph
    p = soup.find("p")
    if p:
        text = _clean_text(p.get_text(" ", strip=True))
        if text:
            return text[:500]
    return ""


def _extract_code_blocks(soup: BeautifulSoup) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        text = (code.get_text() if code else pre.get_text()).strip()
        if text:
            lang = None
            if code and code.get("class"):
                for cls in code.get("class", []):
                    if cls.startswith("language-"):
                        lang = cls.replace("language-", "", 1)
            blocks.append({"language": lang, "content": text})

    # Inline scripts that look like sample logic (not empty src)
    for script in soup.find_all("script"):
        src = script.get("src")
        if src:
            continue
        text = (script.string or script.get_text() or "").strip()
        if len(text) > 30:
            blocks.append({"language": "javascript", "content": text})

    # textarea often holds sample XML/JSON layouts in grid demos
    for ta in soup.find_all("textarea"):
        text = ta.get_text().strip()
        if len(text) > 20:
            lang = "xml" if text.lstrip().startswith("<") else "text"
            blocks.append({"language": lang, "content": text})

    return blocks


def _resolve_related(src: str, source_path: str) -> str | None:
    if not src or src.startswith(("http://", "https://", "data:", "mailto:", "#")):
        return None
    parsed = urlparse(src)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    if path.startswith("/"):
        return path.lstrip("/")
    base_dir = Path(source_path).parent
    try:
        resolved = (base_dir / path).as_posix()
    except Exception:
        return path
    # Normalize .. segments
    parts: list[str] = []
    for part in resolved.replace("\\", "/").split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if parts:
                parts.pop()
            continue
        parts.append(part)
    return "/".join(parts)


def _extract_related_files(soup: BeautifulSoup, source_path: str) -> list[str]:
    related: set[str] = set()
    for tag in soup.find_all(["script", "link", "img", "iframe"]):
        attr = "href" if tag.name == "link" else "src"
        val = tag.get(attr)
        if not val:
            continue
        resolved = _resolve_related(val, source_path)
        if not resolved:
            continue
        lower = resolved.lower()
        if lower.endswith(
            (".js", ".xml", ".json", ".css", ".html", ".htm", ".ts", ".tsx", ".jsx")
        ):
            related.add(resolved)

    # Regex scan for layoutURL / dataURL style references in scripts
    for script in soup.find_all("script"):
        text = script.string or script.get_text() or ""
        for match in re.findall(
            r"""['"]([^'"]+\.(?:js|xml|json|css))['"]""",
            text,
            flags=re.I,
        ):
            resolved = _resolve_related(match, source_path)
            if resolved:
                related.add(resolved)

    return sorted(related)


def _extract_api_candidates(soup: BeautifulSoup, code_blocks: list[dict[str, Any]]) -> list[str]:
    candidates: set[str] = set()
    text_blob = soup.get_text(" ", strip=True)
    for match in re.findall(r"\b(DataGrid\w*|Grid\w*|Column\w*|Collection\w*)\b", text_blob):
        candidates.add(match)
    for block in code_blocks:
        content = block.get("content") or ""
        for match in re.findall(r"\b(DataGrid\w*|rMateGrid\w*|GridRoot\w*)\b", content):
            candidates.add(match)
        for match in re.findall(r"""['"]([A-Z][A-Za-z0-9]+)['"]""", content):
            if len(match) > 3:
                candidates.add(match)
    return sorted(candidates)[:40]


def parse_sample_html(file_path: Path, source_path: str) -> dict[str, Any]:
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(raw, "lxml")

    name = _sample_name(source_path, soup)
    description = _extract_description(soup)
    code_blocks = _extract_code_blocks(soup)
    related = _extract_related_files(soup, source_path)
    api_candidates = _extract_api_candidates(soup, code_blocks)

    body = soup.body or soup
    body_text = _clean_text(body.get_text(" ", strip=True))[:20000]

    sections = [
        {
            "heading": name,
            "content": description or body_text[:2000],
            "tables": [],
            "codeBlocks": code_blocks,
        }
    ]

    keywords = sorted(
        {
            name,
            *api_candidates[:15],
            *re.findall(
                r"(체크박스|checkbox|병합|merge|footer|header|컬럼|column|React|Vue|Grid)",
                f"{name} {description} {body_text}",
                flags=re.I,
            ),
        }
    )[:40]

    return {
        "parser": PARSER_NAME,
        "parserVersion": PARSER_VERSION,
        "sourcePath": source_path,
        "sampleName": name,
        "title": name,
        "description": description,
        "sections": sections,
        "codeBlocks": code_blocks,
        "relatedFiles": related,
        "referencedApiCandidates": api_candidates,
        "symbols": api_candidates,
        "keywords": keywords,
        "bodyText": body_text,
    }


def parse_and_save(
    file_path: Path,
    source_path: str,
    artifacts_dir: Path,
    *,
    index: int = 1,
) -> dict[str, Any]:
    result = parse_sample_html(file_path, source_path)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out = artifact_output_path(
        artifacts_dir, kind="sample", index=index, source_path=source_path
    )
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["_artifactPath"] = str(out)
    return result

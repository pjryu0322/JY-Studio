"""HTML API documentation parser (Docs/api/*.html)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag

from ..zip_paths import artifact_output_path
from ..section_merge import merge_heading_fragments

PARSER_NAME = "html_api"
PARSER_VERSION = "0.1.2"

HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6")

# Product-level page chrome titles that should not replace the API class name
_GENERIC_TITLE_RE = re.compile(
    r"^(rMate(Grid)?H5(\s*\d+(\.\d+)*)?|rMate\s*HTML5\s*Grid|"
    r"rMate\s*Grid|API\s*Documentation)\s*(\(.*\))?$",
    re.I,
)


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _api_name_from_path(source_path: str) -> str:
    return Path(source_path).stem


def _is_generic_title(title: str) -> bool:
    t = _clean_text(title)
    if not t:
        return True
    if _GENERIC_TITLE_RE.match(t):
        return True
    # Version-only banners e.g. "rMateGridH5 6.0"
    if re.match(r"^rMate[\w]*\s*[\d.]+$", t, re.I):
        return True
    return False


def _extract_title(soup: BeautifulSoup, root: Tag, api_name: str) -> str:
    # Prefer explicit class heading inside main content
    for heading in root.find_all(list(HEADING_TAGS)):
        text = _clean_text(heading.get_text(" ", strip=True))
        if text.lower().startswith("class:"):
            name = text.split(":", 1)[1].strip()
            if name:
                return name
        if text == api_name:
            return api_name

    page_title = ""
    if soup.title and soup.title.string:
        page_title = _clean_text(soup.title.string)
    if page_title and not _is_generic_title(page_title):
        return page_title

    for tag in HEADING_TAGS:
        node = root.find(tag)
        if node:
            text = _clean_text(node.get_text(" ", strip=True))
            if text and not _is_generic_title(text):
                return text
    return api_name


def _main_content_root(soup: BeautifulSoup) -> Tag:
    """Prefer the document main pane; strip left-nav chrome."""
    for sel in ("div.main", "div#main", "main", "article", ".container-overview"):
        node = soup.select_one(sel)
        if node:
            return node
    body = soup.body or soup
    # Remove known navigation chrome if present
    for nav in body.select("div.navigation, nav, #nav, .sidebar"):
        nav.decompose()
    return body


def _extract_tables(container: Tag) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    for table in container.find_all("table"):
        headers: list[str] = []
        thead = table.find("thead")
        if thead:
            headers = [
                _clean_text(th.get_text(" ", strip=True))
                for th in thead.find_all(["th", "td"])
            ]
        rows: list[list[str]] = []
        body = table.find("tbody") or table
        for tr in body.find_all("tr"):
            cells = [
                _clean_text(td.get_text(" ", strip=True))
                for td in tr.find_all(["td", "th"])
            ]
            if cells:
                if headers and cells == headers:
                    continue
                if not headers and tr.find("th"):
                    headers = cells
                    continue
                rows.append(cells)
        tables.append({"headers": headers, "rows": rows})
    return tables


def _extract_code_blocks(container: Tag | BeautifulSoup) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for pre in container.find_all("pre"):
        code = pre.find("code")
        text = code.get_text() if code else pre.get_text()
        lang = None
        if code and code.get("class"):
            for cls in code.get("class", []):
                if cls.startswith("language-"):
                    lang = cls.replace("language-", "", 1)
                    break
                if cls in {"js", "javascript", "xml", "json", "html", "css", "python"}:
                    lang = cls
        blocks.append({"language": lang, "content": text.strip()})
    for code in container.find_all("code"):
        if code.find_parent("pre"):
            continue
        text = code.get_text().strip()
        if len(text) > 40:
            blocks.append({"language": None, "content": text})
    return blocks


def _section_content_until_next_heading(heading: Tag) -> Tag:
    """Wrap sibling content until next heading of same/higher level into a fake div."""
    level = int(heading.name[1])
    bits: list[str] = []
    for sibling in heading.next_siblings:
        if isinstance(sibling, NavigableString):
            bits.append(str(sibling))
            continue
        if not isinstance(sibling, Tag):
            continue
        if sibling.name in HEADING_TAGS and int(sibling.name[1]) <= level:
            break
        bits.append(str(sibling))
    return BeautifulSoup("".join(bits), "lxml")


def _extract_symbols(root: Tag, api_name: str) -> list[str]:
    symbols: set[str] = {api_name} if api_name else set()
    for tag in root.find_all(["code", "strong", "b", "dt", "a"]):
        text = _clean_text(tag.get_text(" ", strip=True))
        if not text or " " in text or len(text) > 80:
            continue
        if re.match(r"^[A-Za-z_][\w.]*$", text):
            symbols.add(text)
        href = tag.get("href") if tag.name == "a" else None
        if href and href.startswith("#"):
            anchor = href[1:]
            if re.match(r"^[A-Za-z_][\w.-]*$", anchor):
                symbols.add(anchor.split(".")[-1] if "." in anchor else anchor)
    return sorted(symbols)[:100]


def _extract_keywords(title: str, text: str, symbols: list[str]) -> list[str]:
    keywords: set[str] = set()
    if title:
        keywords.add(title)
    for sym in symbols[:20]:
        keywords.add(sym)
    for match in re.findall(
        r"(헤더\s*병합|셀\s*병합|컬럼|footer|checkbox|체크박스|column\s*group|"
        r"DataGrid|Grid|merge|footer|property|method|event)",
        text,
        flags=re.I,
    ):
        keywords.add(_clean_text(match))
    return sorted(keywords)[:50]


def _should_keep_section(
    heading: str,
    content: str,
    code_blocks: list,
    *,
    api_name: str = "",
) -> bool:
    if _is_generic_title(heading):
        return False
    if code_blocks:
        return True
    if api_name and (
        heading == api_name or heading.lower() == f"class: {api_name}".lower()
    ):
        return True
    if len(content) >= 40:
        return True
    # Keep short member/meta headings so the merge pass can fold them into the
    # parent entity instead of dropping them entirely.
    from ..section_merge import is_fragment_heading_name

    if is_fragment_heading_name(heading):
        return True
    if len(content) >= 12 and not _is_generic_title(heading):
        return True
    return False


def parse_api_html(file_path: Path, source_path: str) -> dict[str, Any]:
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(raw, "lxml")

    api_name = _api_name_from_path(source_path)
    root = _main_content_root(soup)
    title = _extract_title(soup, root, api_name)

    sections: list[dict[str, Any]] = []
    headings = root.find_all(list(HEADING_TAGS))

    if headings:
        for heading in headings:
            section_soup = _section_content_until_next_heading(heading)
            heading_text = _clean_text(heading.get_text(" ", strip=True))
            content = _clean_text(section_soup.get_text(" ", strip=True))
            code_blocks = _extract_code_blocks(section_soup)
            if not _should_keep_section(
                heading_text, content, code_blocks, api_name=api_name
            ):
                continue
            sections.append(
                {
                    "heading": heading_text,
                    "content": content,
                    "tables": _extract_tables(section_soup),
                    "codeBlocks": code_blocks,
                }
            )
    if not sections:
        content = _clean_text(root.get_text(" ", strip=True))
        sections.append(
            {
                "heading": title,
                "content": content,
                "tables": _extract_tables(root),
                "codeBlocks": _extract_code_blocks(root),
            }
        )

    sections = merge_heading_fragments(sections)

    all_code = _extract_code_blocks(root)
    symbols = _extract_symbols(root, api_name)
    full_text = " ".join(s.get("content", "") for s in sections)
    keywords = _extract_keywords(title, full_text, symbols)

    entities: list[dict[str, str]] = [{"type": "component", "name": api_name}]
    for section in sections:
        h = (section.get("heading") or "").lower()
        if "propert" in h or h == "members":
            entities.append({"type": "section", "name": section["heading"]})
        elif "method" in h:
            entities.append({"type": "section", "name": section["heading"]})
        elif "event" in h:
            entities.append({"type": "section", "name": section["heading"]})
        elif "example" in h or "예제" in h:
            entities.append({"type": "example", "name": section["heading"]})

    return {
        "parser": PARSER_NAME,
        "parserVersion": PARSER_VERSION,
        "sourcePath": source_path,
        "title": title,
        "apiName": api_name,
        "headings": [s["heading"] for s in sections],
        "sections": sections,
        "tables": _extract_tables(root),
        "codeBlocks": all_code,
        "symbols": symbols,
        "keywords": keywords,
        "entities": entities,
        "bodyText": full_text[:50000],
    }


def parse_and_save(
    file_path: Path,
    source_path: str,
    artifacts_dir: Path,
    *,
    index: int = 1,
) -> dict[str, Any]:
    result = parse_api_html(file_path, source_path)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out = artifact_output_path(
        artifacts_dir, kind="api", index=index, source_path=source_path
    )
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["_artifactPath"] = str(out)
    return result

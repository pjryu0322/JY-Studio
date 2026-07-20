"""Human-readable Markdown review document."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def _display_title(doc: dict[str, Any]) -> str:
    title = (doc.get("title") or "").strip()
    path = doc.get("sourcePath") or ""
    stem = Path(path).stem if path else ""
    if not title or title in {"rMateGridH5 6.0", "rMateGridH5 (RiaMore Soft)", "rMate HTML5 Grid"}:
        return stem or title or path
    return title


def _pick_chunk_previews(chunks: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    """Prefer distinctive API/sample chunks over chrome-heavy early pages."""
    priority_terms = (
        "DataGridColumnGroup",
        "DataGridFooter",
        "SpanMerging",
        "CheckBox",
        "Checkbox",
        "React",
        "Vue",
        "footer",
        "merge",
        "ColumnGroup",
        "사용설명서",
        "pdf_manual",
    )
    scored: list[tuple[int, dict[str, Any]]] = []
    for chunk in chunks:
        blob = " ".join(
            [
                chunk.get("title") or "",
                chunk.get("section") or "",
                chunk.get("sourcePath") or "",
                chunk.get("sourceType") or "",
                " ".join(chunk.get("symbols") or []),
            ]
        )
        score = sum(1 for t in priority_terms if t.lower() in blob.lower())
        if chunk.get("sourceType") == "pdf_manual":
            score += 2
        # Prefer longer content slightly
        score += min(len(chunk.get("content") or "") // 400, 3)
        scored.append((score, chunk))
    scored.sort(key=lambda x: (-x[0], x[1].get("sourcePath") or ""))
    picked: list[dict[str, Any]] = []
    seen_paths: set[str] = set()
    for score, chunk in scored:
        path = chunk.get("sourcePath") or ""
        # diversify by source path
        if path in seen_paths and score < 2:
            continue
        picked.append(chunk)
        seen_paths.add(path)
        if len(picked) >= limit:
            break
    if len(picked) < min(limit, len(chunks)):
        for chunk in chunks:
            if chunk in picked:
                continue
            picked.append(chunk)
            if len(picked) >= limit:
                break
    return picked


def write_markdown_review(
    *,
    path: Path,
    pack_name: str,
    product_version: str,
    language: str,
    inventory: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    report: dict[str, Any],
) -> None:
    knowledge = [e for e in inventory if e.get("classification") == "knowledge_target"]
    excluded = [e for e in inventory if e.get("classification") == "excluded"]
    review = [e for e in inventory if e.get("classification") == "review_target"]
    api_docs = [d for d in documents if d.get("sourceType") == "api_html"]
    samples = [d for d in documents if d.get("sourceType") == "sample_html"]
    pdf_docs = [d for d in documents if d.get("sourceType") == "pdf_manual"]
    hangul_paths = [
        e["sourcePath"]
        for e in inventory
        if any("\uac00" <= ch <= "\ud7a3" for ch in e.get("sourcePath") or "")
    ]
    cp949 = sum(1 for e in inventory if e.get("pathEncoding") == "cp949")

    lines: list[str] = [
        f"# {pack_name} — Structured Review",
        "",
        f"- **Product version:** {product_version}",
        f"- **Language:** {language}",
        f"- **Status:** {report.get('status')}",
        "",
        "## Summary",
        "",
        f"- Total files: {report.get('totals', {}).get('files', 0)}",
        f"- Knowledge targets: {report.get('totals', {}).get('knowledgeTargets', 0)}",
        f"- Excluded: {report.get('totals', {}).get('excluded', 0)}",
        f"- Supporting assets: {report.get('totals', {}).get('supportingAssets', 0)}",
        f"- Review targets: {report.get('totals', {}).get('reviewTargets', 0)}",
        f"- Documents: {report.get('totals', {}).get('documents', 0)}",
        f"- Chunks: {report.get('totals', {}).get('chunks', 0)}",
        f"- Parse skipped: {report.get('totals', {}).get('parseSkipped', 0)}",
        f"- Parse failed: {report.get('totals', {}).get('parseFailed', 0)}",
        f"- Hangul sourcePath count: {len(hangul_paths)} (cp949 recovered: {cp949})",
        "",
        "## Knowledge Targets",
        "",
    ]

    for e in knowledge[:100]:
        lines.append(f"- `{e['sourcePath']}` ({e.get('parser') or 'n/a'})")
    if len(knowledge) > 100:
        lines.append(f"- … and {len(knowledge) - 100} more")

    lines.extend(["", "## Review Targets", ""])
    if not review:
        lines.append("- None")
    for e in review[:40]:
        lines.append(f"- `{e['sourcePath']}`")
    if len(review) > 40:
        lines.append(f"- … and {len(review) - 40} more")

    lines.extend(["", "## Excluded (sample)", ""])
    for e in excluded[:50]:
        reason = e.get("excludedReason") or ""
        lines.append(f"- `{e['sourcePath']}` — {reason}")
    if len(excluded) > 50:
        lines.append(f"- … and {len(excluded) - 50} more")

    lines.extend(["", "## API Documents", ""])
    for d in api_docs[:80]:
        lines.append(f"- **{_display_title(d)}** — `{d.get('sourcePath')}`")
    if len(api_docs) > 80:
        lines.append(f"- … and {len(api_docs) - 80} more")

    lines.extend(["", "## Samples", ""])
    for d in samples[:80]:
        lines.append(f"- **{_display_title(d)}** — `{d.get('sourcePath')}`")
    if len(samples) > 80:
        lines.append(f"- … and {len(samples) - 80} more")

    lines.extend(["", "## PDF Manuals", ""])
    if not pdf_docs:
        lines.append("- None (or PDF parsing skipped — see Warnings)")
    for d in pdf_docs:
        lines.append(f"- **{_display_title(d)}** — `{d.get('sourcePath')}`")
        headings = [s.get("heading") for s in (d.get("sections") or []) if s.get("heading")]
        lines.append(f"  - sections: {len(headings)}")
        for h in headings[:25]:
            lines.append(f"  - {h}")
        if len(headings) > 25:
            lines.append(f"  - … and {len(headings) - 25} more")
        # content sample from first substantial section
        sample = ""
        for s in d.get("sections") or []:
            content = (s.get("content") or "").strip()
            if len(content) >= 80:
                sample = content[:300]
                break
        if sample:
            lines.append(f"  - preview: {sample}…")

    if hangul_paths:
        lines.extend(["", "## Hangul / Recovered Paths (sample)", ""])
        for p in hangul_paths[:20]:
            lines.append(f"- `{p}`")
        if len(hangul_paths) > 20:
            lines.append(f"- … and {len(hangul_paths) - 20} more")

    lines.extend(["", "## Chunk Preview", ""])
    for chunk in _pick_chunk_previews(chunks, limit=20):
        preview = (chunk.get("content") or "").replace("\n", " ")[:220]
        lines.append(f"### {_display_title(chunk)} / {chunk.get('section')}")
        lines.append("")
        lines.append(f"- chunkId: `{chunk.get('chunkId')}`")
        lines.append(f"- source: `{chunk.get('sourcePath')}`")
        lines.append(f"- sourceType: `{chunk.get('sourceType')}`")
        lines.append(f"- preview: {preview}…")
        lines.append("")

    warnings = report.get("warnings") or []
    errors = report.get("errors") or []
    lines.extend(["## Warnings / Errors", ""])
    if not warnings and not errors:
        lines.append("- None")
    for w in warnings:
        lines.append(f"- WARNING: {w}")
    for e in errors:
        lines.append(f"- ERROR: {e}")

    # Parser skip details help providers understand PDF gaps
    parsers = report.get("parsers") or {}
    skip_details = []
    for pname, pdata in parsers.items():
        for detail in pdata.get("details") or []:
            skip_details.append(
                f"{pname}: {detail.get('sourcePath')} — {detail.get('reason')}"
            )
    if skip_details:
        lines.extend(["", "### Parser skip / fail details", ""])
        for item in skip_details[:30]:
            lines.append(f"- {item}")

    license_info = report.get("license") or {}
    lines.extend(
        [
            "",
            "## License Signals",
            "",
            f"- licenseDetected: {license_info.get('licenseDetected')}",
            f"- licenseKeyDetected: {license_info.get('licenseKeyDetected')}",
            f"- licenseFileCount: {license_info.get('licenseFileCount')}",
            "",
            "## Reviewer Checklist",
            "",
            "- [ ] License / LicenseKey items reviewed (not searchable knowledge)",
            "- [ ] PDF manuals present when Docling is installed; section outline looks sane",
            "- [ ] API titles look like class names (not product chrome)",
            "- [ ] Sample titles look like sample file names",
            "- [ ] Key topics present in chunks: ColumnGroup, Footer, SpanMerging, CheckBox, React/Vue",
            "",
        ]
    )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")

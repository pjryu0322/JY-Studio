"""Rebuild rmate-grid-v6-docling outputs after PDF parser improvements."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.chunker import build_chunks_and_traces, write_chunks, write_traces
from src.inventory import inventory_by_path
from src.markdown_writer import write_markdown_review
from src.normalizer import normalize_documents, write_normalized_documents
from src.parsers import html_api, html_sample, license_inspector, pdf_docling
from src.report import build_validation_report, write_validation_report


def load_json_artifacts(directory: Path) -> list[dict]:
    if not directory.exists():
        return []
    items = []
    for path in sorted(directory.glob("*.json")):
        if path.name == "license_inspection.json":
            continue
        items.append(json.loads(path.read_text(encoding="utf-8")))
    return items


def main() -> int:
    out = ROOT / "output" / "rmate-grid-v6-docling"
    extract = out / "_extracted"
    artifacts = out / "parser_artifacts"
    inventory = json.loads((out / "inventory.json").read_text(encoding="utf-8"))
    by_path = inventory_by_path(inventory)

    pdf_entries = [
        e
        for e in inventory
        if e.get("parser") == "docling_pdf" and e.get("classification") == "knowledge_target"
    ]
    if not pdf_entries:
        print("No PDF knowledge targets in inventory")
        return 1

    pdf_artifacts = []
    for idx, entry in enumerate(pdf_entries, start=1):
        source_path = entry["sourcePath"]
        # Prefer recovered path; fall back to any pdf under Docs
        abs_path = extract / source_path
        if not abs_path.is_file():
            candidates = list((extract / "Docs").glob("*.pdf")) if (extract / "Docs").exists() else []
            if not candidates:
                candidates = list(extract.rglob("*.pdf"))
            if not candidates:
                print(f"Missing PDF file for {source_path}")
                return 1
            abs_path = candidates[0]
        print(f"Re-parsing PDF: {abs_path}")
        art = pdf_docling.parse_and_save(
            abs_path, source_path, artifacts / "pdf", index=idx
        )
        pdf_artifacts.append(art)
        print(
            f"  status={art.get('status')} sections={len(art.get('sections') or [])} "
            f"title={art.get('title')}"
        )

    api_artifacts = load_json_artifacts(artifacts / "api_html")
    sample_artifacts = load_json_artifacts(artifacts / "samples")
    license_signals = license_inspector.detect_license_signals(inventory, extract)

    documents = normalize_documents(
        pack_name="rMate Grid",
        product_version="v6.0",
        language="ko",
        api_artifacts=api_artifacts,
        sample_artifacts=sample_artifacts,
        pdf_artifacts=pdf_artifacts,
        license_files=license_signals.get("licenseFiles") or [],
    )
    write_normalized_documents(documents, out / "normalized_documents.json")

    chunks, traces = build_chunks_and_traces(documents, by_path)
    write_chunks(chunks, out / "chunks.json")
    write_traces(traces, out / "source_trace.json")

    warnings = [
        "LicenseKey folder detected; contents excluded from knowledge",
        "License/copyright review files detected",
    ]
    errors: list[str] = []
    for art in pdf_artifacts:
        if art.get("status") == "skipped":
            warnings.append(f"PDF skipped: {art.get('sourcePath')} ({art.get('skipReason')})")
        elif art.get("status") == "failed":
            errors.append(f"PDF failed: {art.get('sourcePath')} ({art.get('skipReason')})")

    parser_results = {
        "html_api": [{"sourcePath": a.get("sourcePath"), "status": "ok"} for a in api_artifacts],
        "html_sample": [
            {"sourcePath": a.get("sourcePath"), "status": "ok"} for a in sample_artifacts
        ],
        "docling_pdf": pdf_artifacts,
        "license_inspector": [
            {"sourcePath": f.get("sourcePath"), "status": "ok"}
            for f in license_signals.get("licenseFiles") or []
        ],
    }
    status = "ok" if not errors else "partial"
    report = build_validation_report(
        inventory=inventory,
        parser_results=parser_results,
        license_signals=license_signals,
        warnings=warnings,
        errors=errors,
        chunks_count=len(chunks),
        documents_count=len(documents),
        status=status,
    )
    write_validation_report(report, out / "validation_report.json")
    write_markdown_review(
        path=out / "normalized_documents.md",
        pack_name="rMate Grid",
        product_version="v6.0",
        language="ko",
        inventory=inventory,
        documents=documents,
        chunks=chunks,
        report=report,
    )
    print(f"Rebuilt: docs={len(documents)} chunks={len(chunks)} status={status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

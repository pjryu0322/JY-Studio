"""Unit tests for JYKStore Python Worker (1st pass)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from parse_archive import is_safe_zip_member, safe_extract_zip
from src.chunker import build_chunks_and_traces
from src.embedding import (
    EmbeddingError,
    build_content_hash,
    build_embeddings,
    build_passage_text,
    resolve_embedding_config,
    write_embeddings,
)
from src.parsers import html_api, html_sample, pdf_docling
from src.policies import classify_file
from src.zip_paths import (
    decode_zip_filename,
    safe_artifact_basename,
    write_cp949_zip,
)


def _write_utf8_zip_entry(
    zf: zipfile.ZipFile, unicode_path: str, data: bytes | str
) -> None:
    """Write a ZIP member with UTF-8 filename flag set."""
    if isinstance(data, str):
        data = data.encode("utf-8")
    info = zipfile.ZipInfo(filename=unicode_path)
    info.flag_bits |= 0x800
    zf.writestr(info, data)


class ZipSlipTests(unittest.TestCase):
    def test_rejects_parent_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            ok, reason = is_safe_zip_member("../evil.txt", dest)
            self.assertFalse(ok)
            self.assertIn("traversal", (reason or "").lower())

    def test_rejects_absolute_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            ok, reason = is_safe_zip_member("/tmp/evil.txt", dest)
            self.assertFalse(ok)

    def test_safe_extract_skips_traversal_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "slip.zip"
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("safe/ok.txt", "hello")
                zf.writestr("../outside.txt", "nope")
            extract = tmp_path / "out"
            result = safe_extract_zip(
                zip_path,
                extract,
                max_file_bytes=1024 * 1024,
                max_total_bytes=10 * 1024 * 1024,
            )
            self.assertTrue(result["ok"])
            self.assertTrue((extract / "safe" / "ok.txt").is_file())
            self.assertFalse((tmp_path / "outside.txt").exists())
            self.assertTrue(
                any(".." in (e.get("sourcePath") or "") for e in result["excluded"])
            )


class ClassificationTests(unittest.TestCase):
    def test_api_html(self):
        r = classify_file("Docs/api/DataGridColumnGroup.html")
        self.assertEqual(r.classification, "knowledge_target")
        self.assertEqual(r.parser, "html_api")

    def test_sample_html(self):
        r = classify_file("Samples/Column/Checkbox.html")
        self.assertEqual(r.classification, "knowledge_target")
        self.assertEqual(r.parser, "html_sample")

    def test_react_vue_sample(self):
        r = classify_file("React_Vue_Samples/React/Grid.html")
        self.assertEqual(r.parser, "html_sample")

    def test_license_key_excluded(self):
        r = classify_file("LicenseKey/key.txt")
        self.assertEqual(r.classification, "excluded")

    def test_min_js_excluded(self):
        r = classify_file("JS/rmate.min.js")
        self.assertEqual(r.classification, "excluded")

    def test_pdf_knowledge(self):
        r = classify_file("Docs/Manual.pdf")
        self.assertEqual(r.classification, "knowledge_target")
        self.assertEqual(r.parser, "docling_pdf")

    def test_license_review(self):
        r = classify_file("License.txt")
        self.assertEqual(r.classification, "review_target")


class HtmlApiParserTests(unittest.TestCase):
    def test_parses_title_sections_code(self):
        html = """
        <html><head><title>DataGridColumnGroup</title></head>
        <body>
          <h1>DataGridColumnGroup</h1>
          <h2>Properties</h2>
          <p>헤더 병합 column group property.</p>
          <table><tr><th>Name</th><th>Type</th></tr>
          <tr><td>headerText</td><td>String</td></tr></table>
          <h2>Example</h2>
          <pre><code class="language-xml">&lt;DataGridColumnGroup/&gt;</code></pre>
        </body></html>
        """
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "DataGridColumnGroup.html"
            path.write_text(html, encoding="utf-8")
            result = html_api.parse_api_html(
                path, "Docs/api/DataGridColumnGroup.html"
            )
        self.assertEqual(result["title"], "DataGridColumnGroup")
        self.assertEqual(result["sourcePath"], "Docs/api/DataGridColumnGroup.html")
        self.assertTrue(any(s["heading"] == "Properties" for s in result["sections"]))
        self.assertTrue(result["codeBlocks"])
        self.assertIn("DataGridColumnGroup", result["symbols"])
        # Navigation chrome should not dominate section content
        props = next(s for s in result["sections"] if s["heading"] == "Properties")
        self.assertNotIn("ArrayCollection Members length", props.get("content") or "")


class SampleHtmlParserTests(unittest.TestCase):
    def test_preserves_sample_name_and_code(self):
        html = """
        <html><head><title>Checkbox Column Sample</title>
        <meta name="description" content="체크박스 컬럼 예제"/>
        </head>
        <body>
          <script src="../JS/helper.js"></script>
          <script>
            var gridApp = "DataGrid";
            layoutURL = "layouts/checkbox.xml";
          </script>
          <textarea>&lt;DataGrid&gt;&lt;DataGridColumn dataField="flag"/&gt;&lt;/DataGrid&gt;</textarea>
        </body></html>
        """
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "Checkbox.html"
            path.write_text(html, encoding="utf-8")
            result = html_sample.parse_sample_html(
                path, "Samples/Column/Checkbox.html"
            )
        self.assertEqual(result["sampleName"], "Checkbox Column Sample")
        self.assertTrue(result["codeBlocks"])
        self.assertEqual(result["sourcePath"], "Samples/Column/Checkbox.html")
        related = result["relatedFiles"]
        self.assertTrue(any(r.endswith("helper.js") for r in related))
        self.assertTrue(any("checkbox.xml" in r for r in related))


class ChunkTraceTests(unittest.TestCase):
    def test_chunk_has_matching_trace(self):
        docs = [
            {
                "documentId": "rmate-grid-v6-docs-api-datagridcolumngroup",
                "sourcePath": "Docs/api/DataGridColumnGroup.html",
                "sourceType": "api_html",
                "title": "DataGridColumnGroup",
                "sections": [
                    {
                        "heading": "Properties",
                        "content": "DataGridColumnGroup related content",
                        "codeBlocks": [],
                    }
                ],
                "entities": [{"type": "component", "name": "DataGridColumnGroup"}],
                "codeBlocks": [],
                "metadata": {
                    "parser": "html_api",
                    "parserVersion": "0.1.0",
                    "symbols": ["DataGridColumnGroup"],
                    "keywords": ["header merge"],
                },
            }
        ]
        inv = {
            "Docs/api/DataGridColumnGroup.html": {
                "sha256": "abc123",
            }
        }
        chunks, traces = build_chunks_and_traces(docs, inv)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(len(traces), 1)
        self.assertEqual(chunks[0]["traceId"], traces[0]["traceId"])
        self.assertEqual(chunks[0]["chunkId"], traces[0]["chunkId"])
        self.assertEqual(traces[0]["sourceHash"], "abc123")
        self.assertEqual(traces[0]["parser"], "html_api")


class DoclingOptionalTests(unittest.TestCase):
    def test_html_still_works_without_docling(self):
        # Ensure pdf module reports skip when docling missing, while HTML parsers work
        available = pdf_docling.is_docling_available()
        with tempfile.TemporaryDirectory() as tmp:
            pdf_path = Path(tmp) / "manual.pdf"
            pdf_path.write_bytes(b"%PDF-1.4 fake")
            result = pdf_docling.parse_pdf(pdf_path, "Docs/manual.pdf")
            if not available:
                self.assertEqual(result["status"], "skipped")
                self.assertIn("docling", (result.get("skipReason") or "").lower())

            html = "<html><head><title>X</title></head><body><h1>X</h1><p>ok</p></body></html>"
            html_path = Path(tmp) / "X.html"
            html_path.write_text(html, encoding="utf-8")
            api = html_api.parse_api_html(html_path, "Docs/api/X.html")
            self.assertEqual(api["title"], "X")
            sample = html_sample.parse_sample_html(html_path, "Samples/X.html")
            self.assertEqual(sample["sampleName"], "X")

    def test_sections_from_markdown_filters_false_headings(self):
        md = """
# rMate Grid for HTML5 사용 설명서
## Version 6.0
소개 문단입니다.
## 1. 개요
개요 본문입니다. 충분한 내용을 포함합니다.
## 위 파일을 다음과 같이 html 파일에 설정합니다 .
이 문장은 헤딩이 아니라 본문이어야 합니다.
## 1.1. rMate Grid 의 주요 특징
특징 설명입니다.
## 12.
무시될 번호만 있는 헤딩
## <!-- image -->
""".strip()
        title, sections = pdf_docling._sections_from_markdown(md, "fallback.pdf")
        self.assertIn("사용 설명서", title)
        headings = [s["heading"] for s in sections]
        self.assertIn("1. 개요", headings)
        self.assertIn("1.1. rMate Grid 의 주요 특징", headings)
        self.assertNotIn("위 파일을 다음과 같이 html 파일에 설정합니다 .", headings)
        self.assertNotIn("12.", headings)
        overview = next(s for s in sections if s["heading"] == "1. 개요")
        self.assertIn("이 문장은 헤딩이 아니라 본문이어야 합니다", overview["content"])
        self.assertNotIn("<!-- image -->", overview["content"])


class EndToEndMiniZipTests(unittest.TestCase):
    def test_pipeline_on_mini_archive(self):
        from parse_archive import run_pipeline

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "mini.zip"
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr(
                    "Docs/api/DataGridColumnGroup.html",
                    """<html><head><title>DataGridColumnGroup</title></head>
                    <body><h1>DataGridColumnGroup</h1>
                    <h2>Properties</h2><p>헤더 병합</p>
                    <pre><code>columnGroup</code></pre>
                    </body></html>""",
                )
                zf.writestr(
                    "Samples/Column/Checkbox.html",
                    """<html><head><title>Checkbox Sample</title></head>
                    <body><script>var x = "DataGrid";</script>
                    <textarea>&lt;DataGrid/&gt;</textarea></body></html>""",
                )
                zf.writestr("LicenseKey/key.txt", "SECRET")
                zf.writestr("JS/lib.min.js", "/*! min */")
                zf.writestr("License.txt", "Copyright notice")

            out = tmp_path / "output"
            code = run_pipeline(
                {
                    "archivePath": str(zip_path),
                    "packName": "rMate Grid",
                    "productVersion": "v6.0",
                    "language": "ko",
                    "output": str(out),
                    "options": {
                        "parsePdf": True,
                        "parseApiHtml": True,
                        "parseSamples": True,
                        "maxFileBytes": 5_000_000,
                        "maxTotalBytes": 20_000_000,
                        "embedding": {
                            "mode": "deterministic_stub",
                            "dimension": 8,
                        },
                    },
                }
            )
            self.assertEqual(code, 0)
            for name in (
                "inventory.json",
                "normalized_documents.json",
                "chunks.json",
                "embeddings.json",
                "source_trace.json",
                "validation_report.json",
                "normalized_documents.md",
            ):
                self.assertTrue((out / name).is_file(), name)

            inventory = json.loads((out / "inventory.json").read_text(encoding="utf-8"))
            by_path = {e["sourcePath"]: e for e in inventory}
            self.assertEqual(by_path["LicenseKey/key.txt"]["classification"], "excluded")
            self.assertEqual(by_path["JS/lib.min.js"]["classification"], "excluded")
            for entry in inventory:
                self.assertIn("rawSourcePath", entry)
                self.assertIn("pathEncoding", entry)
                self.assertIn("pathDecoded", entry)

            chunks = json.loads((out / "chunks.json").read_text(encoding="utf-8"))
            traces = json.loads((out / "source_trace.json").read_text(encoding="utf-8"))
            self.assertTrue(chunks)
            self.assertEqual(len(chunks), len(traces))
            chunk_text = " ".join(c.get("content", "") for c in chunks)
            self.assertIn("DataGridColumnGroup", chunk_text)
            # LicenseKey must not appear as knowledge chunk
            self.assertFalse(
                any("LicenseKey" in (c.get("sourcePath") or "") for c in chunks)
            )

            embeddings = json.loads(
                (out / "embeddings.json").read_text(encoding="utf-8")
            )
            self.assertEqual(len(embeddings), len(chunks))
            chunk_ids = {c["chunkId"] for c in chunks}
            for emb in embeddings:
                self.assertIn(emb["chunkId"], chunk_ids)
                self.assertEqual(emb["dimension"], 8)
                self.assertEqual(len(emb["vector"]), 8)
                self.assertEqual(emb["provider"], "test-stub")
                self.assertTrue(all(isinstance(v, float) for v in emb["vector"]))

            report = json.loads(
                (out / "validation_report.json").read_text(encoding="utf-8")
            )
            self.assertEqual(report["totals"]["embeddings"], len(chunks))
            self.assertEqual(report["embedding"]["status"], "ok")
            self.assertEqual(report["embedding"]["embeddedChunks"], len(chunks))
            self.assertEqual(report["embedding"]["missingEmbeddings"], 0)
            self.assertEqual(report["embedding"]["mode"], "deterministic_stub")


class KoreanZipFilenameTests(unittest.TestCase):
    def test_decode_cp949_filename(self):
        unicode_path = "Docs/rMateGridH5_6.0_사용설명서.pdf"
        mojibake = unicode_path.encode("cp949").decode("cp437")
        info = zipfile.ZipInfo(filename=mojibake)
        info.flag_bits &= ~0x800
        decoded = decode_zip_filename(info)
        self.assertEqual(decoded.source_path, unicode_path)
        self.assertEqual(decoded.raw_source_path, mojibake)
        self.assertEqual(decoded.path_encoding, "cp949")
        self.assertTrue(decoded.path_decoded)

    def test_decode_utf8_flag_filename(self):
        unicode_path = "Docs/rMateGridH5_6.0_사용설명서.pdf"
        info = zipfile.ZipInfo(filename=unicode_path)
        info.flag_bits |= 0x800
        decoded = decode_zip_filename(info)
        self.assertEqual(decoded.source_path, unicode_path)
        self.assertEqual(decoded.path_encoding, "utf-8")
        self.assertTrue(decoded.path_decoded)

    def test_extract_cp949_korean_pdf_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "cp949.zip"
            unicode_path = "Docs/rMateGridH5_6.0_사용설명서.pdf"
            write_cp949_zip(zip_path, {unicode_path: b"%PDF-1.4 fake"})
            extract = tmp_path / "out"
            result = safe_extract_zip(
                zip_path,
                extract,
                max_file_bytes=1024 * 1024,
                max_total_bytes=10 * 1024 * 1024,
            )
            self.assertTrue(result["ok"])
            self.assertTrue(
                (extract / "Docs" / "rMateGridH5_6.0_사용설명서.pdf").is_file()
            )
            meta = result["pathMeta"][unicode_path]
            self.assertEqual(meta["pathEncoding"], "cp949")
            self.assertTrue(meta["pathDecoded"])
            self.assertNotEqual(meta["rawSourcePath"], unicode_path)

    def test_extract_utf8_korean_pdf_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "utf8.zip"
            unicode_path = "Docs/한글메뉴얼.pdf"
            with zipfile.ZipFile(zip_path, "w") as zf:
                _write_utf8_zip_entry(zf, unicode_path, b"%PDF-1.4 fake")
            extract = tmp_path / "out"
            result = safe_extract_zip(
                zip_path,
                extract,
                max_file_bytes=1024 * 1024,
                max_total_bytes=10 * 1024 * 1024,
            )
            self.assertTrue(result["ok"])
            self.assertTrue((extract / "Docs" / "한글메뉴얼.pdf").is_file())
            meta = result["pathMeta"][unicode_path]
            self.assertEqual(meta["pathEncoding"], "utf-8")

    def test_cp949_zip_slip_blocked_on_decoded_and_raw(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "slip_ko.zip"
            write_cp949_zip(
                zip_path,
                {
                    "safe/ok.txt": b"ok",
                    "../탈출.txt": b"nope",
                },
            )
            extract = tmp_path / "out"
            result = safe_extract_zip(
                zip_path,
                extract,
                max_file_bytes=1024 * 1024,
                max_total_bytes=10 * 1024 * 1024,
            )
            self.assertTrue(result["ok"])
            self.assertTrue((extract / "safe" / "ok.txt").is_file())
            self.assertFalse((tmp_path / "탈출.txt").exists())
            self.assertTrue(
                any(
                    ".." in (e.get("sourcePath") or "")
                    or ".." in (e.get("rawSourcePath") or "")
                    for e in result["excluded"]
                )
            )

    def test_artifact_basename_keeps_hangul_without_mojibake(self):
        name = safe_artifact_basename(
            kind="pdf",
            index=1,
            source_path="Docs/rMateGridH5_6.0_사용설명서.pdf",
        )
        self.assertTrue(name.startswith("pdf_001_"))
        self.assertIn("사용설명서", name)
        self.assertNotRegex(name, r"[<>:\"/\\|?*]")
        # Must not look like classic CP437 mojibake of Hangul
        self.assertNotIn("τ", name)
        self.assertTrue(name.endswith(".json"))

    def test_pipeline_inventory_preserves_korean_source_path(self):
        from parse_archive import run_pipeline

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "ko.zip"
            pdf_path = "Docs/rMateGridH5_6.0_사용설명서.pdf"
            api_path = "Docs/api/DataGrid.html"
            write_cp949_zip(
                zip_path,
                {
                    pdf_path: b"%PDF-1.4 fake",
                    api_path: (
                        "<html><head><title>DataGrid</title></head>"
                        "<body><h1>DataGrid</h1><p>grid</p></body></html>"
                    ),
                },
            )
            out = tmp_path / "output"
            code = run_pipeline(
                {
                    "archivePath": str(zip_path),
                    "packName": "rMate Grid",
                    "productVersion": "v6.0",
                    "language": "ko",
                    "output": str(out),
                    "options": {
                        "parsePdf": True,
                        "parseApiHtml": True,
                        "parseSamples": True,
                        "maxFileBytes": 5_000_000,
                        "maxTotalBytes": 20_000_000,
                        "embedding": {
                            "mode": "deterministic_stub",
                            "dimension": 8,
                        },
                    },
                }
            )
            self.assertEqual(code, 0)
            inventory = json.loads((out / "inventory.json").read_text(encoding="utf-8"))
            pdf_entry = next(e for e in inventory if e["sourcePath"] == pdf_path)
            self.assertEqual(pdf_entry["pathEncoding"], "cp949")
            self.assertTrue(pdf_entry["pathDecoded"])
            self.assertIn("사용설명서", pdf_entry["sourcePath"])
            self.assertNotEqual(pdf_entry["rawSourcePath"], pdf_entry["sourcePath"])

            docs = json.loads(
                (out / "normalized_documents.json").read_text(encoding="utf-8")
            )
            # PDF may be skipped/failed without real PDF bytes when docling is installed
            api_docs = [d for d in docs if d["sourcePath"] == api_path]
            self.assertTrue(api_docs)

            pdf_artifacts = list((out / "parser_artifacts" / "pdf").glob("*.json"))
            for art in pdf_artifacts:
                self.assertNotIn("τ", art.name)
                self.assertRegex(art.name, r"^pdf_\d{3}_")
                payload = json.loads(art.read_text(encoding="utf-8"))
                self.assertEqual(payload["sourcePath"], pdf_path)


class EmbeddingTests(unittest.TestCase):
    def _chunks(self, n: int) -> list[dict]:
        return [
            {
                "chunkId": f"chunk-{i:03d}",
                "title": f"Title {i}",
                "content": f"Body content {i}",
                "section": "Overview",
                "keywords": ["grid", "column"],
                "symbols": ["DataGrid"],
                "traceId": f"trace-{i:03d}",
            }
            for i in range(n)
        ]

    def test_stub_mode_one_embedding_per_chunk(self):
        cfg = resolve_embedding_config(
            {"mode": "deterministic_stub", "dimension": 8}, {}
        )
        chunks = self._chunks(3)
        embeddings = build_embeddings(chunks, cfg)
        self.assertEqual(len(embeddings), len(chunks))
        chunk_ids = {c["chunkId"] for c in chunks}
        for emb in embeddings:
            self.assertIn(emb["chunkId"], chunk_ids)
            self.assertEqual(emb["dimension"], 8)
            self.assertEqual(len(emb["vector"]), 8)
            self.assertEqual(emb["provider"], "test-stub")

    def test_stub_mode_is_deterministic(self):
        cfg = resolve_embedding_config(
            {"mode": "deterministic_stub", "dimension": 8}, {}
        )
        chunks = self._chunks(2)
        first = build_embeddings(chunks, cfg)
        second = build_embeddings(chunks, cfg)
        self.assertEqual(
            [e["vector"] for e in first], [e["vector"] for e in second]
        )

    def test_empty_chunks_yield_empty_embeddings(self):
        cfg = resolve_embedding_config({"mode": "deterministic_stub"}, {})
        self.assertEqual(build_embeddings([], cfg), [])

    def test_write_embeddings_creates_file_for_empty_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "embeddings.json"
            write_embeddings([], path)
            self.assertTrue(path.is_file())
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), [])

    def test_write_embeddings_rejects_non_finite(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "embeddings.json"
            bad = [{"chunkId": "x", "vector": [float("inf")]}]
            with self.assertRaises(ValueError):
                write_embeddings(bad, path)

    def test_unknown_mode_raises(self):
        with self.assertRaises(EmbeddingError):
            resolve_embedding_config({"mode": "bogus"}, {})

    def test_env_default_mode(self):
        cfg = resolve_embedding_config(
            {}, {"JYKSTORE_PYTHON_WORKER_EMBEDDING_MODE": "deterministic_stub"}
        )
        self.assertEqual(cfg["mode"], "deterministic_stub")

    def test_content_hash_ignores_keywords_and_symbols(self):
        base = {
            "title": "Grid",
            "content": "Grid API overview",
            "section": "Overview",
            "tags": ["grid", "column"],
            "keywords": ["grid", "column"],
            "symbols": ["DataGrid"],
        }
        changed = {
            **base,
            "keywords": ["totally", "different"],
            "symbols": ["OtherSymbol", "More"],
        }
        self.assertEqual(build_content_hash(base), build_content_hash(changed))

    def test_content_hash_is_tag_order_independent(self):
        a = {"title": "T", "content": "C", "section": "S", "tags": ["b", "a"]}
        b = {"title": "T", "content": "C", "section": "S", "tags": ["a", "b"]}
        self.assertEqual(build_content_hash(a), build_content_hash(b))

    def test_content_hash_changes_with_content_fields(self):
        base = {"title": "T", "content": "C", "section": "S", "tags": ["a"]}
        for field, value in (
            ("title", "T2"),
            ("content", "C2"),
            ("section", "S2"),
            ("tags", ["a", "z"]),
        ):
            changed = {**base, field: value}
            self.assertNotEqual(
                build_content_hash(base), build_content_hash(changed), field
            )

    def test_content_hash_uses_keywords_as_tags_when_no_tags_field(self):
        # When no explicit tags field, keywords are the tag source (import mapping).
        with_keywords = {
            "title": "T",
            "content": "C",
            "section": "S",
            "keywords": ["a", "b"],
        }
        with_tags = {"title": "T", "content": "C", "section": "S", "tags": ["a", "b"]}
        self.assertEqual(
            build_content_hash(with_keywords), build_content_hash(with_tags)
        )

    def test_passage_text_matches_store_order(self):
        chunk = {
            "title": "Grid",
            "section": "Overview",
            "keywords": ["grid", "column"],
            "content": "Body",
        }
        text = build_passage_text(chunk)
        self.assertTrue(text.startswith("passage: "))
        self.assertEqual(text, "passage: Grid\nOverview\ngrid\ncolumn\nBody")

    def test_local_e5_requires_model_path(self):
        cfg = resolve_embedding_config({"mode": "local_e5"}, {})
        chunks = self._chunks(1)
        with self.assertRaises(EmbeddingError) as ctx:
            build_embeddings(chunks, cfg)
        self.assertIn("modelPath", str(ctx.exception))

    def test_local_e5_nonexistent_model_path_fails(self):
        cfg = resolve_embedding_config(
            {"mode": "local_e5", "modelPath": "C:/definitely/not/here/model"}, {}
        )
        chunks = self._chunks(1)
        with self.assertRaises(EmbeddingError) as ctx:
            build_embeddings(chunks, cfg)
        self.assertIn("does not exist", str(ctx.exception))

    def test_local_e5_model_path_file_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            model_file = Path(tmp) / "model.bin"
            model_file.write_bytes(b"not a directory")
            cfg = resolve_embedding_config(
                {"mode": "local_e5", "modelPath": str(model_file)}, {}
            )
            with self.assertRaises(EmbeddingError) as ctx:
                build_embeddings(self._chunks(1), cfg)
            self.assertIn("directory", str(ctx.exception))

    def test_passage_text_prefers_explicit_tags(self):
        chunk = {
            "title": "T",
            "section": "S",
            "tags": ["x", "y"],
            "keywords": ["a", "b"],
            "content": "C",
        }
        self.assertEqual(build_passage_text(chunk), "passage: T\nS\nx\ny\nC")

    def test_passage_text_falls_back_to_keywords(self):
        chunk = {"title": "T", "section": "S", "keywords": ["a", "b"], "content": "C"}
        self.assertEqual(build_passage_text(chunk), "passage: T\nS\na\nb\nC")

    def test_token_limit_exceeded_raises(self):
        cfg = resolve_embedding_config(
            {"mode": "deterministic_stub", "dimension": 8}, {}
        )
        big = {
            "chunkId": "big-001",
            "title": "T",
            "content": "a" * 3000,  # ~750 estimated tokens > 512
            "section": "S",
            "keywords": [],
            "traceId": "trace-big",
        }
        with self.assertRaises(EmbeddingError) as ctx:
            build_embeddings([big], cfg)
        self.assertIn("token limit", str(ctx.exception))

    def test_pipeline_writes_embeddings_json_on_failure(self):
        from parse_archive import run_pipeline

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            zip_path = tmp_path / "mini.zip"
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr(
                    "Docs/api/DataGrid.html",
                    "<html><head><title>DataGrid</title></head>"
                    "<body><h1>DataGrid</h1><h2>Properties</h2>"
                    "<p>grid content</p></body></html>",
                )
            out = tmp_path / "output"
            code = run_pipeline(
                {
                    "archivePath": str(zip_path),
                    "packName": "rMate Grid",
                    "productVersion": "v6.0",
                    "language": "ko",
                    "output": str(out),
                    "options": {
                        "parsePdf": False,
                        "parseApiHtml": True,
                        "parseSamples": True,
                        "maxFileBytes": 5_000_000,
                        "maxTotalBytes": 20_000_000,
                        # local_e5 without modelPath -> embedding generation fails
                        "embedding": {"mode": "local_e5"},
                    },
                }
            )
            self.assertEqual(code, 1)
            self.assertTrue((out / "embeddings.json").is_file())
            self.assertEqual(
                json.loads((out / "embeddings.json").read_text(encoding="utf-8")), []
            )
            report = json.loads(
                (out / "validation_report.json").read_text(encoding="utf-8")
            )
            self.assertEqual(report["embedding"]["status"], "failed")
            self.assertTrue(
                any("embedding generation failed" in e for e in report["errors"])
            )


if __name__ == "__main__":
    unittest.main()

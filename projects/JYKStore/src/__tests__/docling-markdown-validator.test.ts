import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCLING_MARKDOWN_VALIDATOR_VERSION,
  sanitizeMarkdownForPreview,
  validateDoclingMarkdown,
  validateDoclingMarkdownPreview,
} from "../lib/adapters/docling/docling-markdown-validator.ts";

describe("docling-markdown-validator (soft auxiliary)", () => {
  it("exports validator version 3.0.0", () => {
    assert.equal(DOCLING_MARKDOWN_VALIDATOR_VERSION, "3.0.0");
  });

  it("treats missing markdown as available=false without ERROR", () => {
    const result = validateDoclingMarkdown({ markdown: null });
    assert.equal(result.ok, true);
    assert.equal(result.available, false);
    assert.equal(result.previewAvailable, false);
    assert.equal(result.warnings.length, 0);
    assert.ok(!result.issues.some((i) => i.severity === "ERROR"));
  });

  it("warns on empty markdown without blocking", () => {
    const result = validateDoclingMarkdown({ markdown: "  \n\t  " });
    assert.equal(result.ok, true);
    assert.equal(result.available, true);
    assert.equal(result.previewAvailable, false);
    assert.ok(result.warnings.some((i) => i.code === "DOCLING_MARKDOWN_EMPTY"));
    assert.ok(result.warnings.every((i) => i.severity === "WARNING"));
  });

  it("warns on invalid UTF-8 without blocking", () => {
    const result = validateDoclingMarkdown({
      markdown: new Uint8Array([0xff, 0xfe, 0xfd]),
    });
    assert.equal(result.ok, true);
    assert.ok(
      result.warnings.some(
        (i) => i.code === "DOCLING_MARKDOWN_INVALID_ENCODING",
      ),
    );
  });

  it("accepts content without semantic JSON comparison", () => {
    const result = validateDoclingMarkdown({
      markdown: "# Sample\n\nHello world sample content\n",
    });
    assert.equal(result.ok, true);
    assert.equal(result.available, true);
    assert.equal(result.previewAvailable, true);
    assert.equal(result.validatorVersion, "3.0.0");
    assert.equal(result.metrics, null);
  });

  it("does not ERROR on unrelated content (no Jaccard gate)", () => {
    const result = validateDoclingMarkdown({
      markdown: "Completely unrelated quantum banana robotics xyzzy",
    });
    assert.equal(result.ok, true);
    assert.ok(
      !result.issues.some(
        (i) =>
          i.code === "DOCLING_JSON_MARKDOWN_MISMATCH" ||
          i.code === "DOCLING_JSON_MARKDOWN_LOW_COVERAGE" ||
          i.code === "DOCLING_JSON_MARKDOWN_INCONCLUSIVE",
      ),
    );
  });

  it("soft preview path warns on empty / bad encoding", () => {
    const empty = validateDoclingMarkdownPreview({
      textPreview: "",
      encodingOk: true,
      empty: true,
      byteLength: 0,
    });
    assert.equal(empty.ok, true);
    assert.ok(empty.warnings.some((i) => i.code === "DOCLING_MARKDOWN_EMPTY"));

    const badUtf8 = validateDoclingMarkdownPreview({
      textPreview: "",
      encodingOk: false,
      empty: false,
      byteLength: 3,
    });
    assert.equal(badUtf8.ok, true);
    assert.ok(
      badUtf8.warnings.some(
        (i) => i.code === "DOCLING_MARKDOWN_INVALID_ENCODING",
      ),
    );
  });

  it("sanitizeMarkdownForPreview strips script tags", () => {
    const dirty =
      'Hello <script>alert("x")</script> world <img src=x onerror="alert(1)">';
    const clean = sanitizeMarkdownForPreview(dirty);
    assert.equal(clean.includes("<script"), false);
    assert.equal(clean.includes("alert"), false);
    assert.equal(clean.toLowerCase().includes("onerror"), false);
    assert.ok(clean.includes("Hello"));
    assert.ok(clean.includes("world"));
  });
});

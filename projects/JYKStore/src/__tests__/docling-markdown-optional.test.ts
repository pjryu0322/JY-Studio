import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateDoclingMarkdown,
  validateDoclingMarkdownPreview,
} from "../lib/adapters/docling/docling-markdown-validator.ts";

describe("docling markdown optional / auxiliary policy", () => {
  it("no MD → warning-free soft result (does not block)", () => {
    const result = validateDoclingMarkdown({ markdown: null });
    assert.equal(result.ok, true);
    assert.equal(result.available, false);
    assert.equal(result.warnings.length, 0);
    assert.equal(result.previewAvailable, false);
  });

  it("empty MD → WARNING only", () => {
    const result = validateDoclingMarkdown({ markdown: "\n\n" });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.code === "DOCLING_MARKDOWN_EMPTY"));
    assert.ok(!result.issues.some((i) => i.severity === "ERROR"));
  });

  it("utf8 / encoding issues → WARNING only", () => {
    const result = validateDoclingMarkdown({
      markdown: new Uint8Array([0xc3, 0x28]),
    });
    assert.equal(result.ok, true);
    assert.ok(
      result.warnings.some(
        (w) => w.code === "DOCLING_MARKDOWN_INVALID_ENCODING",
      ),
    );
  });

  it("unrelated MD does not ERROR (no semantic gate)", () => {
    const result = validateDoclingMarkdown({
      markdown:
        "Totally different document about aerospace and culinary science.",
    });
    assert.equal(result.ok, true);
    assert.equal(result.available, true);
    assert.ok(
      !result.issues.some((i) =>
        String(i.code).includes("JSON_MARKDOWN"),
      ),
    );
  });

  it("preview API mirrors soft policy", () => {
    const result = validateDoclingMarkdownPreview({
      textPreview: "Preview body",
      encodingOk: true,
      empty: false,
      byteLength: 12,
    });
    assert.equal(result.ok, true);
    assert.equal(result.available, true);
    assert.equal(result.previewAvailable, true);
    assert.ok(!result.issues.some((i) => i.severity === "ERROR"));
  });
});

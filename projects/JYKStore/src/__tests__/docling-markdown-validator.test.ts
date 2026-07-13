import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sanitizeMarkdownForPreview,
  validateDoclingMarkdown,
} from "../lib/adapters/docling/docling-markdown-validator.ts";
import type { DoclingDocument } from "../lib/adapters/docling/docling-types.ts";

const DOC: DoclingDocument = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Sample",
  origin: { filename: "sample.pdf", mimetype: "application/pdf" },
  body: { children: [], self_ref: "#/body" },
  texts: [
    {
      self_ref: "#/texts/0",
      text: "Hello world sample content",
      label: "paragraph",
    },
  ],
  tables: [],
  pictures: [],
};

describe("docling-markdown-validator", () => {
  it("accepts matching markdown", () => {
    const result = validateDoclingMarkdown({
      markdown: "# Sample\n\nHello world sample content\n",
      document: DOC,
    });
    assert.equal(result.ok, true);
    assert.ok((result.similarity ?? 0) > 0.15);
  });

  it("requires markdown", () => {
    const result = validateDoclingMarkdown({ markdown: null });
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.code === "DOCLING_MARKDOWN_REQUIRED"),
    );
  });

  it("rejects empty markdown", () => {
    const result = validateDoclingMarkdown({ markdown: "  \n\t  " });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "DOCLING_MARKDOWN_EMPTY"));
  });

  it("rejects invalid UTF-8 bytes", () => {
    const result = validateDoclingMarkdown({
      markdown: new Uint8Array([0xff, 0xfe, 0xfd]),
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some(
        (i) => i.code === "DOCLING_MARKDOWN_INVALID_ENCODING",
      ),
    );
  });

  it("errors on near-zero JSON/markdown similarity", () => {
    const result = validateDoclingMarkdown({
      markdown: "Completely unrelated quantum banana robotics xyzzy",
      document: DOC,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some(
        (i) =>
          i.code === "DOCLING_JSON_MARKDOWN_MISMATCH" &&
          i.severity === "ERROR",
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

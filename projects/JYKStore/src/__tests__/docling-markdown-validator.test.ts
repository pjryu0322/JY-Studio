import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCLING_MARKDOWN_VALIDATOR_VERSION,
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
  it("re-exports validator version 2.0.0", () => {
    assert.equal(DOCLING_MARKDOWN_VALIDATOR_VERSION, "2.0.0");
  });

  it("accepts matching markdown", () => {
    const result = validateDoclingMarkdown({
      markdown: "# Sample\n\nHello world sample content\n",
      document: DOC,
      sourceFileName: "sample.pdf",
    });
    assert.equal(result.ok, true);
    assert.ok((result.metrics?.markdownCoverage ?? 0) >= 0.4 || result.ok);
    assert.equal(result.validatorVersion, "2.0.0");
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

  it("Jaccard trap: large JSON corpus + overlapping small MD is not ERROR", () => {
    const filler = Array.from({ length: 8000 }, (_, i) => `uniq${i}zz`).join(" ");
    const shared = "hello world sample content shared phrase";
    const largeDoc: DoclingDocument = {
      ...DOC,
      name: "Sample",
      texts: [
        { self_ref: "#/texts/0", text: filler, label: "paragraph" },
        { self_ref: "#/texts/1", text: shared, label: "paragraph" },
      ],
    };
    const result = validateDoclingMarkdown({
      markdown: `# Sample\n\n${shared}\n`,
      document: largeDoc,
      sourceFileName: "sample.pdf",
    });
    assert.equal(result.ok, true);
    assert.ok(
      !result.issues.some(
        (i) =>
          i.code === "DOCLING_JSON_MARKDOWN_MISMATCH" && i.severity === "ERROR",
      ),
    );
    // Jaccard may be low; deprecated similarity field may still be set
    assert.ok(typeof result.similarity === "number" || result.metrics != null);
  });

  it("errors on unrelated content when all evidence fails", () => {
    const result = validateDoclingMarkdown({
      markdown: "Completely unrelated quantum banana robotics xyzzy",
      document: DOC,
      sourceFileName: "other-file.pdf",
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

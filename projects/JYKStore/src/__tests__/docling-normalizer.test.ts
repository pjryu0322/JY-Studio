import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { doclingAdapter } from "../lib/adapters/docling/docling-adapter.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import type { DoclingDocument } from "../lib/adapters/docling/docling-types.ts";
import { evaluateNormalizedDocumentQuality } from "../lib/docling-import/docling-quality-gate.ts";
import { sanitizeMarkdownForPreview } from "../lib/adapters/docling/docling-markdown-validator.ts";
import { buildStructureSummary } from "../lib/docling-import/structure-summary.ts";

const MINIMAL_DOCLING: DoclingDocument = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Sample",
  origin: { filename: "sample.pdf", mimetype: "application/pdf" },
  body: {
    children: [{ $ref: "#/texts/0" }, { $ref: "#/tables/0" }],
    self_ref: "#/body",
  },
  texts: [
    {
      self_ref: "#/texts/0",
      text: "Hello world sample content",
      label: "paragraph",
    },
  ],
  tables: [
    {
      self_ref: "#/tables/0",
      label: "table",
      caption: "Sample table",
      data: { grid: [["a", "b"]] },
    },
  ],
  pictures: [
    {
      self_ref: "#/pictures/0",
      label: "picture",
      caption: "A figure",
    },
  ],
  groups: [
    {
      self_ref: "#/groups/0",
      name: "Intro",
      label: "section",
      children: [{ $ref: "#/texts/0" }],
    },
  ],
};

/** Fixture matching production failure mode: group/list headings, no body, empty reading order. */
const POOR_QUALITY_DOCLING: DoclingDocument = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Poor Doc",
  texts: [
    { self_ref: "#/texts/0", text: "group", label: "group" },
    { self_ref: "#/texts/1", text: "list", label: "list" },
  ],
  groups: [
    {
      self_ref: "#/groups/0",
      name: "group",
      label: "group",
      children: [],
    },
  ],
  tables: [
    {
      self_ref: "#/tables/0",
      label: "table",
      data: { bbox: { l: 0, t: 0, r: 1, b: 1 }, coord_origin: "BOTTOMLEFT" },
    },
  ],
  pictures: [{ self_ref: "#/pictures/0", label: "picture" }],
  body: { children: [], self_ref: "#/body" },
};

const GOOD_QUALITY_DOCLING: DoclingDocument = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Good Doc",
  origin: { filename: "good.pdf", mimetype: "application/pdf" },
  body: {
    self_ref: "#/body",
    children: [
      { $ref: "#/texts/0" },
      { $ref: "#/texts/1" },
      { $ref: "#/tables/0" },
      { $ref: "#/pictures/0" },
    ],
  },
  texts: [
    {
      self_ref: "#/texts/0",
      text: "정보시스템 감리 개요",
      label: "section_header",
      prov: [{ page_no: 1 }],
    },
    {
      self_ref: "#/texts/1",
      text: "본문은 감리 절차를 설명합니다.",
      label: "paragraph",
      prov: [{ page_no: 2 }],
    },
  ],
  tables: [
    {
      self_ref: "#/tables/0",
      label: "table",
      caption: "점검 항목 표",
      data: { grid: [["항목", "기준"], ["가용성", "충족"]] },
      prov: [{ page_no: 3 }],
    },
  ],
  pictures: [
    {
      self_ref: "#/pictures/0",
      label: "picture",
      caption: "구성도",
      prov: [{ page_no: 4 }],
    },
  ],
  groups: [],
};

describe("docling-normalizer", () => {
  it("extracts title, body sections, tables, figures, and reading order", () => {
    const draft = normalizeDoclingDocument(MINIMAL_DOCLING, {
      files: {
        sourceFileId: "file_source",
        jsonPayloadFileId: "file_json",
        markdownPayloadFileId: "file_md",
      },
    });

    assert.equal(draft.title, "sample");
    assert.equal(draft.adapter.type, "DOCLING");
    assert.ok(draft.sections.some((s) => s.text?.includes("Hello world")));
    assert.ok(!draft.sections.some((s) => s.title === "Intro"));
    assert.equal(draft.tables.length, 1);
    assert.equal(draft.figures.length, 1);
    assert.ok(draft.readingOrder.length >= 1);
  });

  it("falls back to first heading when name is absent", () => {
    const doc: DoclingDocument = {
      ...MINIMAL_DOCLING,
      name: undefined,
      texts: [
        {
          self_ref: "#/texts/0",
          text: "Heading One",
          label: "section_header",
        },
      ],
      groups: [],
    };
    const draft = normalizeDoclingDocument(doc);
    assert.equal(draft.title, "Heading One");
  });

  it("does not treat group/list labels as headings", () => {
    const draft = normalizeDoclingDocument(POOR_QUALITY_DOCLING);
    const summary = buildStructureSummary({
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
    });
    assert.equal(summary.headingCount, 0);
    assert.equal(summary.paragraphCount, 0);
  });

  it("builds reading order fallback when body.children empty but content exists", () => {
    const doc: DoclingDocument = {
      ...GOOD_QUALITY_DOCLING,
      body: { children: [], self_ref: "#/body" },
    };
    const draft = normalizeDoclingDocument(doc);
    assert.ok(draft.readingOrder.length > 0);
  });

  it("adapter normalize succeeds for valid 3-file input", async () => {
    const draft = await doclingAdapter.normalize({
      json: JSON.stringify(MINIMAL_DOCLING),
      markdown: "# Sample\n\nHello world sample content\n",
      source: { filename: "sample.pdf", mimetype: "application/pdf" },
      files: { sourceFileId: "s1", jsonPayloadFileId: "j1", markdownPayloadFileId: "m1" },
    });
    assert.equal(draft.title, "sample");
  });
});

describe("docling quality gate", () => {
  it("blocks empty body and reading order", () => {
    const draft = normalizeDoclingDocument(POOR_QUALITY_DOCLING);
    // Force empty reading order to match legacy failure shape.
    draft.readingOrder = [];
    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: null,
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [
        { role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
        { role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
      ],
      markdownPreview: sanitizeMarkdownForPreview("ok"),
      hasNormalizedDocument: true,
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.blockers.some((b) => b.code === "NORMALIZED_BODY_EMPTY"));
    assert.ok(gate.blockers.some((b) => b.code === "READING_ORDER_EMPTY"));
  });

  it("passes for good document", () => {
    const draft = normalizeDoclingDocument(GOOD_QUALITY_DOCLING);
    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [
        { role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
        { role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
        { role: "DOCLING_MARKDOWN", checksumSha256: "c".repeat(64) },
      ],
      markdownPreview: sanitizeMarkdownForPreview("# title\n\nbody"),
      hasNormalizedDocument: true,
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.blockers.length, 0);
  });

  it("strips base64 from markdown preview", () => {
    const dirty =
      "hello ![img](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==) world";
    const clean = sanitizeMarkdownForPreview(dirty);
    assert.ok(!/data:image/i.test(clean));
    assert.ok(!/base64/i.test(clean));
    assert.ok(clean.includes("[이미지 데이터 생략]"));
  });
});

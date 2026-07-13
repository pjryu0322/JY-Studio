import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { doclingAdapter } from "../lib/adapters/docling/docling-adapter.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import type { DoclingDocument } from "../lib/adapters/docling/docling-types.ts";

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

describe("docling-normalizer", () => {
  it("extracts title, sections, tables, figures, and reading order", () => {
    const draft = normalizeDoclingDocument(MINIMAL_DOCLING, {
      files: {
        sourceFileId: "file_source",
        jsonPayloadFileId: "file_json",
        markdownPayloadFileId: "file_md",
      },
    });

    assert.equal(draft.title, "Sample");
    assert.equal(draft.adapter.type, "DOCLING");
    assert.equal(draft.adapter.version, "1.0.0");
    assert.equal(draft.adapter.sourceSchema, "DoclingDocument");
    assert.equal(draft.adapter.sourceSchemaVersion, "1.10.0");
    assert.equal(draft.files.sourceFileId, "file_source");
    assert.ok(draft.sections.length >= 1);
    assert.equal(draft.sections[0]?.title, "Intro");
    assert.equal(draft.tables.length, 1);
    assert.equal(draft.tables[0]?.caption, "Sample table");
    assert.equal(draft.figures.length, 1);
    assert.equal(draft.figures[0]?.caption, "A figure");
    assert.equal(draft.readingOrder.length, 2);
    assert.equal(draft.readingOrder[0]?.ref, "#/texts/0");
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

  it("adapter normalize succeeds for valid 3-file input", async () => {
    const draft = await doclingAdapter.normalize({
      json: JSON.stringify(MINIMAL_DOCLING),
      markdown: "# Sample\n\nHello world sample content\n",
      source: { filename: "sample.pdf", mimetype: "application/pdf" },
      files: { sourceFileId: "s1", jsonPayloadFileId: "j1", markdownPayloadFileId: "m1" },
    });
    assert.equal(draft.title, "Sample");
    assert.equal(draft.adapter.version, "1.0.0");
  });
});

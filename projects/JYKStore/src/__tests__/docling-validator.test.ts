import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDoclingJson } from "../lib/adapters/docling/docling-validator.ts";

const MINIMAL_DOCLING = {
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

describe("docling-validator", () => {
  it("accepts a minimal valid DoclingDocument", () => {
    const result = validateDoclingJson({
      json: JSON.stringify(MINIMAL_DOCLING),
      source: {
        filename: "sample.pdf",
        mimetype: "application/pdf",
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.document?.schema_name, "DoclingDocument");
    assert.equal(result.issues.filter((i) => i.severity === "ERROR").length, 0);
  });

  it("requires JSON payload", () => {
    const result = validateDoclingJson({ json: null });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "DOCLING_JSON_REQUIRED"));
  });

  it("rejects empty JSON", () => {
    const result = validateDoclingJson({ json: "   " });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "DOCLING_JSON_EMPTY"));
  });

  it("rejects invalid JSON parse", () => {
    const result = validateDoclingJson({ json: "{not-json" });
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.code === "DOCLING_JSON_PARSE_FAILED"),
    );
  });

  it("rejects wrong schema_name", () => {
    const result = validateDoclingJson({
      json: JSON.stringify({ ...MINIMAL_DOCLING, schema_name: "Other" }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "DOCLING_SCHEMA_INVALID"));
  });

  it("requires version, origin, and body", () => {
    const result = validateDoclingJson({
      json: JSON.stringify({
        schema_name: "DoclingDocument",
      }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "DOCLING_VERSION_REQUIRED"));
    assert.ok(result.issues.some((i) => i.code === "DOCLING_ORIGIN_REQUIRED"));
    assert.ok(result.issues.some((i) => i.code === "DOCLING_BODY_REQUIRED"));
  });

  it("warns when name is missing instead of hard-failing", () => {
    const withoutName = { ...MINIMAL_DOCLING };
    delete (withoutName as { name?: string }).name;
    const result = validateDoclingJson({
      json: JSON.stringify(withoutName),
    });
    assert.equal(result.ok, true);
    assert.ok(
      result.issues.some(
        (i) => i.severity === "WARNING" && i.field === "name",
      ),
    );
  });

  it("warns on unknown body child refs", () => {
    const doc = {
      ...MINIMAL_DOCLING,
      body: {
        self_ref: "#/body",
        children: [{ $ref: "#/texts/99" }],
      },
    };
    const result = validateDoclingJson({ json: JSON.stringify(doc) });
    assert.ok(
      result.issues.some(
        (i) =>
          i.code === "DOCLING_REFERENCE_INVALID" && i.severity === "WARNING",
      ),
    );
  });

  it("requires origin.filename and origin.mimetype", () => {
    const result = validateDoclingJson({
      json: JSON.stringify({
        ...MINIMAL_DOCLING,
        origin: {},
      }),
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.code === "DOCLING_ORIGIN_FILENAME_REQUIRED"),
    );
    assert.ok(
      result.issues.some((i) => i.code === "DOCLING_ORIGIN_MIMETYPE_REQUIRED"),
    );
  });
});

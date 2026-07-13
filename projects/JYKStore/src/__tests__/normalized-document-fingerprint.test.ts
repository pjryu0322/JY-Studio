import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNormalizedDocumentFingerprintPayload,
  canonicalJsonStringify,
  computeNormalizedDocumentFingerprint,
  NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
} from "../lib/docling-import/normalized-document-fingerprint.ts";

describe("normalized-document-fingerprint", () => {
  const base = {
    adapterType: "DOCLING",
    adapterVersion: "1.0.0",
    sourceSchemaName: "DoclingDocument",
    sourceSchemaVersion: "1.10.0",
    title: "T",
    language: "ko",
    sections: [{ id: "s1", title: "A" }],
    tables: [],
    figures: [],
    readingOrder: ["s1"],
    warnings: [{ code: "W" }],
    sourceFileId: "src",
    jsonPayloadFileId: "json",
    markdownPayloadFileId: "md",
    sourceChecksum: "aa",
    jsonChecksum: "bb",
    markdownChecksum: "cc",
  };

  it("exports fingerprint version v2", () => {
    assert.equal(NORMALIZED_DOCUMENT_FINGERPRINT_VERSION, "normalized-document-v2");
  });

  it("canonicalJson sorts object keys and drops undefined", () => {
    const a = canonicalJsonStringify({ b: 1, a: 2, skip: undefined, keep: null });
    const b = canonicalJsonStringify({ a: 2, keep: null, b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":2,"b":1,"keep":null}');
  });

  it("preserves array order", () => {
    assert.notEqual(
      canonicalJsonStringify([1, 2, 3]),
      canonicalJsonStringify([3, 2, 1]),
    );
  });

  it("is stable for key-order-only differences", () => {
    const left = computeNormalizedDocumentFingerprint({
      ...base,
      sections: [{ title: "A", id: "s1" }],
    });
    const right = computeNormalizedDocumentFingerprint({
      ...base,
      sections: [{ id: "s1", title: "A" }],
    });
    assert.equal(left, right);
  });

  it("changes when structure changes", () => {
    const left = computeNormalizedDocumentFingerprint(base);
    const right = computeNormalizedDocumentFingerprint({
      ...base,
      title: "Other",
    });
    assert.notEqual(left, right);
  });

  it("includes required fields in payload", () => {
    const payload = buildNormalizedDocumentFingerprintPayload(base);
    assert.equal(payload.adapterVersion, "1.0.0");
    assert.ok(payload.checksums);
  });
});

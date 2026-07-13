import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchOriginToSource,
  normalizeFilenameForMatch,
} from "../lib/adapters/docling/docling-origin-matcher.ts";

describe("docling-origin-matcher", () => {
  it("normalizes path, extension, copy suffixes, and case", () => {
    assert.equal(
      normalizeFilenameForMatch("C:/docs/Report (1).PDF"),
      "report",
    );
    assert.equal(
      normalizeFilenameForMatch("folder\\Sample - Copy.docx"),
      "sample",
    );
    assert.equal(
      normalizeFilenameForMatch("sample.pdf"),
      normalizeFilenameForMatch("SAMPLE.PDF"),
    );
  });

  it("matches logically equivalent filenames", () => {
    const result = matchOriginToSource({
      originFilename: "sample.pdf",
      originMimetype: "application/pdf",
      sourceFilename: "downloads/Sample (2).pdf",
      sourceMimetype: "application/pdf",
    });
    assert.equal(result.filenameStatus, "MATCH");
    assert.equal(result.mimetypeStatus, "MATCH");
    assert.equal(result.issues.length, 0);
  });

  it("flags hard filename mismatch", () => {
    const result = matchOriginToSource({
      originFilename: "alpha.pdf",
      originMimetype: "application/pdf",
      sourceFilename: "beta.pdf",
      sourceMimetype: "application/pdf",
    });
    assert.equal(result.filenameStatus, "MISMATCH");
    assert.ok(
      result.issues.some((i) => i.code === "SOURCE_FILENAME_MISMATCH"),
    );
  });

  it("soft-compares MIME via source extension", () => {
    const result = matchOriginToSource({
      originFilename: "doc.pdf",
      originMimetype: "application/pdf",
      sourceFilename: "doc.pdf",
    });
    assert.equal(result.mimetypeStatus, "MATCH");
  });

  it("flags MIME mismatch against extension", () => {
    const result = matchOriginToSource({
      originFilename: "image.png",
      originMimetype: "image/png",
      sourceFilename: "image.pdf",
      sourceMimetype: "application/pdf",
    });
    assert.equal(result.mimetypeStatus, "MISMATCH");
    assert.ok(
      result.issues.some((i) => i.code === "SOURCE_MIMETYPE_MISMATCH"),
    );
  });
});

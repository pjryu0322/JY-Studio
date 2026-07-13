import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  recomputeNormalizedDocumentFingerprint,
  resolveObjectStorageVerifyMode,
  summarizeDoclingReviewIntegrity,
  type DoclingReviewIntegrityResult,
} from "../lib/docling-import/docling-review-integrity-service.ts";
import { NORMALIZED_DOCUMENT_FINGERPRINT_VERSION } from "../lib/docling-import/normalized-document-fingerprint.ts";

const projectRoot = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(projectRoot, relative), "utf8");
}

describe("docling-review-integrity", () => {
  it("summarizes PASS and BLOCKED", () => {
    const pass: DoclingReviewIntegrityResult = { ok: true, errors: [], warnings: [] };
    assert.equal(summarizeDoclingReviewIntegrity(pass).status, "PASS");
    const blocked: DoclingReviewIntegrityResult = {
      ok: false,
      errors: [{ code: "DOCLING_REVIEW_CHECKSUM_MISMATCH", message: "무결성" }],
      warnings: [],
    };
    assert.equal(summarizeDoclingReviewIntegrity(blocked).status, "BLOCKED");
    assert.equal(summarizeDoclingReviewIntegrity(null).status, "UNKNOWN");
  });

  it("maps verifyObjectStorage modes", () => {
    assert.equal(resolveObjectStorageVerifyMode(false), "NONE");
    assert.equal(resolveObjectStorageVerifyMode("NONE"), "NONE");
    assert.equal(resolveObjectStorageVerifyMode("HEAD_ONLY"), "HEAD_ONLY");
    assert.equal(resolveObjectStorageVerifyMode(true), "FULL");
    assert.equal(resolveObjectStorageVerifyMode("FULL"), "FULL");
    assert.equal(resolveObjectStorageVerifyMode(undefined), "FULL");
  });

  it("wires integrity into admin decision and approve/accept services", () => {
    const decision = read("src/lib/admin-review-decision.ts");
    assert.ok(decision.includes("doclingReviewIntegrity"));
    assert.ok(decision.includes("hasDoclingIntegrityBlock"));

    const service = read("src/lib/admin-review-service.ts");
    assert.ok(service.includes("assertDoclingReviewIntegrityOrThrow"));
    assert.ok(service.includes('verifyObjectStorage: "HEAD_ONLY"'));
    assert.ok(service.includes('verifyObjectStorage: "FULL"'));
    assert.ok(service.includes("validateDoclingReviewIntegrity"));
    assert.ok(service.includes("resolveReviewPackageMode"));

    const integrity = read("src/lib/docling-import/docling-review-integrity-service.ts");
    assert.ok(integrity.includes("DOCLING_REVIEW_OBJECT_INTEGRITY_FAILED"));
    assert.ok(integrity.includes("DOCLING_REVIEW_INTEGRITY_VERIFIED"));
    assert.ok(integrity.includes("DOCLING_REVIEW_INTEGRITY_FAILED"));
    assert.ok(integrity.includes("DOCLING_REVIEW_FINGERPRINT_RECALCULATION_FAILED"));
    assert.ok(integrity.includes("DOCLING_REVIEW_FINGERPRINT_VERSION_UNSUPPORTED"));
    assert.ok(!integrity.includes("storageKey:"));
  });

  it("lists required integrity error codes", () => {
    const integrity = read("src/lib/docling-import/docling-review-integrity-service.ts");
    for (const code of [
      "DOCLING_REVIEW_BUNDLE_NOT_FOUND",
      "DOCLING_REVIEW_BUNDLE_NOT_ACTIVE",
      "DOCLING_REVIEW_BUNDLE_NOT_READY",
      "DOCLING_REVIEW_VERSION_MISMATCH",
      "DOCLING_REVIEW_FILE_NOT_FOUND",
      "DOCLING_REVIEW_FILE_ROLE_MISMATCH",
      "DOCLING_REVIEW_CHECKSUM_MISMATCH",
      "DOCLING_REVIEW_OBJECT_MISSING",
      "DOCLING_REVIEW_OBJECT_SIZE_MISMATCH",
      "DOCLING_REVIEW_OBJECT_INTEGRITY_FAILED",
      "DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISSING",
      "DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISMATCH",
      "DOCLING_REVIEW_FINGERPRINT_MISMATCH",
      "DOCLING_REVIEW_FINGERPRINT_RECALCULATION_FAILED",
      "DOCLING_REVIEW_FINGERPRINT_VERSION_UNSUPPORTED",
      "DOCLING_REVIEW_ADAPTER_VERSION_MISMATCH",
    ]) {
      assert.ok(integrity.includes(code), code);
    }
  });

  it("rejects unsupported fingerprint versions", () => {
    const result = recomputeNormalizedDocumentFingerprint({
      nd: {
        adapterType: "DOCLING",
        adapterVersion: "1.0.0",
        sourceSchemaName: "DoclingDocument",
        sourceSchemaVersion: "1.10.0",
        title: "T",
        language: "ko",
        sectionsJson: [],
        tablesJson: [],
        figuresJson: [],
        readingOrderJson: [],
        warningsJson: [],
        sourceFileId: "src",
        jsonPayloadFileId: "json",
        markdownPayloadFileId: "md",
        fingerprintVersion: "normalized-document-v1",
      },
      sourceChecksum: "aa",
      jsonChecksum: "bb",
      markdownChecksum: "cc",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "DOCLING_REVIEW_FINGERPRINT_VERSION_UNSUPPORTED");
    }
    assert.equal(NORMALIZED_DOCUMENT_FINGERPRINT_VERSION, "normalized-document-v2");
  });
});

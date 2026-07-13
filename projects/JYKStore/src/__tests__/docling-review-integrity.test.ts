import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  summarizeDoclingReviewIntegrity,
  type DoclingReviewIntegrityResult,
} from "../lib/docling-import/docling-review-integrity-service.ts";

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

  it("wires integrity into admin decision and approve/accept services", () => {
    const decision = read("src/lib/admin-review-decision.ts");
    assert.ok(decision.includes("doclingReviewIntegrity"));
    assert.ok(decision.includes("hasDoclingIntegrityBlock"));

    const service = read("src/lib/admin-review-service.ts");
    assert.ok(service.includes("assertDoclingReviewIntegrityOrThrow"));
    assert.ok(service.includes("verifyObjectStorage: true"));
    assert.ok(service.includes("validateDoclingReviewIntegrity"));

    const integrity = read("src/lib/docling-import/docling-review-integrity-service.ts");
    assert.ok(integrity.includes("DOCLING_REVIEW_OBJECT_INTEGRITY_FAILED"));
    assert.ok(integrity.includes("DOCLING_REVIEW_INTEGRITY_VERIFIED"));
    assert.ok(integrity.includes("DOCLING_REVIEW_INTEGRITY_FAILED"));
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
      "DOCLING_REVIEW_ADAPTER_VERSION_MISMATCH",
    ]) {
      assert.ok(integrity.includes(code), code);
    }
  });
});

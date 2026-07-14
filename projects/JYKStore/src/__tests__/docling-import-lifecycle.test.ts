import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertTransition,
  canRetry,
} from "../lib/docling-import/docling-import-state.ts";
import {
  recomputeNormalizedDocumentFingerprint,
} from "../lib/docling-import/docling-review-integrity-service.ts";
import {
  computeNormalizedDocumentFingerprint,
  NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
} from "../lib/docling-import/normalized-document-fingerprint.ts";
import { DoclingImportBundleStatus } from "@prisma/client";

const projectRoot = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(projectRoot, relative), "utf8");
}

describe("docling-import-lifecycle", () => {
  it("keeps state machine transitions and retryable statuses", () => {
    assertTransition(
      DoclingImportBundleStatus.UPLOADED,
      DoclingImportBundleStatus.VALIDATING,
    );
    assert.equal(canRetry(DoclingImportBundleStatus.VALIDATION_FAILED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.REVIEW_READY), false);
  });

  it("upload stages inactive first and promotes only after REVIEW_READY", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    const lifecycle = read("src/lib/docling-import/docling-import-lifecycle-service.ts");
    const worker = read("src/workers/docling-processing-worker.ts");
    assert.ok(service.includes("isActive: false"));
    assert.ok(service.includes("confirmProviderDoclingImport"));
    assert.ok(service.includes("REVIEW_READY"));
    assert.ok(worker.includes("DoclingImportBundleStatus.NORMALIZED"));
    assert.ok(!worker.includes("promoteDoclingStagingBundle"));
    assert.ok(lifecycle.includes('deactivationReason: "replaced"') || lifecycle.includes("deactivationReason: 'replaced'"));
    assert.ok(service.includes("markBundleDeletePendingAndCleanup") || lifecycle.includes("markBundleDeletePendingAndCleanup"));
    assert.ok(lifecycle.includes("acquireVersionUploadLock"));
    assert.ok(lifecycle.includes("pg_advisory_xact_lock"));
    assert.ok(service.includes("DOCLING_IMMUTABLE_AFTER_SUBMISSION") || lifecycle.includes("DOCLING_IMMUTABLE_AFTER_SUBMISSION"));
    assert.ok(lifecycle.includes("DELETE_PENDING"));
    assert.ok(lifecycle.includes("DELETE_FAILED"));
    assert.ok(lifecycle.includes("finalizePreviousBundleStorage"));
    assert.ok(lifecycle.includes("replacedBundleId"));
  });

  it("failed staging is preserved (no immediate cleanup on validation failure)", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    const lifecycle = read("src/lib/docling-import/docling-import-lifecycle-service.ts");
    assert.ok(service.includes("preserveFailedStagingBundle"));
    assert.ok(lifecycle.includes("preserveFailedStagingBundle"));
    assert.ok(service.includes("validation_or_normalization_failed"));
    // Must NOT call markBundleDeletePendingAndCleanup for validation failure path.
    const failIdx = service.indexOf("validation_or_normalization_failed");
    const nearby = service.slice(Math.max(0, failIdx - 200), failIdx + 200);
    assert.ok(nearby.includes("preserveFailedStagingBundle"));
    assert.ok(!nearby.includes("markBundleDeletePendingAndCleanup"));
  });

  it("post-TX cleanup uses replacedBundleId only", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    const lifecycle = read("src/lib/docling-import/docling-import-lifecycle-service.ts");
    assert.ok(lifecycle.includes("replacedBundleId"));
    assert.ok(service.includes("replacedBundleId"));
    assert.ok(!service.includes("previousActive && previousActive.id !== bundleId"));
  });

  it("download allows ACTIVE staging without requiring isActive", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes("deletedAt != null"));
    assert.ok(service.includes("DoclingBundleStorageStatus.ACTIVE"));
    assert.ok(service.includes("DOCLING_OBJECT_INTEGRITY_FAILED"));
    assert.ok(service.includes("DOCLING_STORAGE_UNAVAILABLE"));
  });

  it("retry log always completes SUCCEEDED or FAILED", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes("DoclingProcessingStage.RETRY"));
    assert.ok(service.includes("DoclingProcessingStatus.SUCCEEDED"));
    assert.ok(
      service.includes("succeeded (provider confirm required)") ||
        service.includes("Retry succeeded") ||
        service.includes("Retry completed") ||
        service.includes("completed with failure"),
    );
    assert.ok(service.includes("DoclingProcessingStatus.FAILED"));
  });

  it("preserves integrity vs storage unavailable distinction", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes('code: "DOCLING_OBJECT_INTEGRITY_FAILED"'));
    assert.ok(service.includes('code: "DOCLING_STORAGE_UNAVAILABLE"'));
  });

  it("ND deactivate runs in markBundleDeletePendingAndCleanup transaction", () => {
    const lifecycle = read("src/lib/docling-import/docling-import-lifecycle-service.ts");
    assert.ok(lifecycle.includes("deactivateNormalizedDocumentsForBundle"));
    assert.ok(lifecycle.includes("isActive: false"));
  });

  it("fingerprint recompute detects section mutations", () => {
    const baseNd = {
      adapterType: "DOCLING",
      adapterVersion: "1.0.0",
      sourceSchemaName: "DoclingDocument",
      sourceSchemaVersion: "1.10.0",
      title: "T",
      language: "ko",
      sectionsJson: [{ id: "s1", title: "A" }],
      tablesJson: [],
      figuresJson: [],
      readingOrderJson: ["s1"],
      warningsJson: [],
      sourceFileId: "src",
      jsonPayloadFileId: "json",
      markdownPayloadFileId: "md",
      fingerprintVersion: NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
    };
    const checksums = { sourceChecksum: "aa", jsonChecksum: "bb", markdownChecksum: "cc" };
    const left = recomputeNormalizedDocumentFingerprint({ nd: baseNd, ...checksums });
    const right = recomputeNormalizedDocumentFingerprint({
      nd: {
        ...baseNd,
        sectionsJson: [{ id: "s1", title: "MUTATED" }],
      },
      ...checksums,
    });
    assert.equal(left.ok, true);
    assert.equal(right.ok, true);
    if (left.ok && right.ok) {
      assert.notEqual(left.fingerprint, right.fingerprint);
      const expected = computeNormalizedDocumentFingerprint({
        adapterType: baseNd.adapterType,
        adapterVersion: baseNd.adapterVersion,
        sourceSchemaName: baseNd.sourceSchemaName,
        sourceSchemaVersion: baseNd.sourceSchemaVersion,
        title: baseNd.title,
        language: baseNd.language,
        sections: baseNd.sectionsJson,
        tables: baseNd.tablesJson,
        figures: baseNd.figuresJson,
        readingOrder: baseNd.readingOrderJson,
        warnings: baseNd.warningsJson,
        sourceFileId: baseNd.sourceFileId,
        jsonPayloadFileId: baseNd.jsonPayloadFileId,
        markdownPayloadFileId: baseNd.markdownPayloadFileId,
        sourceChecksum: checksums.sourceChecksum,
        jsonChecksum: checksums.jsonChecksum,
        markdownChecksum: checksums.markdownChecksum,
      });
      assert.equal(left.fingerprint, expected);
    }
  });
});

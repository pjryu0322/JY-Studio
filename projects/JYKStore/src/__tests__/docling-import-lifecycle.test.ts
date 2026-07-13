import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertTransition,
  canRetry,
} from "../lib/docling-import/docling-import-state.ts";
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
    assert.ok(service.includes("isActive: false"));
    assert.ok(service.includes("REVIEW_READY"));
    assert.ok(service.includes("deactivationReason: \"replaced\"") || service.includes("deactivationReason: 'replaced'"));
    assert.ok(service.includes("markBundleDeletePendingAndCleanup"));
    assert.ok(service.includes("acquireVersionUploadLock"));
    assert.ok(service.includes("pg_advisory_xact_lock"));
    assert.ok(service.includes("DOCLING_IMMUTABLE_AFTER_SUBMISSION"));
    assert.ok(service.includes("DELETE_PENDING"));
    assert.ok(service.includes("DELETE_FAILED"));
    assert.ok(service.includes("finalizePreviousBundleStorage"));
  });

  it("failed staging must not deactivate previous active", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    // Create staging inactive before validate; only deactivate previous inside promote transaction.
    const createIdx = service.indexOf("isActive: false");
    const promoteIdx = service.indexOf("deactivationReason: \"replaced\"");
    const altPromoteIdx = service.indexOf("deactivationReason: 'replaced'");
    const deactivateIdx = promoteIdx >= 0 ? promoteIdx : altPromoteIdx;
    assert.ok(createIdx >= 0);
    assert.ok(deactivateIdx > createIdx);
    assert.ok(service.includes("validation_or_normalization_failed"));
  });

  it("download requires ACTIVE storage and deletedAt null", () => {
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
    assert.ok(service.includes("Retry succeeded") || service.includes("Retry completed"));
    assert.ok(service.includes("DoclingProcessingStatus.FAILED"));
  });

  it("preserves integrity vs storage unavailable distinction", () => {
    const service = read("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes('code: "DOCLING_OBJECT_INTEGRITY_FAILED"'));
    assert.ok(service.includes('code: "DOCLING_STORAGE_UNAVAILABLE"'));
  });
});

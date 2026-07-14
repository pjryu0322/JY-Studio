import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DoclingImportBundleStatus } from "@prisma/client";
import { isDoclingImportError } from "../lib/docling-import/docling-import-errors.ts";
import {
  assertTransition,
  canRetry,
  canRetryDoclingBundle,
  getAllowedTransitions,
  resolveDoclingRetryMode,
} from "../lib/docling-import/docling-import-state.ts";

describe("docling-import-state", () => {
  it("allows the core happy-path transitions", () => {
    assertTransition(DoclingImportBundleStatus.UPLOADED, DoclingImportBundleStatus.VALIDATING);
    assertTransition(DoclingImportBundleStatus.VALIDATING, DoclingImportBundleStatus.VALID);
    assertTransition(DoclingImportBundleStatus.VALID, DoclingImportBundleStatus.NORMALIZING);
    assertTransition(
      DoclingImportBundleStatus.NORMALIZING,
      DoclingImportBundleStatus.NORMALIZED,
    );
    assertTransition(
      DoclingImportBundleStatus.NORMALIZED,
      DoclingImportBundleStatus.REVIEW_READY,
    );
  });

  it("rejects illegal transitions", () => {
    assert.throws(
      () =>
        assertTransition(
          DoclingImportBundleStatus.UPLOADED,
          DoclingImportBundleStatus.REVIEW_READY,
        ),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_INVALID_TRANSITION",
    );
    assert.deepEqual(getAllowedTransitions(DoclingImportBundleStatus.REVIEW_READY), []);
  });

  it("marks failed and normalized statuses as retryable when code allows", () => {
    assert.equal(canRetry(DoclingImportBundleStatus.VALIDATION_FAILED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.NORMALIZATION_FAILED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.NORMALIZED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.REVIEW_READY), false);
    assert.equal(canRetry(DoclingImportBundleStatus.UPLOADED), false);
  });

  it("resolveDoclingRetryMode: legacy markdown similarity codes are not UI revalidate reasons", () => {
    // Soft policy: historical MISMATCH codes fall through to generic revalidate
    // only via DOCLING_VALIDATION_FAILED / retryable sets — similarity codes
    // themselves are no longer listed as primary revalidate reasons for UI.
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_VALIDATION_FAILED",
      ),
      "REVALIDATE_STORED_OBJECTS",
    );
    // Empty/encoding markdown warnings must not force 재검증 UI.
    assert.notEqual(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_MARKDOWN_EMPTY",
      ),
      "REUPLOAD_REQUIRED",
    );
  });

  it("resolveDoclingRetryMode: origin/signature/schema → REUPLOAD", () => {
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "SOURCE_FILENAME_MISMATCH",
      ),
      "REUPLOAD_REQUIRED",
    );
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_SCHEMA_INVALID",
      ),
      "REUPLOAD_REQUIRED",
    );
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_INCOMPLETE_FILES",
      ),
      "REUPLOAD_REQUIRED",
    );
    assert.equal(
      canRetryDoclingBundle(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "SOURCE_FILENAME_MISMATCH",
      ),
      true,
    );
  });

  it("resolveDoclingRetryMode: immutable/processing → NOT_ALLOWED", () => {
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_VALIDATION_FAILED",
        { immutable: true },
      ),
      "NOT_ALLOWED",
    );
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATING,
        null,
      ),
      "NOT_ALLOWED",
    );
  });
});

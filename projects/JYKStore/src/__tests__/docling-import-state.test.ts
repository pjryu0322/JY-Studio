import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DoclingImportBundleStatus } from "@prisma/client";
import { isDoclingImportError } from "../lib/docling-import/docling-import-errors.ts";
import {
  assertTransition,
  canRetry,
  canRetryDoclingBundle,
  getAllowedTransitions,
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

  it("marks failed and normalized statuses as retryable", () => {
    assert.equal(canRetry(DoclingImportBundleStatus.VALIDATION_FAILED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.NORMALIZATION_FAILED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.NORMALIZED), true);
    assert.equal(canRetry(DoclingImportBundleStatus.REVIEW_READY), false);
    assert.equal(canRetry(DoclingImportBundleStatus.UPLOADED), false);
    assert.equal(
      canRetryDoclingBundle(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "SOURCE_FILENAME_MISMATCH",
      ),
      false,
    );
  });
});

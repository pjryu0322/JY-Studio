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

  it("resolveDoclingRetryMode: markdown mismatch → REVALIDATE", () => {
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_JSON_MARKDOWN_MISMATCH",
      ),
      "REVALIDATE_STORED_OBJECTS",
    );
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_JSON_MARKDOWN_INCONCLUSIVE",
      ),
      "REVALIDATE_STORED_OBJECTS",
    );
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_JSON_MARKDOWN_LOW_COVERAGE",
      ),
      "REVALIDATE_STORED_OBJECTS",
    );
    assert.equal(
      canRetryDoclingBundle(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "DOCLING_JSON_MARKDOWN_MISMATCH",
      ),
      true,
    );
  });

  it("resolveDoclingRetryMode: origin/signature → REUPLOAD", () => {
    assert.equal(
      resolveDoclingRetryMode(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "SOURCE_FILENAME_MISMATCH",
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
        "DOCLING_JSON_MARKDOWN_MISMATCH",
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

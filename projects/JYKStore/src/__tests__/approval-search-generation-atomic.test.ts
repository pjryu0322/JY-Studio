/**
 * Unit tests for P5.1.3 snapshot fingerprint + approval evidence helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { assertCompletePreparationValidationSnapshotEntry } from "../lib/distribution/preparation-validation-snapshot-entry.ts";
import {
  canonicalizeReviewSubmitSnapshot,
  computeReviewSubmitSnapshotFingerprint,
} from "../lib/distribution/review-submit-snapshot-fingerprint.ts";
import { promoteSearchGeneration } from "../lib/search-generation/search-generation-service.ts";
import type { DoclingBundleReviewSubmitSnapshot } from "../lib/distribution/distribution-submit-snapshot.ts";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function sampleSnapshot(
  overrides: Partial<DoclingBundleReviewSubmitSnapshot> = {},
): DoclingBundleReviewSubmitSnapshot {
  return {
    mode: "DOCLING_BUNDLE",
    submittedAt: "2026-07-18T00:00:00.000Z",
    submittedVersionId: "ver-1",
    doclingBundleId: "b-1",
    sourceFileId: "src-1",
    jsonPayloadFileId: "json-1",
    markdownPayloadFileId: null,
    checksums: { source: "a".repeat(64), json: "b".repeat(64), markdown: null },
    doclingSchemaVersion: "1.1",
    adapterVersion: "test",
    normalizedDocumentId: "nd-1",
    fingerprint: "fp-1",
    warningCount: 0,
    warnings: [],
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PUBLIC",
    allowDownload: false,
    allowApi: true,
    allowMcp: true,
    language: "ko",
    snapshotSchemaVersion: 3,
    ...overrides,
  } as DoclingBundleReviewSubmitSnapshot;
}

describe("review submit snapshot fingerprint (P5.1.3)", () => {
  it("is stable across object key insertion order", () => {
    const a = sampleSnapshot({ pipelineRunId: "p1", indexGenerationId: "g1" });
    const b = {
      ...sampleSnapshot(),
      indexGenerationId: "g1",
      pipelineRunId: "p1",
    } as DoclingBundleReviewSubmitSnapshot;
    assert.equal(
      computeReviewSubmitSnapshotFingerprint(a),
      computeReviewSubmitSnapshotFingerprint(b),
    );
    assert.ok(canonicalizeReviewSubmitSnapshot(a).includes('"indexGenerationId"'));
  });

  it("changes when a binding field changes", () => {
    const a = computeReviewSubmitSnapshotFingerprint(sampleSnapshot({ pipelineRunId: "p1" }));
    const b = computeReviewSubmitSnapshotFingerprint(sampleSnapshot({ pipelineRunId: "p2" }));
    assert.notEqual(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });
});

describe("preparation validation entry completeness (P5.1.3)", () => {
  const base = {
    status: "PASS",
    runId: "run-1",
    testedAt: "2026-07-18T00:00:00.000Z",
    currentValidity: "CURRENT" as const,
    providerConfirmationStatus: "CONFIRMED",
    providerConfirmationId: "conf-1",
    confirmedAt: "2026-07-18T00:00:00.000Z",
    pipelineRunId: "pipe-1",
    normalizedDocumentId: "nd-1",
    indexGenerationId: "gen-1",
    fingerprint: "fp-1",
  };

  it("requires resultFingerprint for API", () => {
    assert.throws(
      () => assertCompletePreparationValidationSnapshotEntry("API", { ...base }),
      (e: unknown) =>
        e instanceof PayloadServiceError && e.code === "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
    );
    assert.doesNotThrow(() =>
      assertCompletePreparationValidationSnapshotEntry("API", {
        ...base,
        resultFingerprint: "rf-1",
      }),
    );
  });

  it("requires downloadTestId for DOWNLOAD", () => {
    assert.throws(
      () => assertCompletePreparationValidationSnapshotEntry("DOWNLOAD", { ...base }),
      (e: unknown) => e instanceof PayloadServiceError,
    );
    assert.doesNotThrow(() =>
      assertCompletePreparationValidationSnapshotEntry("DOWNLOAD", {
        ...base,
        downloadTestId: "dt-1",
      }),
    );
  });
});

describe("promoteSearchGeneration conditional guard (P5.1.3)", () => {
  it("rejects promotion when descriptor guard does not match", async () => {
    const fakeTx = {
      searchIndexGeneration: {
        findUnique: async () => ({
          id: "gen-1",
          versionId: "ver-1",
          status: "READY",
          scope: "DRAFT",
          generationFingerprint: "fp-1",
          embeddingProvider: "local-e5",
          embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
          embeddingModelRevision: SHA,
          embeddingDimension: 384,
          distanceMetric: "cosine",
        }),
        updateMany: async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          if (args.where.scope === "PRODUCTION") return { count: 0 };
          if (args.data.status === "PROMOTED") return { count: 0 };
          return { count: 0 };
        },
      },
    };

    await assert.rejects(
      () =>
        promoteSearchGeneration("gen-1", fakeTx as never, {
          generationFingerprint: "fp-1",
          embeddingProvider: "local-e5",
          embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
          embeddingModelRevision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          embeddingDimension: 384,
          distanceMetric: "cosine",
        }),
      (error: unknown) =>
        error instanceof PayloadServiceError &&
        error.code === "SEARCH_GENERATION_TRANSITION_CONFLICT",
    );
  });
});

describe("approval evidence helper exports (P5.1.3)", () => {
  it("requires expectedSnapshotFingerprint (arity 2)", async () => {
    const mod = await import("../lib/distribution/approval-search-generation-evidence.ts");
    assert.equal(typeof mod.assertApprovalSearchGenerationInTx, "function");
    assert.equal(mod.assertApprovalSearchGenerationInTx.length, 2);
  });
});

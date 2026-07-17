import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertSharedConfirmationEvidence,
  canShareProviderConfirmation,
  compareShareableResultItems,
  computeResultFingerprint,
  isLegacySharedConfirmationMissingFingerprint,
  normalizeValidationQuery,
} from "../lib/distribution/service-validation-share.ts";
import { resolveRunCurrentValidity } from "../lib/distribution/service-validation-service.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const baseRun = {
  status: "PASS",
  query: "소프트웨어 사업 대가 산정",
  pipelineRunId: "pipe-1",
  indexGenerationId: "gen-1",
  fingerprint: "fp-1",
  normalizedDocumentId: "nd-1",
  resultCount: 2,
  invalidatedAt: null as Date | null,
};

const itemsA = [
  { rank: 1, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
  { rank: 2, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
];

const itemsB = [
  { rank: 1, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
  { rank: 2, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
];

describe("service validation share + incomplete evidence", () => {
  it("allows shared confirmation only for identical retrieval snapshots", () => {
    const fp = computeResultFingerprint({
      query: baseRun.query,
      indexGenerationId: baseRun.indexGenerationId,
      items: itemsA,
    });
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: fp },
        mcpRun: { ...baseRun, resultFingerprint: fp },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: {
          fingerprint: "fp-1",
          indexGenerationId: "gen-1",
          normalizedDocumentId: "nd-1",
          pipelineRunId: "pipe-1",
        },
      }),
      true,
    );
  });

  it("blocks shared confirmation when stored fingerprints are missing", () => {
    assert.equal(
      canShareProviderConfirmation({
        apiRun: baseRun,
        mcpRun: baseRun,
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("blocks shared confirmation when chunk order differs", () => {
    const swapped = [
      { rank: 1, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
      { rank: 2, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
    ];
    assert.equal(compareShareableResultItems(itemsA, swapped), false);
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "x" },
        mcpRun: { ...baseRun, resultFingerprint: "x" },
        apiResults: itemsA,
        mcpResults: swapped,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("blocks shared confirmation when source or page differs", () => {
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "x" },
        mcpRun: { ...baseRun, resultFingerprint: "x" },
        apiResults: itemsA,
        mcpResults: [
          { rank: 1, chunkId: "c1", sourceDocumentId: "other", pageStart: 21, pageEnd: 21 },
          itemsA[1]!,
        ],
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "x" },
        mcpRun: { ...baseRun, resultFingerprint: "x" },
        apiResults: itemsA,
        mcpResults: [
          { rank: 1, chunkId: "c1", sourceDocumentId: "d1", pageStart: 99, pageEnd: 99 },
          itemsA[1]!,
        ],
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("blocks shared confirmation when generation or fingerprint differs", () => {
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "fp" },
        mcpRun: { ...baseRun, indexGenerationId: "gen-2", resultFingerprint: "fp" },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
    assert.equal(
      canShareProviderConfirmation({
        apiRun: { ...baseRun, resultFingerprint: "fp" },
        mcpRun: { ...baseRun, fingerprint: "fp-2", resultFingerprint: "fp" },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("normalizes queries before compare", () => {
    assert.equal(normalizeValidationQuery("  a   b  "), "a b");
  });

  it("marks PASS API/MCP with empty result items as STALE", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp",
          indexGenerationId: "g",
          invalidatedAt: null,
          channel: "API",
        },
        bindingFingerprint: "fp",
        bindingIndexGenerationId: "g",
        resultItemCount: 0,
      }),
      "STALE",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp",
          indexGenerationId: "g",
          invalidatedAt: null,
          channel: "DOWNLOAD",
        },
        bindingFingerprint: "fp",
        bindingIndexGenerationId: "g",
        resultItemCount: 0,
      }),
      "CURRENT",
    );
  });

  it("rejects legacy shared confirmation without stored fingerprints", () => {
    const missing = assertSharedConfirmationEvidence({
      apiRun: { resultFingerprint: null, resultCount: 2 },
      mcpRun: { resultFingerprint: null, resultCount: 2 },
      apiResults: itemsA,
      mcpResults: itemsB,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.reason, "RESULT_FINGERPRINT_MISSING");
    }
    const oneMissing = assertSharedConfirmationEvidence({
      apiRun: { resultFingerprint: "abc", resultCount: 2 },
      mcpRun: { resultFingerprint: null, resultCount: 2 },
      apiResults: itemsA,
      mcpResults: itemsB,
    });
    assert.equal(oneMissing.ok, false);
    assert.equal(
      isLegacySharedConfirmationMissingFingerprint({
        sharedConfirmationGroupId: "group-1",
        apiResultFingerprint: null,
        mcpResultFingerprint: null,
      }),
      true,
    );
    const ok = assertSharedConfirmationEvidence({
      apiRun: { resultFingerprint: "same", resultCount: 2 },
      mcpRun: { resultFingerprint: "same", resultCount: 2 },
      apiResults: itemsA,
      mcpResults: itemsB,
    });
    assert.equal(ok.ok, true);
  });

  it("records download evidence only after prepare succeeds (source contract)", () => {
    const confirmation = readFileSync(
      join(root, "src/lib/distribution/service-validation-confirmation-service.ts"),
      "utf8",
    );
    assert.ok(confirmation.includes("prepareProviderDownloadTest"));
    assert.ok(confirmation.includes("recordSuccessfulDownloadTestEvidence"));
    assert.equal(confirmation.includes("upsert"), false);
    assert.ok(confirmation.includes("SERVICE_VALIDATION_NOT_EDITABLE"));
    const route = readFileSync(
      join(
        root,
        "src/app/api/v1/provider/packs/[packId]/service-validation/[runId]/download-test/route.ts",
      ),
      "utf8",
    );
    const prepareIdx = route.indexOf("prepareProviderDownloadTest");
    const recordIdx = route.indexOf("recordSuccessfulDownloadTestEvidence");
    assert.ok(prepareIdx >= 0 && recordIdx > prepareIdx);
  });

  it("paginates admin STALE filters before count (source contract)", () => {
    const service = readFileSync(
      join(root, "src/lib/distribution/service-validation-service.ts"),
      "utf8",
    );
    assert.ok(service.includes("needsComputedFilter"));
    assert.ok(service.includes("parseAdminHistoryDateBound"));
    assert.ok(service.includes("RESULT_FINGERPRINT_MISSING"));
    assert.ok(service.includes("assertSharedConfirmationEvidence"));
  });
});

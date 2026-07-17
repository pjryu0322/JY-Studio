import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canShareProviderConfirmation,
  compareShareableResultItems,
  computeResultFingerprint,
  normalizeValidationQuery,
} from "../lib/distribution/service-validation-share.ts";
import { resolveRunCurrentValidity } from "../lib/distribution/service-validation-service.ts";

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

  it("blocks shared confirmation when chunk order differs", () => {
    const swapped = [
      { rank: 1, chunkId: "c2", sourceDocumentId: "d1", pageStart: 22, pageEnd: 23 },
      { rank: 2, chunkId: "c1", sourceDocumentId: "d1", pageStart: 21, pageEnd: 21 },
    ];
    assert.equal(compareShareableResultItems(itemsA, swapped), false);
    assert.equal(
      canShareProviderConfirmation({
        apiRun: baseRun,
        mcpRun: baseRun,
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
        apiRun: baseRun,
        mcpRun: baseRun,
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
        apiRun: baseRun,
        mcpRun: baseRun,
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
        apiRun: baseRun,
        mcpRun: { ...baseRun, indexGenerationId: "gen-2" },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
    assert.equal(
      canShareProviderConfirmation({
        apiRun: baseRun,
        mcpRun: { ...baseRun, fingerprint: "fp-2" },
        apiResults: itemsA,
        mcpResults: itemsB,
        binding: { fingerprint: "fp-1", indexGenerationId: "gen-1" },
      }),
      false,
    );
  });

  it("normalizes queries before compare", () => {
    assert.equal(
      normalizeValidationQuery("  a   b  "),
      "a b",
    );
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
});

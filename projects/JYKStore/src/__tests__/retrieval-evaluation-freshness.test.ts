import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeRetrievalEvaluationFreshness } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";

const versionId = "ver-1";
const checkedAt = "2026-01-01T00:00:00.000Z";

function base() {
  return {
    latestVersionId: versionId,
    run: { versionId, checkedAt },
    activeSetId: "set-1",
    activeCaseCount: 5,
    latestCaseUpdatedAt: "2025-12-31T00:00:00.000Z",
    latestChunkActivityAt: "2025-12-31T00:00:00.000Z",
    latestSourceDocumentUpdatedAt: "2025-12-31T00:00:00.000Z",
    latestSourceValidationCheckedAt: "2025-12-31T00:00:00.000Z",
    latestStructureCoverageCheckedAt: "2025-12-31T00:00:00.000Z",
    latestKnowledgeQualityCheckedAt: "2025-12-31T00:00:00.000Z",
    latestChunkQualityCheckedAt: "2025-12-31T00:00:00.000Z",
    chunkQualityFreshnessStatus: "CURRENT" as const,
  };
}

describe("computeRetrievalEvaluationFreshness", () => {
  it("returns MISSING without run", () => {
    assert.equal(
      computeRetrievalEvaluationFreshness({ ...base(), run: null }).status,
      "MISSING",
    );
  });

  it("returns MISSING without active cases", () => {
    assert.equal(
      computeRetrievalEvaluationFreshness({ ...base(), activeCaseCount: 0 }).status,
      "MISSING",
    );
  });

  it("returns STALE on version mismatch", () => {
    const result = computeRetrievalEvaluationFreshness({
      ...base(),
      latestVersionId: "ver-new",
    });
    assert.equal(result.status, "STALE");
  });

  it("returns STALE when case updated after run", () => {
    const result = computeRetrievalEvaluationFreshness({
      ...base(),
      latestCaseUpdatedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
  });

  it("returns STALE when chunk updated after run", () => {
    const result = computeRetrievalEvaluationFreshness({
      ...base(),
      latestChunkActivityAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
  });

  it("returns STALE when chunk quality report changed after run", () => {
    const result = computeRetrievalEvaluationFreshness({
      ...base(),
      latestChunkQualityCheckedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
  });

  it("returns STALE when chunk quality freshness is not CURRENT", () => {
    const result = computeRetrievalEvaluationFreshness({
      ...base(),
      chunkQualityFreshnessStatus: "STALE",
    });
    assert.equal(result.status, "STALE");
  });

  it("returns CURRENT when all criteria match", () => {
    assert.equal(computeRetrievalEvaluationFreshness(base()).status, "CURRENT");
  });
});

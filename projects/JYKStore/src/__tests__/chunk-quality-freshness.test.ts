import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeChunkQualityFreshness } from "@/lib/chunk-quality/chunk-quality-freshness";

const versionId = "ver-1";
const checkedAt = "2026-01-01T00:00:00.000Z";

function baseInput() {
  return {
    latestVersionId: versionId,
    report: { versionId, checkedAt },
    latestChunkActivityAt: "2025-12-31T23:00:00.000Z",
    latestSourceDocumentUpdatedAt: "2025-12-31T23:00:00.000Z",
    latestSourceValidationCheckedAt: "2025-12-31T23:00:00.000Z",
    latestStructureCoverageCheckedAt: "2025-12-31T23:00:00.000Z",
    latestKnowledgeQualityCheckedAt: "2025-12-31T23:00:00.000Z",
    structureQualityFreshnessStatus: "CURRENT" as const,
  };
}

describe("computeChunkQualityFreshness", () => {
  it("returns MISSING without report", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      report: null,
    });
    assert.equal(result.status, "MISSING");
  });

  it("returns STALE on version mismatch", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      latestVersionId: "ver-new",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "VERSION_MISMATCH");
  });

  it("returns STALE when chunk updated after report", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      latestChunkActivityAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "CHUNK_CHANGED");
  });

  it("returns STALE when source document updated after report", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      latestSourceDocumentUpdatedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "SOURCE_CHANGED");
  });

  it("returns STALE when validation checked after report", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      latestSourceValidationCheckedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "VALIDATION_CHANGED");
  });

  it("returns STALE when structure coverage checked after report", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      latestStructureCoverageCheckedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "STRUCTURE_REPORT_CHANGED");
  });

  it("returns STALE when structure quality freshness is not CURRENT", () => {
    const result = computeChunkQualityFreshness({
      ...baseInput(),
      structureQualityFreshnessStatus: "STALE",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "STRUCTURE_QUALITY_STALE");
  });

  it("returns CURRENT when all criteria match", () => {
    const result = computeChunkQualityFreshness(baseInput());
    assert.equal(result.status, "CURRENT");
  });
});

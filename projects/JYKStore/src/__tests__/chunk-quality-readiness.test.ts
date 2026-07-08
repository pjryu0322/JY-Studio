import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChunkQualityGateSnapshot } from "@/lib/chunk-quality/chunk-quality-readiness";
import { meetsChunkQualityGate } from "@/lib/chunk-quality/chunk-quality-readiness";

function snap(
  partial: Partial<ChunkQualityGateSnapshot> &
    Pick<ChunkQualityGateSnapshot, "freshnessStatus">,
): ChunkQualityGateSnapshot {
  return {
    reportStatus: partial.reportStatus ?? "PASS",
    freshnessStatus: partial.freshnessStatus,
  };
}

describe("chunk quality readiness gate", () => {
  it("blocks MISSING freshness", () => {
    assert.equal(meetsChunkQualityGate(snap({ freshnessStatus: "MISSING", reportStatus: null })), false);
  });

  it("blocks STALE freshness", () => {
    assert.equal(meetsChunkQualityGate(snap({ freshnessStatus: "STALE" })), false);
  });

  it("allows CURRENT + PASS", () => {
    assert.equal(
      meetsChunkQualityGate(snap({ freshnessStatus: "CURRENT", reportStatus: "PASS" })),
      true,
    );
  });

  it("allows CURRENT + WARNING", () => {
    assert.equal(
      meetsChunkQualityGate(snap({ freshnessStatus: "CURRENT", reportStatus: "WARNING" })),
      true,
    );
  });

  it("blocks CURRENT + FAIL", () => {
    assert.equal(
      meetsChunkQualityGate(snap({ freshnessStatus: "CURRENT", reportStatus: "FAIL" })),
      false,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearQualityRefreshSessionJob,
  getQualityRefreshSessionJob,
  isQualityRefreshSessionRunning,
  qualityRefreshProgressIndex,
  startQualityRefreshSessionJob,
} from "../lib/admin-worker-zip-quality-refresh-session.ts";

describe("admin-worker-zip-quality-refresh-session", () => {
  it("computes progress index from wall-clock elapsed time", () => {
    assert.equal(qualityRefreshProgressIndex(1000, 1000, 6, 6000), 0);
    assert.equal(qualityRefreshProgressIndex(1000, 7000, 6, 6000), 1);
    assert.equal(qualityRefreshProgressIndex(1000, 40_000, 6, 6000), 5);
  });

  it("reuses one in-flight promise and keeps the result after completion", async () => {
    const packId = `pack-session-${Date.now()}`;
    clearQualityRefreshSessionJob(packId);

    let starts = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      starts += 1;
      await new Promise((r) => setTimeout(r, 20));
      return {
        ok: true,
        json: async () => ({
          ok: true,
          clientId: "c1",
          packId,
          backfilledSourceDocuments: 0,
          retypedSourceDocuments: 0,
          stepsCompleted: ["source_validation"],
          warnings: [],
          stoppedAt: null,
          readiness: {
            sourceValidation: {
              passCount: 1,
              warningCount: 0,
              failCount: 0,
              notCheckedCount: 0,
            },
            structureCoverageStatus: "PASS",
            knowledgeQualityStatus: "PASS",
            structureQualityMessage: null,
            chunkQualityStatus: null,
            chunkQualityMessage: null,
            retrievalEvaluationStatus: null,
            retrievalEvaluationMessage: null,
            releaseGateStatus: null,
            releaseGateMessage: null,
          },
        }),
      };
    }) as typeof fetch;

    try {
      const p1 = startQualityRefreshSessionJob(packId);
      const p2 = startQualityRefreshSessionJob(packId);
      assert.equal(p1, p2);
      assert.equal(isQualityRefreshSessionRunning(packId), true);
      assert.equal(getQualityRefreshSessionJob(packId)?.status, "running");

      const result = await p1;
      assert.equal(starts, 1);
      assert.equal(result.ok, true);
      assert.equal(getQualityRefreshSessionJob(packId)?.status, "done");
      assert.equal(isQualityRefreshSessionRunning(packId), false);
    } finally {
      globalThis.fetch = originalFetch;
      clearQualityRefreshSessionJob(packId);
    }
  });
});

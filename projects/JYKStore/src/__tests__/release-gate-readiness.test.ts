import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getReleaseGateApprovalMessage,
  meetsReleaseGateForApproval,
  releaseGateAllowsApprovalStatus,
} from "@/lib/release-gate/release-gate-readiness";
import type { ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";

function summary(
  overrides: Partial<ReleaseGateSummaryDto> & {
    runStatus?: string;
    freshnessStatus?: string;
  } = {},
): ReleaseGateSummaryDto {
  const runStatus = overrides.runStatus ?? "PASS";
  const freshnessStatus = overrides.freshnessStatus ?? "CURRENT";
  return {
    latestRun: overrides.latestRun
      ? overrides.latestRun
      : {
          id: "run-1",
          packId: "pack-1",
          versionId: "v-1",
          targetStatus: "PUBLISHED",
          status: runStatus as "PASS",
          blockingIssueCount: runStatus === "FAIL" ? 1 : 0,
          warningIssueCount: runStatus === "WARNING" ? 1 : 0,
          sourceStatus: "PASS",
          structureStatus: "PASS",
          chunkStatus: "PASS",
          retrievalStatus: "PASS",
          graphStatus: "PASS",
          summary: "",
          checkedBy: "SYSTEM",
          checkedAt: new Date().toISOString(),
          issues: [],
        },
    freshness: overrides.freshness ?? {
      status: freshnessStatus as "CURRENT",
      reason: freshnessStatus === "MISSING" ? "missing" : null,
      checkedAt: new Date().toISOString(),
      versionId: "v-1",
    },
  };
}

describe("release gate readiness", () => {
  it("requires latest run for approval UI gate", () => {
    assert.equal(meetsReleaseGateForApproval(null), false);
    assert.ok(getReleaseGateApprovalMessage(null));
  });

  it("blocks FAIL even if freshness CURRENT", () => {
    const s = summary({ runStatus: "FAIL" });
    assert.equal(meetsReleaseGateForApproval(s), false);
  });

  it("allows WARNING with CURRENT freshness", () => {
    const s = summary({ runStatus: "WARNING" });
    assert.equal(meetsReleaseGateForApproval(s), true);
    assert.equal(getReleaseGateApprovalMessage(s), null);
  });

  it("blocks STALE freshness", () => {
    const s = summary({ runStatus: "PASS", freshnessStatus: "STALE" });
    assert.equal(meetsReleaseGateForApproval(s), false);
  });

  it("approve helper matches policy", () => {
    assert.equal(releaseGateAllowsApprovalStatus("PASS"), true);
    assert.equal(releaseGateAllowsApprovalStatus("WARNING"), true);
    assert.equal(releaseGateAllowsApprovalStatus("FAIL"), false);
  });
});

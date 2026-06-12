import { describe, expect, it } from "vitest";
import {
  resolveIntegrationBranchMergeItems,
  resolveVerifiedSampleDataSupplementalMergeTarget,
} from "@/lib/prototype/integrationBranchMergeItems";
import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";

function target(workBranch: string, codeTaskId = "CODE-1"): CompletedCodeTaskIntegrationTarget {
  return {
    codeTaskId,
    workBranch,
    commitSha: "abc",
    processTaskId: "DEV-1",
  };
}

describe("resolveIntegrationBranchMergeItems", () => {
  it("merges sample-data branch before chain head when both are in plan", () => {
    const included = [
      target("wip/data/sample-data", "CODE-DATA-SAMPLE-001"),
      target("wip/common/components", "CODE-2"),
      target("wip/screen/workspace", "CODE-3"),
    ];
    const mergeItems = resolveIntegrationBranchMergeItems({
      included,
      effectiveSourceBranch: "wip/screen/workspace",
    });
    expect(mergeItems.map((i) => i.workBranch)).toEqual([
      "wip/data/sample-data",
      "wip/screen/workspace",
    ]);
  });

  it("keeps single head merge when sample-data is not in included", () => {
    const included = [target("wip/common/components"), target("wip/screen/workspace")];
    const mergeItems = resolveIntegrationBranchMergeItems({
      included,
      effectiveSourceBranch: "wip/screen/workspace",
    });
    expect(mergeItems.map((i) => i.workBranch)).toEqual(["wip/screen/workspace"]);
  });

  it("returns included as-is when only one target", () => {
    const included = [target("wip/data/sample-data")];
    expect(
      resolveIntegrationBranchMergeItems({
        included,
        effectiveSourceBranch: "wip/data/sample-data",
      }),
    ).toEqual(included);
  });

  it("supplements sample-data merge from verified run when not in integration included", () => {
    const runs = [
      {
        version: CODE_TASK_EXECUTION_RUN_VERSION,
        runId: "r-sample",
        projectId: "p1",
        processTaskId: "DEV-MOCK-001",
        workItemId: "w1",
        codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
        status: "github_verified" as const,
        attemptNo: 1,
        workBranch: "wip/data/sample-data",
        commitSha: "deadbeef",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        githubOutcome: {
          version: "code_task_github_outcome_v1",
          status: "verified",
          commitSha: "deadbeef",
          verifiedAt: "2026-06-12T00:00:00.000Z",
        },
      },
    ];
    expect(resolveVerifiedSampleDataSupplementalMergeTarget({ codeTaskRuns: runs })?.workBranch).toBe(
      "wip/data/sample-data",
    );
    const mergeItems = resolveIntegrationBranchMergeItems({
      included: [target("wip/screen/workspace", "CODE-SCREEN")],
      effectiveSourceBranch: "wip/screen/workspace",
      codeTaskRuns: runs,
    });
    expect(mergeItems.map((i) => i.workBranch)).toEqual([
      "wip/data/sample-data",
      "wip/screen/workspace",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { isCodeTaskRunIntegrationReady } from "@/lib/prototype/codeTaskIntegrationReadiness";
import { isCodeTaskRunMergeIncluded } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";

describe("codeTaskIntegrationReadiness", () => {
  it("treats github_verified with verified outcome as integration ready", () => {
    const run = {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: "r1",
      projectId: "p1",
      processTaskId: "DEV-MOCK-001",
      workItemId: "w1",
      codeTaskId: "CODE-DATA-SAMPLE-001",
      status: "github_verified" as const,
      attemptNo: 1,
      workBranch: "wip/data/sample-data",
      commitSha: "abc123",
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:00:00.000Z",
      githubOutcome: {
        version: "code_task_github_outcome_v1",
        status: "verified",
        commitSha: "abc123",
        verifiedAt: "2026-06-12T00:00:00.000Z",
      },
    };
    expect(isCodeTaskRunIntegrationReady(run)).toBe(true);
    expect(isCodeTaskRunMergeIncluded(run)).toBe(true);
  });
});

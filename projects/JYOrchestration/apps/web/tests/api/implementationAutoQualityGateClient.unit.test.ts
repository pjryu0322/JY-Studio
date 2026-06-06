import { describe, expect, it } from "vitest";
import { shouldTriggerImplementationAutoQualityGateClient } from "@/lib/prototype/implementationAutoQualityGateClient";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("shouldTriggerImplementationAutoQualityGateClient", () => {
  const execution: TaskCursorExecutionV1 = {
    taskId: "DEV-1",
    status: "github_verified",
    commitSha: "abc123def456",
    cursorRunId: "run-1",
    workBranch: "wip/cursor/x",
    targetRepository: "https://github.com/o/r",
  };

  const passedRun: CodeTaskExecutionRunV1 = {
    runId: "r1",
    codeTaskId: "CT-1",
    processTaskId: "DEV-1",
    status: "quality_gate_passed",
    commitSha: "abc123def456",
    workBranch: "wip/cursor/x",
    qualityOutcome: { status: "passed", evaluatedAt: "2026-06-03T00:00:00.000Z" },
  };

  it("does not trigger when run already has quality gate passed", () => {
    expect(
      shouldTriggerImplementationAutoQualityGateClient({
        projectId: "p1",
        taskCursorExecutionV1: execution,
        implementationAutoQualityGateV1: null,
        codeTaskExecutionRunsV1: [passedRun],
      }),
    ).toBe(false);
  });

  it("does not trigger when auto gate already passed for same commit", () => {
    expect(
      shouldTriggerImplementationAutoQualityGateClient({
        projectId: "p1",
        taskCursorExecutionV1: execution,
        implementationAutoQualityGateV1: {
          status: "passed",
          taskId: "DEV-1",
          sourceCommitSha: "abc123def456",
        },
        codeTaskExecutionRunsV1: [passedRun],
      }),
    ).toBe(false);
  });
});

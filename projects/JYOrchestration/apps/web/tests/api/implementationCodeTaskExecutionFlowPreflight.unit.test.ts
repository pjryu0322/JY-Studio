import { describe, expect, it } from "vitest";
import {
  buildCodeTaskExecutionFlowSteps,
  deriveCodeTaskExecutionFlowPhase,
  formatCodeTaskExecutionFlowPhaseKo,
} from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { evaluateCodeTaskReviewSecurityPolicy } from "@/lib/prototype/implementationReviewSecurityPolicy";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-04T00:00:00.000Z";

function policy() {
  return evaluateCodeTaskReviewSecurityPolicy({
    codeTask: {
      codeTaskId: "CODE-1",
      parentTaskId: "DEV-1",
      title: "t",
      description: "",
      changeType: "component",
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
      candidateFiles: [],
      candidateFileHints: [],
      targetHints: [],
    },
    workItem: null,
  });
}

function execution(overrides: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-1",
    workItemIds: ["wi-1"],
    status: "prompt_ready",
    targetRepository: "o/r",
    baseBranch: "main",
    workBranch: "wip/cursor/code-1",
    createdAt: NOW,
    updatedAt: NOW,
    failureReason: "prompt_preflight_failed",
    errorMessage: "blocked",
    ...overrides,
  };
}

function run(overrides: Partial<CodeTaskExecutionRunV1> = {}): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-1",
    workItemId: "wi-1",
    codeTaskId: "CODE-1",
    status: "failed",
    attemptNo: 1,
    failureReason: "prompt_preflight_failed",
    errorMessage: "blocked",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("implementationCodeTaskExecutionFlow preflight (P3-M26)", () => {
  it("derives prompt_preflight_failed phase without cursor_running", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-1",
      taskCursorExecution: execution(),
      latestRun: run(),
    });
    expect(phase).toBe("prompt_preflight_failed");
    expect(formatCodeTaskExecutionFlowPhaseKo(phase)).toContain("품질 검사");
  });

  it("marks Cursor step as blocked failed, not active running", () => {
    const steps = buildCodeTaskExecutionFlowSteps({
      phase: "prompt_preflight_failed",
      policy: policy(),
    });
    const prompt = steps.find((s) => s.id === "prompt_ready");
    const cursor = steps.find((s) => s.id === "cursor_running");
    const github = steps.find((s) => s.id === "github_verifying");
    expect(prompt?.state).toBe("done");
    expect(cursor?.state).toBe("failed");
    expect(cursor?.label).toBe("Cursor 실행 전 차단");
    expect(github?.state).toBe("pending");
    expect(steps.filter((s) => s.state === "active")).toHaveLength(0);
  });
});

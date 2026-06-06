import { describe, expect, it } from "vitest";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { deriveCodeTaskExecutionFlowPhase, enrichCodeTaskRunForFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

function run(partial: Partial<CodeTaskExecutionRunV1> & Pick<CodeTaskExecutionRunV1, "status">): CodeTaskExecutionRunV1 {
  return {
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-FRAME-001",
    workItemId: "wi-1",
    codeTaskId: "CODE-1",
    status: partial.status,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...partial,
  };
}

describe("deriveCodeTaskExecutionFlowPhase", () => {
  it("does not treat process developerStatus done as CodeTask cursor completed", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-FRAME-001",
      developerStatus: "done",
      taskCursorExecution: null,
      latestRun: null,
    });
    expect(phase).toBe("prompt_ready");
  });

  it("uses CodeTask run progress when global taskCursor targets another task", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-FRAME-001",
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-LOADING-002",
        status: "cursor_running",
      } as TaskCursorExecutionV1,
      latestRun: run({
        status: "github_verifying",
        cursorRunId: "bc-agent",
        commitSha: "abc123",
      }),
    });
    expect(phase).toBe("github_verifying");
  });

  it("does not reset to prompt_ready when run failed but has GitHub commit evidence", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-FRAME-001",
      taskCursorExecution: null,
      latestRun: run({
        status: "failed",
        cursorRunId: "bc-agent",
        commitSha: "abc123",
        failureReason: "github_verify_failed",
      }),
    });
    expect(phase).toBe("failed");
  });

  it("ignores stale taskCursor github_verifying when run githubOutcome is verified", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-MOCK-001",
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "github_verifying",
      } as TaskCursorExecutionV1,
      latestRun: run({
        status: "github_verifying",
        processTaskId: "DEV-MOCK-001",
        codeTaskId: "CODE-DEV-MOCK-001-001",
        githubOutcome: {
          status: "verified",
          checkedAt: "2026-06-04T00:00:00.000Z",
          workBranch: "wip/cursor/code-dev-sample-data-001-001",
          commitSha: "0cd4d65abc12",
          source: "github_rest",
        },
      }),
    });
    expect(phase).toBe("github_verified");
  });

  it("shows cursor_running when run failed only has agent id (verify pending)", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-FRAME-001",
      taskCursorExecution: null,
      latestRun: run({
        status: "failed",
        cursorRunId: "bc-agent",
      }),
    });
    expect(phase).toBe("cursor_running");
  });

  it("shows completed when auto gate passed even if task cursor is still review_pending", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-SCREEN-002",
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        status: "review_pending",
        commitSha: "abc123",
      } as TaskCursorExecutionV1,
      autoGate: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        status: "passed",
        sourceCommitSha: "abc123",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
      latestRun: run({
        status: "github_verifying",
        cursorRunId: "bc-agent",
        commitSha: "abc123",
        processTaskId: "DEV-SCREEN-002",
      }),
    });
    expect(phase).toBe("completed");
  });

  it("advances to github_verifying when run is cursor_running but commit is recorded", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-FRAME-001",
      taskCursorExecution: null,
      latestRun: run({
        status: "cursor_running",
        cursorRunId: "bc-agent",
        commitSha: "abc123",
      }),
    });
    expect(phase).toBe("github_verifying");
  });
});

describe("enrichCodeTaskRunForFlowPhase", () => {
  it("merges commit from task cursor history when JSON run lacks commitSha", () => {
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: run({ status: "cursor_running", cursorRunId: "bc-agent" }),
      execution: {
        projectId: "p1",
        taskId: "DEV-FRAME-001",
        status: "github_verifying",
        commitSha: "deadbeef",
      } as TaskCursorExecutionV1,
    });
    expect(enriched?.status).toBe("github_verifying");
    expect(enriched?.commitSha).toBe("deadbeef");
  });

  it("uses default wip branch from process task when agent id exists", () => {
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: run({ status: "cursor_running", cursorRunId: "bc-agent" }),
      execution: null,
    });
    expect(enriched?.status).toBe("github_verifying");
    expect(enriched?.workBranch).toBe("wip/cursor/dev-frame-001");
  });

  it("promotes run to completed from review_pending task cursor with commit", () => {
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: run({
        status: "github_verifying",
        processTaskId: "DEV-SCREEN-002",
        cursorRunId: "bc-agent",
      }),
      execution: {
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        status: "review_pending",
        commitSha: "abc123",
      } as TaskCursorExecutionV1,
    });
    expect(enriched?.status).toBe("completed");
  });

  it("promotes run to completed when DB runtime is completed", () => {
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: run({ status: "cursor_running", cursorRunId: "bc-agent" }),
      execution: null,
      dbRun: { runtimeState: "completed", commitSha: "abc123" },
    });
    expect(enriched?.status).toBe("completed");
    expect(enriched?.commitSha).toBe("abc123");
  });

  it("does not rewrite terminal completed runs", () => {
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: run({
        status: "completed",
        cursorRunId: "bc-agent",
        commitSha: "abc123",
      }),
      execution: null,
    });
    expect(enriched?.status).toBe("completed");
  });
});

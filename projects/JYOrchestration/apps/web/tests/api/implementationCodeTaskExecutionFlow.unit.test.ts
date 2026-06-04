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

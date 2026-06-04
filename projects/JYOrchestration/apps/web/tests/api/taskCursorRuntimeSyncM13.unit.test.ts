import { describe, expect, it } from "vitest";
import {
  resolveCodeTaskRuntimeProgressLabelKo,
  shouldSuppressQueuedSummaryWhileInFlight,
} from "@/lib/prototype/codeTaskRuntimeProgressLabel";
import { resolveTaskCursorEmbeddedWorkerEnabled } from "@/lib/prototype/taskCursorEmbeddedWorkerScheduler";
import {
  shouldRunTaskCursorGithubFallbackVerify,
  TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS,
  TASK_CURSOR_LONG_RUNNING_LABEL_AFTER_MS,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { resolveCodeTaskIdForDbRuntimeDispatch } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-06-04T01:00:00.000Z";

function execution(partial: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-FRAME-001",
    workItemIds: ["wi-1"],
    status: "cursor_running",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-frame-001",
    cursorRunId: "bc-12345678-1234-1234-1234-123456789012",
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe("taskCursorEmbeddedWorkerScheduler", () => {
  it("embedded worker is enabled by default", () => {
    expect(resolveTaskCursorEmbeddedWorkerEnabled({})).toBe(true);
    expect(resolveTaskCursorEmbeddedWorkerEnabled({ TASK_CURSOR_EMBEDDED_WORKER: "0" })).toBe(false);
  });
});

describe("taskCursorGithubFallbackVerifyPolicy", () => {
  it("runs fallback after 3 minutes while cursor_running", () => {
    const started = new Date(Date.now() - TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS - 1_000).toISOString();
    expect(
      shouldRunTaskCursorGithubFallbackVerify({
        execution: execution({ updatedAt: started }),
      }),
    ).toBe(true);
  });

  it("does not treat 10 minutes as before long-running label threshold", () => {
    const tenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const elapsed = Date.now() - Date.parse(tenMin);
    expect(elapsed).toBeGreaterThan(TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS);
    expect(elapsed).toBeLessThan(TASK_CURSOR_LONG_RUNNING_LABEL_AFTER_MS);
  });
});

describe("resolveCodeTaskIdForDbRuntimeDispatch", () => {
  it("maps parent taskId request to current DB run codeTaskId", () => {
    const bundle = {
      job: {
        id: "j1",
        status: "running",
        currentCodeTaskId: "CODE-DEV-FRAME-001-001",
      },
      currentRun: {
        id: "r1",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        runtimeState: "queued",
      },
      runs: [],
    } as unknown as ImplementationRuntimeBundleView;
    expect(
      resolveCodeTaskIdForDbRuntimeDispatch({
        requestedCodeTaskId: "DEV-FRAME-001",
        bundle,
      }),
    ).toBe("CODE-DEV-FRAME-001-001");
  });
});

describe("codeTaskRuntimeProgressLabel", () => {
  it("prefers in-flight labels over queued summary", () => {
    const label = resolveCodeTaskRuntimeProgressLabelKo({
      dbQueueStatus: "cursor_running",
      runtimeState: "cursor_running",
      taskCursorExecution: execution(),
    });
    expect(label).toContain("AI 개발자");
    expect(
      shouldSuppressQueuedSummaryWhileInFlight({
        runtimeState: "queued",
        dbQueueStatus: "cursor_running",
        taskCursorExecution: execution(),
      }),
    ).toBe(true);
  });
});

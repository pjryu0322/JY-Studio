import { describe, expect, it } from "vitest";
import {
  resolveCodeTaskRuntimeProgressLabelKo,
  shouldSuppressQueuedSummaryWhileInFlight,
} from "@/lib/prototype/codeTaskRuntimeProgressLabel";
import { resolveTaskCursorEmbeddedWorkerEnabled } from "@/lib/prototype/taskCursorEmbeddedWorkerScheduler";
import {
  isGithubProgressPollDue,
  shouldRunTaskCursorGithubFallbackVerify,
  TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS,
  TASK_CURSOR_GITHUB_INITIAL_WAIT_MS,
  TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS,
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

describe("taskCursorGithubProgressVerifyPolicy", () => {
  it("does not poll GitHub before launch grace", () => {
    const created = new Date(Date.now() - 5_000).toISOString();
    expect(
      shouldRunTaskCursorGithubFallbackVerify({
        execution: execution({ createdAt: created, updatedAt: created }),
      }),
    ).toBe(false);
  });

  it("runs GitHub progress verify after 1 minute while cursor_running (uses createdAt, not poll-updated updatedAt)", () => {
    const created = new Date(Date.now() - TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS - 1_000).toISOString();
    const recentPoll = new Date().toISOString();
    expect(
      shouldRunTaskCursorGithubFallbackVerify({
        execution: execution({ createdAt: created, updatedAt: recentPoll }),
      }),
    ).toBe(true);
  });

  it("does not run GitHub progress verify within 1 minute of launch", () => {
    const launched = new Date(Date.now() - 20_000).toISOString();
    expect(
      shouldRunTaskCursorGithubFallbackVerify({
        execution: execution({ createdAt: launched, updatedAt: launched }),
      }),
    ).toBe(false);
  });

  it("first GitHub check after 60s then every 10s", () => {
    const launchMs = Date.now() - TASK_CURSOR_GITHUB_INITIAL_WAIT_MS - 500;
    expect(isGithubProgressPollDue({ launchMs, lastCheckMs: null })).toBe(true);
    const lastCheckMs = Date.now() - 5_000;
    expect(isGithubProgressPollDue({ launchMs, lastCheckMs })).toBe(false);
    const lastCheckOld = Date.now() - TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS - 100;
    expect(isGithubProgressPollDue({ launchMs, lastCheckMs: lastCheckOld })).toBe(true);
  });

  it("runs fallback when only updatedAt is old (legacy)", () => {
    const started = new Date(Date.now() - TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS - 1_000).toISOString();
    expect(
      shouldRunTaskCursorGithubFallbackVerify({
        execution: execution({ createdAt: started, updatedAt: started }),
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

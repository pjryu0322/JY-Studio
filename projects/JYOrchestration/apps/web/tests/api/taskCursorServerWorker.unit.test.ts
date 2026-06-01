import { describe, expect, it } from "vitest";
import {
  isActiveTaskCursorJobStatus,
  isTerminalTaskCursorJobStatus,
  mapTaskCursorExecutionStatusToJobStatus,
} from "@/lib/prototype/taskCursorExecutionJobTypes";
import { buildTaskCursorJobCreateInput } from "@/lib/prototype/taskCursorExecutionJobRepository";
import {
  isServerTaskCursorPolling,
  resolveTaskCursorPollingMode,
} from "@/lib/prototype/taskCursorPollingMode";
import {
  isTaskCursorWorkerAuthorized,
  resolveTaskCursorWorkerToken,
} from "@/lib/prototype/taskCursorWorkerAuth";
import { mergeOrchestrationPatchIntoRequirementsState } from "@/lib/prototype/taskCursorJobStateSync";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-05-28T12:00:00.000Z";

function execution(partial: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-A",
    workItemIds: ["wi-1"],
    status: "cursor_running",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-a",
    cursorRunId: "bc-12345678-1234-1234-1234-123456789012",
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe("taskCursorPollingMode", () => {
  it("defaults to server mode", () => {
    expect(resolveTaskCursorPollingMode({})).toBe("server");
    expect(isServerTaskCursorPolling({})).toBe(true);
  });

  it("supports client fallback via env", () => {
    expect(resolveTaskCursorPollingMode({ TASK_CURSOR_POLLING_MODE: "client" })).toBe("client");
    expect(
      resolveTaskCursorPollingMode({ NEXT_PUBLIC_TASK_CURSOR_POLLING_MODE: "client" }),
    ).toBe("client");
  });
});

describe("taskCursorExecutionJobTypes", () => {
  it("maps cursor_failed to failed job status", () => {
    expect(mapTaskCursorExecutionStatusToJobStatus("cursor_failed")).toBe("failed");
    expect(mapTaskCursorExecutionStatusToJobStatus("cursor_running")).toBe("cursor_running");
  });

  it("detects active and terminal job statuses", () => {
    expect(isActiveTaskCursorJobStatus("cursor_running")).toBe(true);
    expect(isActiveTaskCursorJobStatus("review_pending")).toBe(false);
    expect(isTerminalTaskCursorJobStatus("review_pending")).toBe(true);
    expect(isTerminalTaskCursorJobStatus("failed")).toBe(true);
  });
});

describe("buildTaskCursorJobCreateInput", () => {
  it("creates job payload with cursorRunId and nextPollAt", () => {
    const exec = execution();
    const input = buildTaskCursorJobCreateInput({
      projectId: "p1",
      execution: exec,
      workItems: [{ id: "wi-1", taskId: "DEV-A" } as never],
    });
    expect(input.taskId).toBe("DEV-A");
    expect(input.status).toBe("cursor_running");
    expect(input.cursorRunId).toBe(exec.cursorRunId);
    expect(input.nextPollAt).toBeTruthy();
  });
});

describe("taskCursorWorkerAuth", () => {
  it("requires token in production", () => {
    const request = {
      headers: {
        get: (name: string) => (name === "x-task-cursor-worker-token" ? "secret" : null),
      },
    } as never;
    expect(
      isTaskCursorWorkerAuthorized(request, {
        NODE_ENV: "production",
        INTERNAL_WORKER_TOKEN: "secret",
      }),
    ).toBe(true);
    expect(
      isTaskCursorWorkerAuthorized(request, {
        NODE_ENV: "production",
        INTERNAL_WORKER_TOKEN: "other",
      }),
    ).toBe(false);
  });

  it("rejects worker calls without token in production", () => {
    const request = { headers: { get: () => null } } as never;
    expect(
      isTaskCursorWorkerAuthorized(request, {
        NODE_ENV: "production",
        INTERNAL_WORKER_TOKEN: "secret",
      }),
    ).toBe(false);
  });

  it("allows missing token in non-production", () => {
    const request = { headers: { get: () => null } } as never;
    expect(isTaskCursorWorkerAuthorized(request, { NODE_ENV: "development" })).toBe(true);
    expect(resolveTaskCursorWorkerToken({ INTERNAL_WORKER_TOKEN: "abc" })).toBe("abc");
  });
});

describe("mergeOrchestrationPatchIntoRequirementsState", () => {
  it("preserves unrelated task work items when patching execution only", () => {
    const merged = mergeOrchestrationPatchIntoRequirementsState(
      {
        cursorWorkItemsV1: [
          { id: "A-1", taskId: "TASK-A" },
          { id: "B-1", taskId: "TASK-B" },
        ],
        taskCursorExecutionV1: execution({ taskId: "TASK-A" }),
      },
      {
        taskCursorExecutionV1: execution({
          taskId: "TASK-A",
          status: "review_pending",
        }),
      },
    );
    expect(merged.taskCursorExecutionV1?.status).toBe("review_pending");
    expect(merged.taskCursorExecutionV1?.taskId).toBe("TASK-A");
  });

  it("preserves code task execution feedback across sequential orchestration patches", () => {
    const feedback = {
      version: "implementation_code_task_execution_feedback_v1" as const,
      projectId: "p1",
      updatedAt: NOW,
      feedbackByCodeTaskId: {
        "CODE-A": {
          codeTaskId: "CODE-A",
          parentTaskId: "TASK-A",
          status: "failed" as const,
          lastCauseLayer: "github_verify" as const,
          workItemIds: ["wi-a"],
          updatedAt: NOW,
        },
      },
    };
    const merged = mergeOrchestrationPatchIntoRequirementsState(
      { implementationCodeTaskExecutionFeedbackV1: feedback },
      {
        taskCursorExecutionV1: execution({ taskId: "TASK-B", status: "requested" }),
        implementationCodeTaskExecutionFeedbackV1: {
          ...feedback,
          feedbackByCodeTaskId: {
            ...feedback.feedbackByCodeTaskId,
            "CODE-B": {
              codeTaskId: "CODE-B",
              parentTaskId: "TASK-B",
              status: "not_started",
              workItemIds: ["wi-b"],
              updatedAt: NOW,
            },
          },
        },
      },
    );
    expect(merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "failed",
    );
    expect(
      merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCauseLayer,
    ).toBe("github_verify");
    expect(merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-B"]?.status).toBe(
      "not_started",
    );
  });
});

describe("client polling fallback policy", () => {
  it("does not use client polling in server mode by default", () => {
    expect(isServerTaskCursorPolling({})).toBe(true);
    expect(isServerTaskCursorPolling({ TASK_CURSOR_POLLING_MODE: "server" })).toBe(true);
    expect(isServerTaskCursorPolling({ TASK_CURSOR_POLLING_MODE: "client" })).toBe(false);
  });
});

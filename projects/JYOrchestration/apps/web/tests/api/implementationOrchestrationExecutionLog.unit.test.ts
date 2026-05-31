import { describe, expect, it } from "vitest";
import {
  buildImplementationOrchestrationChangeTimelineEntries,
  mergeImplementationExecutionLogTimeline,
  shouldAppendAutoImplementationExecutionLogEntries,
} from "@/lib/prototype/implementationOrchestrationExecutionLog";
import { TASK_CURSOR_EXECUTION_VERSION } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-05-30T12:00:00.000Z";

describe("implementationOrchestrationExecutionLog", () => {
  it("records task cursor success state changes when patch omits promptTimeline", () => {
    const prior = {
      taskCursorExecutionV1: {
        version: TASK_CURSOR_EXECUTION_VERSION,
        projectId: "p1",
        taskId: "DEV-001",
        workItemIds: ["w1"],
        status: "cursor_running",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-001",
        cursorRunId: "bc-123",
        createdAt: NOW,
        updatedAt: NOW,
      },
    };
    const next = {
      ...prior,
      taskCursorExecutionV1: {
        ...prior.taskCursorExecutionV1!,
        status: "github_verified",
        commitSha: "abc123def4567890abcdef1234567890abcdef12",
        changedFiles: ["src/a.ts"],
        updatedAt: NOW,
      },
    };
    const entries = buildImplementationOrchestrationChangeTimelineEntries({ prior, next, nowIso: NOW });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe("implementation_task_cursor_state_changed");
    expect(entries[0]?.responseText).toContain("status=github_verified");
    expect(entries[0]?.responseText).toContain("previousStatus=cursor_running");
  });

  it("auto-appends execution log entries when orchestration patch has no promptTimeline", () => {
    const prior = {};
    const next = {
      taskCursorExecutionV1: {
        version: TASK_CURSOR_EXECUTION_VERSION,
        projectId: "p1",
        taskId: "DEV-001",
        workItemIds: ["w1"],
        status: "cursor_completed",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-001",
        createdAt: NOW,
        updatedAt: NOW,
      },
    };
    expect(shouldAppendAutoImplementationExecutionLogEntries({})).toBe(true);
    const timeline = mergeImplementationExecutionLogTimeline({
      prior,
      next,
      patch: { taskCursorExecutionV1: next.taskCursorExecutionV1 },
      nowIso: NOW,
    });
    expect(timeline.some((entry) => entry.action === "implementation_task_cursor_state_changed")).toBe(true);
  });

  it("does not auto-append when patch already includes promptTimeline", () => {
    const prior = {};
    const next = {
      promptTimeline: [
        {
          stage: "implementation",
          action: "task_cursor_api_completed",
          source: "platform",
          createdAt: NOW,
        },
      ],
    };
    expect(shouldAppendAutoImplementationExecutionLogEntries({ promptTimeline: next.promptTimeline })).toBe(false);
    const timeline = mergeImplementationExecutionLogTimeline({
      prior,
      next,
      patch: { promptTimeline: next.promptTimeline },
      nowIso: NOW,
    });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.action).toBe("task_cursor_api_completed");
  });

  it("mergeImplementationExecutionLogTimeline preserves prior execution logs when patch replaces timeline", () => {
    const priorLog = {
      stage: "implementation",
      action: "task_cursor_execution_requested",
      source: "platform",
      orchestrationTraceGroup: "task_cursor_execution",
      responseText: "taskId=DEV-SCREEN-002 status=requested",
      createdAt: "2026-05-31T09:08:27.821Z",
    };
    const prior = { promptTimeline: [priorLog] };
    const nextLog = {
      stage: "implementation",
      action: "task_cursor_poll_tick",
      source: "platform",
      orchestrationTraceGroup: "task_cursor_execution",
      responseText: "taskId=DEV-SCREEN-002 round=1 agentStatus=RUNNING",
      createdAt: "2026-05-31T18:35:47.000Z",
    };
    const timeline = mergeImplementationExecutionLogTimeline({
      prior,
      next: { promptTimeline: [nextLog] },
      patch: { promptTimeline: [nextLog] },
      nowIso: NOW,
    });
    expect(timeline).toHaveLength(2);
    expect(timeline.map((entry) => entry.action)).toEqual([
      "task_cursor_execution_requested",
      "task_cursor_poll_tick",
    ]);
  });

  it("mergeImplementationExecutionLogTimeline does not re-merge when patch already has full execution log history", () => {
    const priorLog = {
      stage: "implementation",
      action: "task_cursor_execution_requested",
      source: "platform",
      orchestrationTraceGroup: "task_cursor_execution",
      responseText: "taskId=DEV-SCREEN-002 status=requested",
      createdAt: "2026-05-31T09:08:27.821Z",
    };
    const nextLog = {
      stage: "implementation",
      action: "task_cursor_poll_tick",
      source: "platform",
      orchestrationTraceGroup: "task_cursor_execution",
      responseText: "taskId=DEV-SCREEN-002 round=1 agentStatus=RUNNING",
      createdAt: "2026-05-31T18:35:47.000Z",
    };
    const timeline = mergeImplementationExecutionLogTimeline({
      prior: { promptTimeline: [priorLog] },
      next: { promptTimeline: [priorLog, nextLog] },
      patch: { promptTimeline: [priorLog, nextLog] },
      nowIso: NOW,
    });
    expect(timeline).toHaveLength(2);
    expect(timeline[1]?.action).toBe("task_cursor_poll_tick");
  });
});

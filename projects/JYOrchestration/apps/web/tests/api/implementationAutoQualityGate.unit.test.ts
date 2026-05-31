import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationAutoQualityGate,
  runImplementationAutoQualityGate,
  shouldAutoStartImplementationQualityGate,
  shouldResumeImplementationAutoQualityGate,
} from "@/lib/prototype/implementationAutoQualityGate";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markPostDeveloperReviewTasksQueued,
  summarizeImplementationTaskExecutionItems,
} from "@/lib/prototype/implementationTaskExecutionState";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-05-30T12:00:00.000Z";

function taskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-MOCK-001",
        title: "Mock dev",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "REV-1",
        title: "Review",
        description: "d",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "medium",
        dependencies: ["DEV-MOCK-001"],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "SEC-1",
        title: "Security",
        description: "d",
        taskType: "security",
        ownerRole: "security",
        priority: "medium",
        dependencies: ["REV-1"],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 0 },
  };
}

function executionStateDeveloperDone() {
  let state = buildInitialImplementationTaskExecutionStateFromTaskList({
    projectId: "p1",
    taskList: taskList(),
    nowIso: NOW,
  });
  state = {
    ...state,
    items: state.items.map((item) =>
      item.ownerRole === "developer" ? { ...item, status: "done" as const, completedAt: NOW } : item,
    ),
    summary: summarizeImplementationTaskExecutionItems(
      state.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "done" as const, completedAt: NOW } : item,
      ),
    ),
  };
  return markPostDeveloperReviewTasksQueued({ state, nowIso: NOW });
}

function verifiedExecution(): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-MOCK-001",
    workItemIds: ["wi-1"],
    status: "review_pending",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-mock-001",
    commitSha: "eb3db901234567890abcdef1234567890abcdef",
    changedFiles: ["src/a.ts", "src/b.ts"],
    cursorRunId: "run-1",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("implementationAutoQualityGate", () => {
  it("shouldAutoStart when github verified with commit and no prior gate", () => {
    expect(
      shouldAutoStartImplementationQualityGate({
        taskCursorExecution: verifiedExecution(),
        autoGate: null,
      }),
    ).toBe(true);
  });

  it("creates review_running gate on auto run start", () => {
    const list = taskList();
    const execution = verifiedExecution();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: list,
        implementationTaskExecutionStateV1: executionStateDeveloperDone(),
        taskCursorExecutionV1: execution,
      },
    });
    const outcome = runImplementationAutoQualityGate({
      projectId: "p1",
      taskCursorExecution: execution,
      taskList: list,
      executionState: executionStateDeveloperDone(),
      board,
      nowIso: NOW,
    });
    expect("blocked" in outcome).toBe(false);
    if ("blocked" in outcome) return;
    expect(outcome.autoGate.status).toBe("passed");
    expect(outcome.orchestrationPatch.implementationAutoQualityGateV1?.status).toBe("passed");
    expect(outcome.orchestrationPatch.taskCursorExecutionV1?.status).toBe("scm_pending");
  });

  it("passes auto gate when execution state was missing but github verified", () => {
    const list = taskList();
    const execution = verifiedExecution();
    const outcome = runImplementationAutoQualityGate({
      projectId: "p1",
      taskCursorExecution: execution,
      taskList: list,
      executionState: null,
      nowIso: NOW,
    });
    expect("blocked" in outcome).toBe(false);
    if ("blocked" in outcome) return;
    expect(outcome.autoGate.status).toBe("passed");
    expect(
      outcome.orchestrationPatch.implementationTaskExecutionStateV1?.items.find(
        (item) => item.taskId === "DEV-MOCK-001" && item.ownerRole === "developer",
      )?.status,
    ).toBe("done");
  });

  it("review fail skips security and marks gate failed", () => {
    const list = taskList();
    const execution = verifiedExecution();
    let state = executionStateDeveloperDone();
    state = {
      ...state,
      items: state.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        state.items.map((item) =>
          item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
        ),
      ),
    };
    const outcome = runImplementationAutoQualityGate({
      projectId: "p1",
      taskCursorExecution: execution,
      taskList: list,
      executionState: state,
      nowIso: NOW,
    });
    expect("blocked" in outcome).toBe(false);
    if ("blocked" in outcome) return;
    expect(outcome.ok).toBe(false);
    expect(outcome.autoGate.status).toBe("failed");
    expect(outcome.autoGate.securityResultId).toBeUndefined();
  });

  it("shouldResume when gate is in flight for same commit", () => {
    const execution = verifiedExecution();
    const gate = buildInitialImplementationAutoQualityGate({
      projectId: "p1",
      taskId: execution.taskId,
      sourceCommitSha: execution.commitSha!,
      nowIso: NOW,
    });
    expect(
      shouldResumeImplementationAutoQualityGate({
        taskCursorExecution: execution,
        autoGate: gate,
      }),
    ).toBe(true);
    expect(
      shouldAutoStartImplementationQualityGate({
        taskCursorExecution: execution,
        autoGate: gate,
      }),
    ).toBe(false);
  });
});

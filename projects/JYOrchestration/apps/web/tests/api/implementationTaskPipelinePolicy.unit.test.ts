import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoardFromRequirementsState,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationTaskTreeNodes } from "@/lib/prototype/implementationExecutionBoardPanelView";
import {
  derivePerTaskPipelineRole,
  isPerTaskPipelineComplete,
} from "@/lib/prototype/implementationTaskPipelinePolicy";
import { runImplementationAutoQualityGate } from "@/lib/prototype/implementationAutoQualityGate";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
  summarizeImplementationTaskExecutionItems,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-31T12:00:00.000Z";

function sampleList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-1",
        title: "Dev",
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
        dependencies: ["DEV-1"],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 0, scm: 0 },
  };
}

describe("implementationTaskPipelinePolicy", () => {
  it("marks task complete after developer is done (review is integrated)", () => {
    expect(
      isPerTaskPipelineComplete({
        developerStatus: "done",
        reviewerStatus: "done",
      }),
    ).toBe(true);
    expect(
      derivePerTaskPipelineRole({
        developerStatus: "done",
        reviewerStatus: "ready",
      }),
    ).toBe("completed");
  });

  it("task tree nests code tasks under process tasks", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const nodes = buildImplementationTaskTreeNodes({ board, activeTaskId: "DEV-1" });
    expect(nodes[0]?.metaLines.some((m) => m.label === "역할" && m.value === "AI 개발자")).toBe(true);
    expect(nodes[0]?.title).not.toContain("DEV-1");
  });

  it("auto quality gate skips per-task security and continues chain", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList: sampleList(),
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
    state = markPostDeveloperReviewTasksQueued({ state, nowIso: NOW });
    const outcome = runImplementationAutoQualityGate({
      projectId: "p1",
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-1",
        workItemIds: ["wi-1"],
        status: "review_pending",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-1",
        commitSha: "abc123def4567890abcdef1234567890abcdef",
        changedFiles: ["src/a.ts"],
        createdAt: NOW,
        updatedAt: NOW,
      },
      taskList: sampleList(),
      executionState: state,
      nowIso: NOW,
    });
    expect("blocked" in outcome).toBe(false);
    if ("blocked" in outcome) return;
    expect(outcome.autoGate.status).toBe("passed");
    expect(outcome.autoGate.securityResultId).toBeUndefined();
    expect(outcome.message).toContain("통합 단계");
    expect(
      outcome.orchestrationPatch.implementationTaskExecutionStateV1?.items.some(
        (item) => item.ownerRole === "security" && item.status === "done",
      ),
    ).toBe(false);
  });

  it("task tree shows reviewer waiting when developer failed even if another task passed review", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList: sampleList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.ownerRole === "developer" && item.taskId === "DEV-1"
          ? { ...item, status: "done" as const, completedAt: NOW }
          : item,
      ),
    };
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: sampleList(),
        implementationTaskExecutionStateV1: state,
        implementationQualityGateResultsV1: [
          {
            version: "implementation_quality_gate_result_v1",
            role: "reviewer",
            status: "passed",
            createdAt: NOW,
            updatedAt: NOW,
            source: "mock_local_gate",
            summary: "pass",
            checks: [{ id: "c1", title: "DEV-1 검수", status: "passed", targetTaskIds: ["DEV-1"] }],
            failedTaskIds: [],
          },
        ],
      },
    })!;
    const failedDevBoard = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: {
          ...sampleList(),
          tasks: [
            ...sampleList().tasks,
            {
              taskId: "DEV-2",
              title: "Fail screen",
              description: "d",
              taskType: "screen",
              ownerRole: "developer",
              priority: "medium",
              dependencies: ["DEV-1"],
              acceptanceCriteria: [],
              status: "ready",
            },
          ],
          roleSummary: { developer: 2, designer: 0, reviewer: 1, security: 0, scm: 0 },
        },
        implementationTaskExecutionStateV1: {
          ...state,
          items: [
            ...state.items,
            {
              taskId: "DEV-2",
              ownerRole: "developer",
              status: "failed",
              errorMessage: "cursor failed",
              completedAt: NOW,
            },
          ],
        },
        implementationQualityGateResultsV1: [
          {
            version: "implementation_quality_gate_result_v1",
            role: "reviewer",
            status: "passed",
            createdAt: NOW,
            updatedAt: NOW,
            source: "mock_local_gate",
            summary: "pass",
            checks: [{ id: "c1", title: "DEV-1 검수", status: "passed", targetTaskIds: ["DEV-1"] }],
            failedTaskIds: [],
          },
        ],
      },
    })!;
    const dev2Node = buildImplementationTaskTreeNodes({
      board: failedDevBoard,
      activeTaskId: "DEV-2",
    }).find((node) => node.taskId === "DEV-2");
    expect(dev2Node?.metaLines.find((m) => m.label === "상태")?.value).toBe("실패");
  });
});

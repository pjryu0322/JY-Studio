import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoard,
  buildNextDeveloperTaskContinuationNotice,
  canContinueTaskDespiteUserConfirmation,
  filterCursorWorkItemsForExecutableTask,
  formatBoardExecutionTargetLines,
  isImplementationBoardComplete,
  buildReworkRequestRegistrationNotice,
  explainReworkRequestTarget,
  explainExecutableTaskSelection,
  pickFirstExecutableDeveloperTaskId,
  pickQualityGateTargetTaskIds,
  pickTaskIdForReworkRequest,
  resolveTaskRowUserRestartCapability,
  deriveImplementationBoardInterviewChips,
} from "@/lib/prototype/implementationExecutionBoard";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
import {
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_ALL_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  REVIEWER_CHECK_CHIP,
  SECURITY_CHECK_CHIP,
  DESIGNER_REVIEW_CHIP,
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  appendReworkRequest,
  markReworkRequestsDoneForTask,
  parseImplementationExecutionBoardStateV1,
  type ImplementationExecutionBoardStateV1,
} from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import {
  buildInitialImplementationIntegratedExecutionState,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";

const workItems: readonly CursorWorkItem[] = [
  {
    id: "wi-1",
    taskId: "dev-1",
    title: "업로드 화면 구현",
    prompt: "p",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: [],
    forbiddenPaths: [],
    blocked: false,
    blockers: [],
    qualityGate: { score: 1, promptReady: true, missing: [] },
  },
  {
    id: "wi-2",
    taskId: "dev-2",
    title: "결과 화면 구현",
    prompt: "p",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: [],
    forbiddenPaths: [],
    blocked: false,
    blockers: [],
    qualityGate: { score: 1, promptReady: true, missing: [] },
  },
];

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p-board",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "업로드 화면 구현",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "dev-2",
        title: "결과 화면 구현",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "medium",
        dependencies: ["dev-1"],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "rev-1",
        title: "검수",
        description: "d",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "sec-1",
        title: "보안",
        description: "d",
        taskType: "validation",
        ownerRole: "security",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "scm-1",
        title: "SCM",
        description: "d",
        taskType: "validation",
        ownerRole: "scm",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 2, designer: 0, reviewer: 1, security: 1, scm: 1 },
  };
}

function executionStateWithDeveloperDone() {
  let state = buildInitialImplementationTaskExecutionStateFromTaskList({
    projectId: "p-board",
    taskList: sampleTaskList(),
    nowIso: NOW,
  });
  state = markDeveloperTasksDoneForWip({ state, cursorWorkItems: workItems, nowIso: NOW });
  state = markPostDeveloperReviewTasksQueued({ state, nowIso: NOW });
  return state;
}

function reviewerQualityGatePassedForDeveloperTasks(
  taskIds: readonly string[],
): readonly ImplementationQualityGateResultV1[] {
  return [
    {
      version: "implementation_quality_gate_result_v1",
      role: "reviewer",
      status: "passed",
      createdAt: NOW,
      updatedAt: NOW,
      source: "mock_local_gate",
      summary: "pass",
      checks: taskIds.map((taskId, index) => ({
        id: `review-pass-${index}`,
        title: `${taskId} 검수`,
        status: "passed" as const,
        targetTaskIds: [taskId],
      })),
      failedTaskIds: [],
    },
  ];
}

describe("implementationExecutionBoard", () => {
  it("creates task rows from developer tasks", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(board.taskRows).toHaveLength(2);
    expect(board.taskRows.map((r) => r.taskId)).toEqual(["dev-1", "dev-2"]);
  });

  it("maps developer execution status", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.taskId === "dev-1" ? { ...item, status: "in_progress" as const } : item,
      ),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.developerStatus).toBe("in_progress");
  });

  it("includes reviewer/security/scm columns from global role summary", () => {
    const state = executionStateWithDeveloperDone();
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    for (const row of board.taskRows) {
      expect(row.reviewerStatus).toBe("queued");
      expect(row.securityStatus).toBe("queued");
      expect(row.scmStatus).toBe("queued");
    }
  });

  it("creates integrated rows", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(board.integratedRows.map((r) => r.step)).toEqual([
      "refactor_common",
      "integrated_review",
      "integrated_security",
      "final_scm",
    ]);
  });

  it("currentRole is developer when developer not done", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.currentRole).toBe("developer");
  });

  it("currentRole is completed when developer done (per-task reviewer is integrated stage)", () => {
    const state = executionStateWithDeveloperDone();
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.currentRole).toBe("completed");
    expect(board.taskRows[0]?.reviewerStatus).not.toBe("done");
  });

  it("currentRole is completed when per-task developer and reviewer quality gate are done", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "passed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "pass",
        checks: [
          { id: "dev-1", title: "dev-1 검수", status: "passed", targetTaskIds: ["dev-1"] },
          { id: "dev-2", title: "dev-2 검수", status: "passed", targetTaskIds: ["dev-2"] },
        ],
        failedTaskIds: [],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(board.taskRows.every((row) => row.currentRole === "completed")).toBe(true);
  });

  it("does not mark reviewer done on developer-failed task when global reviewer is done", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) => {
        if (item.ownerRole !== "developer") return item;
        if (item.taskId === "dev-1") {
          return { ...item, status: "done" as const, completedAt: NOW };
        }
        if (item.taskId === "dev-2") {
          return { ...item, status: "failed" as const, completedAt: NOW, errorMessage: "cursor failed" };
        }
        return item;
      }),
    };
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "passed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "pass",
        checks: [{ id: "dev-1", title: "dev-1 검수", status: "passed", targetTaskIds: ["dev-1"] }],
        failedTaskIds: [],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.reviewerStatus).toBe("done");
    expect(board.taskRows[1]?.reviewerStatus).toBe("not_started");
    expect(board.taskRows[1]?.developerStatus).toBe("failed");
  });

  it("canContinueTaskDespiteUserConfirmation respects blocking policy", () => {
    expect(canContinueTaskDespiteUserConfirmation("none")).toBe(true);
    expect(canContinueTaskDespiteUserConfirmation("optional")).toBe(true);
    expect(canContinueTaskDespiteUserConfirmation("required_non_blocking")).toBe(true);
    expect(canContinueTaskDespiteUserConfirmation("blocking")).toBe(false);
  });

  it("refactor_common is not_started before task rows complete", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(board.integratedRows.find((r) => r.step === "refactor_common")?.status).toBe("not_started");
  });

  it("does not mark refactor_common done from global reviewer/security/scm done alone", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    expect(board.integratedRows.find((r) => r.step === "refactor_common")?.status).toBe("ready");
    expect(board.integratedRows.find((r) => r.step === "integrated_review")?.status).toBe("not_started");
  });

  it("isImplementationBoardComplete false when task roles done but integrated steps not done", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    expect(isImplementationBoardComplete({ board, previewReady: true })).toBe(false);
  });

  it("isImplementationBoardComplete false when integrated rows not done", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    const incompleteBoard = {
      ...board,
      integratedRows: board.integratedRows.map((row) =>
        row.step === "final_scm" ? { ...row, status: "ready" as const } : row,
      ),
    };
    expect(isImplementationBoardComplete({ board: incompleteBoard, previewReady: true })).toBe(false);
  });

  it("isImplementationBoardComplete false when previewReady false", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    expect(isImplementationBoardComplete({ board, previewReady: false })).toBe(false);
  });

  it("isImplementationBoardComplete false when blocking confirmation exists", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    const withBlocking = {
      ...board,
      taskRows: board.taskRows.map((row, index) =>
        index === 0
          ? {
              ...row,
              userConfirmation: "blocking" as const,
              canContinueWithoutUserConfirmation: false,
            }
          : row,
      ),
      summary: { ...board.summary, blockingUserConfirmation: 1 },
    };
    expect(isImplementationBoardComplete({ board: withBlocking, previewReady: true })).toBe(false);
  });

  it("isImplementationBoardComplete true when all integrated steps done in persisted state", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const integratedExecutionState = {
      ...buildInitialImplementationIntegratedExecutionState({ projectId: "p-board", nowIso: NOW }),
      items: buildInitialImplementationIntegratedExecutionState({
        projectId: "p-board",
        nowIso: NOW,
      }).items.map((item) => ({ ...item, status: "done" as const })),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      integratedExecutionState,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    expect(isImplementationBoardComplete({ board, previewReady: true })).toBe(true);
  });

  it("applies quality gate failedTaskIds only to matching task row", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.taskId === "dev-1" && item.ownerRole === "developer"
          ? { ...item, status: "done" as const, completedAt: NOW }
          : item,
      ),
    };
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "fail",
        checks: [],
        failedTaskIds: ["dev-1"],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.reviewerStatus).toBe("failed");
    expect(board.taskRows[0]?.failureReason).toBe("failed_by_review");
    expect(board.taskRows[1]?.reviewerStatus).not.toBe("failed");
  });

  it("applies security quality gate failedTaskIds only to matching task row", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.taskId === "dev-2" && item.ownerRole === "developer"
          ? { ...item, status: "done" as const, completedAt: NOW }
          : item,
      ),
    };
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "security",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "fail",
        checks: [],
        failedTaskIds: ["dev-2"],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(board.taskRows[1]?.securityStatus).toBe("failed");
    expect(board.taskRows[1]?.failureReason).toBe("failed_by_security");
    expect(board.taskRows[0]?.securityStatus).not.toBe("failed");
  });

  it("pickFirstExecutableDeveloperTaskId respects dependencies and blocking confirmation", () => {
    const boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p-board",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [{ taskId: "dev-2", status: "blocking" }],
      reworkRequests: [],
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      boardState: boardState ?? null,
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-1");
  });

  it("reflects boardState user confirmation and rework count on rows", () => {
    const boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p-board",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [
        { taskId: "dev-1", status: "required_non_blocking", reason: "확인" },
        { taskId: "dev-2", status: "blocking", reason: "차단" },
      ],
      reworkRequests: [
        {
          requestId: "rw-1",
          taskId: "dev-1",
          targetRole: "developer",
          reason: "재작업",
          status: "requested",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      boardState: boardState ?? null,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.userConfirmation).toBe("required_non_blocking");
    expect(board.taskRows[0]?.reworkCount).toBe(1);
    expect(board.summary.userConfirmationRequired).toBe(2);
    expect(board.summary.blockingUserConfirmation).toBe(1);
    expect(board.taskRows[1]?.userConfirmation).toBe("blocking");
  });

  it("filterCursorWorkItemsForExecutableTask selects dev-1 when no dependency", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const scoped = filterCursorWorkItemsForExecutableTask({ board, workItems });
    expect(scoped.selectedTaskId).toBe("dev-1");
    expect(scoped.selectedWorkItems.map((w) => w.taskId)).toEqual(["dev-1"]);
  });

  it("filterCursorWorkItemsForExecutableTask skips unmet dependencies", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-1");
    const scoped = filterCursorWorkItemsForExecutableTask({ board, workItems });
    expect(scoped.selectedTaskId).not.toBe("dev-2");
  });

  it("filterCursorWorkItemsForExecutableTask skips blocking user confirmation", () => {
    const taskList = {
      ...sampleTaskList(),
      tasks: sampleTaskList().tasks.map((task) =>
        task.taskId === "dev-2" ? { ...task, dependencies: [] } : task,
      ),
    };
    const boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p-board",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [{ taskId: "dev-1", status: "blocking", reason: "차단" }],
      reworkRequests: [],
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      boardState: boardState ?? null,
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-2");
    const scoped = filterCursorWorkItemsForExecutableTask({ board, workItems });
    expect(scoped.selectedTaskId).toBe("dev-2");
    expect(scoped.selectedWorkItems.map((w) => w.taskId)).toEqual(["dev-2"]);
  });

  it("filterCursorWorkItemsForExecutableTask returns blockedReason when no workItem for selected task", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const scoped = filterCursorWorkItemsForExecutableTask({
      board,
      workItems: workItems.filter((w) => w.taskId !== "dev-1"),
    });
    expect(scoped.selectedTaskId).toBe("dev-1");
    expect(scoped.selectedWorkItems).toHaveLength(0);
    expect(scoped.blockedReason).toContain("dev-1");
  });

  it("buildNextDeveloperTaskContinuationNotice suggests next task after dev-1 done", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = markDeveloperTasksDoneForWip({
      state,
      cursorWorkItems: workItems.filter((w) => w.taskId === "dev-1"),
      nowIso: NOW,
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-2");
    const notice = buildNextDeveloperTaskContinuationNotice(board);
    expect(notice).toContain("다음 실행 가능 작업: dev-2");
    expect(notice).toContain("[생성요청]");
  });

  it("formatBoardExecutionTargetLines shows 다음 실행 대상 for ready developer task", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const lines = formatBoardExecutionTargetLines(board);
    expect(lines[0]).toBe("다음 실행 대상:");
    expect(lines[1]).toContain("dev-1");
    expect(lines[1]).toContain("AI 개발자");
  });

  it("formatBoardExecutionTargetLines shows 현재 실행 중 when developer in progress", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.taskId === "dev-1" ? { ...item, status: "in_progress" as const } : item,
      ),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    const lines = formatBoardExecutionTargetLines(board);
    expect(lines[0]).toBe("현재 실행 중:");
    expect(lines[1]).toContain("dev-1");
  });

  it("buildImplementationExecutionBoardMessage includes 다음 실행 대상", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const message = buildImplementationExecutionBoardMessage({ board, nowIso: NOW });
    expect(message.content).toContain("다음 실행 대상:");
    expect(message.content).toContain("dev-1");
    expect(message.content).not.toContain("현재 실행 중:");
    expect(message.content).toContain("선정 사유:");
  });

  it("explainExecutableTaskSelection returns dependency reason for ready task", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const taskId = pickFirstExecutableDeveloperTaskId(board);
    expect(taskId).toBe("dev-1");
    expect(explainExecutableTaskSelection({ board, taskId: taskId! })).toBe("우선순위 high");
  });

  it("initial board chips are minimized before developer work starts", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const chips = deriveImplementationBoardInterviewChips({ board, envOk: true });
    expect(chips).toEqual([IMPLEMENTATION_GENERATION_REQUEST_CHIP, IMPLEMENTATION_ENV_SETTINGS_LABEL]);
    expect(chips).not.toContain(TASK_LIST_VIEW_CHIP);
    expect(chips).not.toContain(IMPLEMENTATION_EXECUTION_BOARD_CHIP);
    expect(chips).not.toContain(REVIEWER_CHECK_CHIP);
    expect(chips).not.toContain(SECURITY_CHECK_CHIP);
    expect(chips).not.toContain(DESIGNER_REVIEW_CHIP);
    expect(chips).not.toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
  });

  it("unified board message includes task summary when includeTaskSummary", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      nowIso: NOW,
    });
    const message = buildImplementationExecutionBoardMessage({
      board,
      taskList,
      includeTaskSummary: true,
      nowIso: NOW,
    });
    expect(message.content).toContain("구현 작업목록이 준비되었습니다");
    expect(message.content).toContain("전체 작업:");
    expect(message.content).toContain("AI 개발자:");
    expect(message.meta?.interviewSuggestions).toEqual([
      IMPLEMENTATION_GENERATION_REQUEST_CHIP,
      IMPLEMENTATION_ENV_SETTINGS_LABEL,
    ]);
  });

  it("buildImplementationExecutionBoardMessage includes rework column", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const message = buildImplementationExecutionBoardMessage({ board, nowIso: NOW });
    expect(message.content).toContain("구현 작업 보드입니다");
    expect(message.content).toContain(
      "TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM | 사용자 확인 | 재작업 | 상태",
    );
    expect(message.content).toContain("통합 정리 단계:");
    expect(message.content).toContain("리팩토링/공통화");
    expect(message.content).toContain("재작업");
    expect(message.meta?.interviewSuggestions).toContain("생성요청");
  });

  it("pickFirstExecutableDeveloperTaskId prefers quality-failed task over normal ready task", () => {
    const taskList = {
      ...sampleTaskList(),
      tasks: sampleTaskList().tasks.map((task) =>
        task.ownerRole === "developer" ? { ...task, dependencies: [] as string[] } : task,
      ),
    };
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "검수 실패",
        checks: [],
        failedTaskIds: ["dev-2"],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-2");
  });

  it("pickFirstExecutableDeveloperTaskId prefers rework task before normal ready task", () => {
    const taskList = {
      ...sampleTaskList(),
      tasks: [
        ...sampleTaskList().tasks.filter((t) => t.ownerRole === "developer"),
        {
          taskId: "dev-3",
          title: "추가",
          description: "d",
          taskType: "screen" as const,
          ownerRole: "developer" as const,
          priority: "low" as const,
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready" as const,
        },
      ],
    };
    const boardState = appendReworkRequest({
      state: null,
      projectId: "p-board",
      taskId: "dev-3",
      targetRole: "developer",
      reason: "재작업",
      nowIso: NOW,
      requestId: "rw-dev3",
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      boardState,
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-3");
  });

  it("pickFirstExecutableDeveloperTaskId skips failed developer task until rework is requested", () => {
    const taskList = {
      ...sampleTaskList(),
      tasks: sampleTaskList().tasks.map((task) =>
        task.ownerRole === "developer" ? { ...task, dependencies: [] as string[] } : task,
      ),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      executionState: {
        version: "implementation_task_execution_state_v1",
        projectId: "p-board",
        createdAt: NOW,
        updatedAt: NOW,
        items: [
          {
            taskId: "dev-1",
            ownerRole: "developer",
            status: "failed",
            updatedAt: NOW,
            errorMessage: "poll cancelled",
          },
          {
            taskId: "dev-2",
            ownerRole: "developer",
            status: "queued",
            updatedAt: NOW,
          },
        ],
        summary: { total: 2, done: 0, inProgress: 0, failed: 1, skipped: 0, queued: 1 },
      },
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-2");
  });

  it("pickFirstExecutableDeveloperTaskId skips blocking task even when quality failed", () => {
    const taskList = {
      ...sampleTaskList(),
      tasks: sampleTaskList().tasks.map((task) =>
        task.ownerRole === "developer" ? { ...task, dependencies: [] as string[] } : task,
      ),
    };
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "검수 실패",
        checks: [],
        failedTaskIds: ["dev-1"],
      },
    ];
    const boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p-board",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [{ taskId: "dev-1", status: "blocking", reason: "차단" }],
      reworkRequests: [],
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      boardState: boardState ?? null,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-2");
  });

  it("pickTaskIdForReworkRequest prefers quality-failed task", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "fail",
        checks: [],
        failedTaskIds: ["dev-2"],
      },
    ];
    const taskList = {
      ...sampleTaskList(),
      tasks: sampleTaskList().tasks.map((task) =>
        task.ownerRole === "developer" ? { ...task, dependencies: [] as string[] } : task,
      ),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(pickTaskIdForReworkRequest(board)).toBe("dev-2");
  });

  it("pickQualityGateTargetTaskIds returns failed reviewer tasks first", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "fail",
        checks: [],
        failedTaskIds: ["dev-2"],
      },
    ];
    const taskList = {
      ...sampleTaskList(),
      tasks: sampleTaskList().tasks.map((task) =>
        task.ownerRole === "developer" ? { ...task, dependencies: [] as string[] } : task,
      ),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      qualityGateResults,
      nowIso: NOW,
    });
    expect(pickQualityGateTargetTaskIds({ role: "reviewer", board })).toEqual(["dev-2"]);
  });

  it("pickQualityGateTargetTaskIds falls back to taskCursorTaskId when developer not marked done", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    expect(pickQualityGateTargetTaskIds({ role: "reviewer", board })).toEqual([]);
    expect(
      pickQualityGateTargetTaskIds({
        role: "reviewer",
        board,
        taskCursorTaskId: "dev-1",
      }),
    ).toEqual(["dev-1"]);
  });

  it("legacy and 전체 처리 confirmation chips map to RESOLVE_USER_CONFIRMATION", () => {
    expect(mapImplementationChipToAction(IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP)).toBe(
      "RESOLVE_USER_CONFIRMATION",
    );
    expect(mapImplementationChipToAction(IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_ALL_CHIP)).toBe(
      "RESOLVE_USER_CONFIRMATION",
    );
  });

  it("explainReworkRequestTarget returns security failure reason", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "security",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "fail",
        checks: [],
        failedTaskIds: ["dev-1"],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      qualityGateResults,
      nowIso: NOW,
    });
    expect(explainReworkRequestTarget({ board, taskId: "dev-1" })).toBe("AI 보안관 점검 실패 작업");
    expect(buildReworkRequestRegistrationNotice({ board, taskId: "dev-1" })).toContain(
      "AI 보안관 점검 실패 작업",
    );
  });

  it("explainReworkRequestTarget returns developer failure reason", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) =>
        item.taskId === "dev-2" ? { ...item, status: "failed" as const } : item,
      ),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(explainReworkRequestTarget({ board, taskId: "dev-2" })).toBe("개발자 작업 실패");
  });

  it("explainReworkRequestTarget returns reviewer failure reason", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "fail",
        checks: [],
        failedTaskIds: ["dev-2"],
      },
    ];
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      qualityGateResults,
      nowIso: NOW,
    });
    expect(explainReworkRequestTarget({ board, taskId: "dev-2" })).toBe("AI 검수자 점검 실패 작업");
    const notice = buildReworkRequestRegistrationNotice({ board, taskId: "dev-2" });
    expect(notice).toContain("AI 검수자 점검 실패 작업");
    expect(notice).toContain("AI 개발자에게 보완 요청");
  });

  it("after rework done pickFirstExecutableDeveloperTaskId prefers active rework on another task", () => {
    let boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p-board",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [],
      reworkRequests: [],
    });
    boardState = appendReworkRequest({
      state: boardState,
      projectId: "p-board",
      taskId: "dev-1",
      targetRole: "developer",
      reason: "closed",
      nowIso: NOW,
    });
    boardState = markReworkRequestsDoneForTask({
      state: boardState,
      projectId: "p-board",
      taskId: "dev-1",
      nowIso: NOW,
    });
    boardState = appendReworkRequest({
      state: boardState,
      projectId: "p-board",
      taskId: "dev-2",
      targetRole: "developer",
      reason: "active",
      nowIso: NOW,
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: executionStateWithDeveloperDone(),
      boardState,
      nowIso: NOW,
    });
    expect(board.taskRows.find((r) => r.taskId === "dev-1")?.reworkCount).toBe(0);
    expect(board.taskRows.find((r) => r.taskId === "dev-2")?.reworkCount).toBe(1);
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("dev-2");
  });

  it("resolveTaskRowUserRestartCapability allows failed task with dependency met", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) => {
        if (item.taskId === "dev-1" && item.ownerRole === "developer") {
          return { ...item, status: "done" as const, completedAt: NOW };
        }
        if (item.taskId === "dev-2" && item.ownerRole === "developer") {
          return { ...item, status: "failed" as const, completedAt: NOW, errorMessage: "fail" };
        }
        return item;
      }),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    const row = board.taskRows.find((item) => item.taskId === "dev-2");
    expect(row).toBeTruthy();
    expect(
      resolveTaskRowUserRestartCapability({
        row: row!,
        board,
      }),
    ).toEqual({
      canRestart: true,
      needsReworkRegistration: false,
    });
    expect(pickTaskIdForReworkRequest(board, "dev-2")).toBe("dev-2");
  });

  it("resolveTaskRowUserRestartCapability blocks completed task restart", () => {
    const state = executionStateWithDeveloperDone();
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      qualityGateResults: reviewerQualityGatePassedForDeveloperTasks(["dev-1", "dev-2"]),
      nowIso: NOW,
    });
    const row = board.taskRows.find((item) => item.taskId === "dev-1");
    expect(
      resolveTaskRowUserRestartCapability({
        row: row!,
        board,
      }).canRestart,
    ).toBe(false);
  });

  it("resolveTaskRowUserRestartCapability allows restart when same task cursor state is stale", () => {
    let state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    state = {
      ...state,
      items: state.items.map((item) => {
        if (item.taskId === "dev-1" && item.ownerRole === "developer") {
          return { ...item, status: "done" as const, completedAt: NOW };
        }
        if (item.taskId === "dev-2" && item.ownerRole === "developer") {
          return { ...item, status: "failed" as const, completedAt: NOW, errorMessage: "fail" };
        }
        return item;
      }),
    };
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    const row = board.taskRows.find((item) => item.taskId === "dev-2");
    expect(row).toBeTruthy();
    expect(
      resolveTaskRowUserRestartCapability({
        row: row!,
        board,
        taskCursorExecution: {
          version: "task_cursor_execution_v1",
          projectId: "p-board",
          taskId: "dev-2",
          workItemIds: ["w-dev-2"],
          status: "cursor_running",
          cursorProvider: "cursor",
          targetRepository: "owner/repo",
          baseBranch: "main",
          workBranch: "wip/dev-2",
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    ).toEqual({
      canRestart: true,
      needsReworkRegistration: false,
    });
  });

  it("resolveTaskRowUserRestartCapability blocks restart when another task cursor is actively running", () => {
    const state = executionStateWithDeveloperDone();
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    const row = board.taskRows.find((item) => item.taskId === "dev-2");
    expect(row).toBeTruthy();
    expect(
      resolveTaskRowUserRestartCapability({
        row: row!,
        board,
        taskCursorExecution: {
          version: "task_cursor_execution_v1",
          projectId: "p-board",
          taskId: "dev-1",
          workItemIds: ["w-dev-1"],
          status: "cursor_running",
          cursorProvider: "cursor",
          targetRepository: "owner/repo",
          baseBranch: "main",
          workBranch: "wip/dev-1",
          cursorRunId: "bc-aa13fda9-21e2-4d4b-af82-6006c4fbc40e",
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    ).toEqual({
      canRestart: false,
      needsReworkRegistration: false,
      blockedReason: "다른 Task의 Cursor 실행이 진행 중입니다.",
    });
  });

  it("buildImplementationExecutionBoard tolerates missing tasks/items/reworkRequests/failedTaskIds", () => {
    const taskList = {
      ...sampleTaskList(),
      tasks: undefined,
    } as unknown as ImplementationTaskListV1;
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList,
      executionState: {
        version: "implementation_task_execution_state_v1",
        projectId: "p-board",
        createdAt: NOW,
        updatedAt: NOW,
        items: undefined,
        summary: { total: 0, ready: 0, queued: 0, inProgress: 0, done: 0, failed: 0, skipped: 0 },
      } as unknown as ImplementationTaskExecutionStateV1,
      boardState: {
        version: "implementation_execution_board_state_v1",
        projectId: "p-board",
        createdAt: NOW,
        updatedAt: NOW,
        userConfirmations: undefined,
        reworkRequests: undefined,
      } as unknown as ImplementationExecutionBoardStateV1,
      qualityGateResults: [
        {
          version: "implementation_quality_gate_result_v1",
          role: "reviewer",
          status: "failed",
          createdAt: NOW,
          updatedAt: NOW,
          source: "mock_local_gate",
          summary: "fail",
          checks: [],
          failedTaskIds: undefined,
        } as ImplementationQualityGateResultV1,
      ],
      integrationPipelineUnlocked: true,
      nowIso: NOW,
    });
    expect(board.taskRows).toEqual([]);
  });
});

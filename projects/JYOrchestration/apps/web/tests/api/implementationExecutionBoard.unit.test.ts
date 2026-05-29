import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoard,
  buildNextDeveloperTaskContinuationNotice,
  canContinueTaskDespiteUserConfirmation,
  filterCursorWorkItemsForExecutableTask,
  formatBoardExecutionTargetLines,
  isImplementationBoardComplete,
  pickFirstExecutableDeveloperTaskId,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import { parseImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
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

  it("currentRole is reviewer when developer done but reviewer not done", () => {
    const state = executionStateWithDeveloperDone();
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.currentRole).toBe("reviewer");
  });

  it("currentRole is security when reviewer done but security not done", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.currentRole).toBe("security");
  });

  it("currentRole is scm when security done but scm not done", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.currentRole).toBe("scm");
  });

  it("currentRole is completed when all role steps done", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    expect(board.taskRows.every((row) => row.currentRole === "completed")).toBe(true);
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
      nowIso: NOW,
    });
    expect(isImplementationBoardComplete({ board, previewReady: true })).toBe(true);
  });

  it("applies quality gate failedTaskIds only to matching task row", () => {
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
      qualityGateResults,
      nowIso: NOW,
    });
    expect(board.taskRows[0]?.reviewerStatus).toBe("failed");
    expect(board.taskRows[0]?.failureReason).toBe("failed_by_review");
    expect(board.taskRows[1]?.reviewerStatus).not.toBe("failed");
  });

  it("applies security quality gate failedTaskIds only to matching task row", () => {
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
});

import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoard,
  canContinueTaskDespiteUserConfirmation,
  isImplementationBoardComplete,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
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

  it("refactor_common progresses when all task rows and roles complete", () => {
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
    expect(board.integratedRows.find((r) => r.step === "refactor_common")?.status).toBe("done");
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

  it("isImplementationBoardComplete true when all rows done and previewReady", () => {
    let state = executionStateWithDeveloperDone();
    state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
    state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
    const baseBoard = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: state,
      nowIso: NOW,
    });
    const board = {
      ...baseBoard,
      integratedRows: baseBoard.integratedRows.map((row) => ({ ...row, status: "done" as const })),
    };
    expect(isImplementationBoardComplete({ board, previewReady: true })).toBe(true);
  });

  it("buildImplementationExecutionBoardMessage includes board columns and integrated stage", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const message = buildImplementationExecutionBoardMessage({ board, nowIso: NOW });
    expect(message.content).toContain("구현 작업 보드입니다");
    expect(message.content).toContain("TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM | 사용자 확인 | 상태");
    expect(message.content).toContain("통합 정리 단계:");
    expect(message.content).toContain("리팩토링/공통화");
    expect(message.content).toContain("현재 실행 중:");
    expect(message.meta?.interviewSuggestions).toContain("생성요청");
  });
});

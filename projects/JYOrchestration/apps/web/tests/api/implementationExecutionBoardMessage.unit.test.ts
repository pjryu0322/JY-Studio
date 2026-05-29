import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoard,
  buildIntegratedStageStepActionNotice,
  buildImplementationReviewStageReadinessNotice,
  deriveIntegratedStageInterviewChips,
  deriveIntegratedStagePrimaryChip,
  formatTaskScopedWipExecutionBlockedNotice,
  formatTaskScopedWipExecutionSuccessNotice,
  isImplementationReadyForReviewStage,
} from "@/lib/prototype/implementationExecutionBoard";
import {
  buildImplementationExecutionBoardMessage,
  buildImplementationUserConfirmationBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { parseImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveIntegratedExecutionStateReadiness,
  markIntegratedStepDone,
  markIntegratedStepInProgress,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import {
  deriveImplementationStageNextActions,
} from "@/lib/prototype/implementationStageNextActions";
import {
  RUN_FINAL_SCM_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
  SCM_CRITERIA_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP,
  MOVE_TO_REVIEW_STAGE_CHIP,
  REQUEST_TASK_REWORK_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
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
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 1 },
  };
}

function completedExecutionState() {
  let state = buildInitialImplementationTaskExecutionStateFromTaskList({
    projectId: "p-board",
    taskList: sampleTaskList(),
    nowIso: NOW,
  });
  state = markDeveloperTasksDoneForWip({ state, cursorWorkItems: workItems, nowIso: NOW });
  state = markPostDeveloperReviewTasksQueued({ state, nowIso: NOW });
  state = markRoleTasksDone({ state, ownerRole: "reviewer", nowIso: NOW });
  state = markRoleTasksDone({ state, ownerRole: "security", nowIso: NOW });
  state = markRoleTasksDone({ state, ownerRole: "scm", nowIso: NOW });
  return state;
}

function completedBoard(integratedExecutionState?: ReturnType<typeof deriveIntegratedExecutionStateReadiness>) {
  return buildImplementationExecutionBoard({
    projectId: "p-board",
    taskList: sampleTaskList(),
    executionState: completedExecutionState(),
    integratedExecutionState,
    nowIso: NOW,
  });
}

describe("implementationExecutionBoardMessage helpers", () => {
  it("formatTaskScopedWipExecutionSuccessNotice includes selectedTaskId and workItems count", () => {
    const notice = formatTaskScopedWipExecutionSuccessNotice({
      totalCandidateCount: 14,
      selectedTaskId: "DEV-001",
      selectedWorkItemsCount: 1,
    });
    expect(notice).toContain("DEV-001");
    expect(notice).toContain("14");
    expect(notice).toContain("1건");
  });

  it("formatTaskScopedWipExecutionBlockedNotice includes missing workItem reason", () => {
    const notice = formatTaskScopedWipExecutionBlockedNotice({
      selectedTaskId: "DEV-001",
      blockedReason: "DEV-001에 해당하는 Cursor WorkItem이 없습니다.",
    });
    expect(notice).toContain("DEV-001");
    expect(notice).toContain("WorkItem");
  });

  it("buildIntegratedStageStepActionNotice contains start, done, and next step", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p-board",
      step: "refactor_common",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p-board",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    const notice = buildIntegratedStageStepActionNotice({
      step: "refactor_common",
      integratedState: integrated,
    });
    expect(notice).toContain("실행을 시작");
    expect(notice).toContain("완료");
    expect(notice).toContain("통합 검수 실행");
  });

  it("board message after refactor_common done contains integrated_review ready chip", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p-board",
      step: "refactor_common",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p-board",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    const board = completedBoard(integrated);
    const message = buildImplementationExecutionBoardMessage({ board, nowIso: NOW });
    expect(message.meta?.interviewSuggestions).toContain(RUN_INTEGRATED_REVIEW_CHIP);
    expect(message.content).toContain("통합 검수 | ready");
  });

  it("all integrated done + previewReady false shows preview pending notice", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of ["refactor_common", "integrated_review", "integrated_security", "final_scm"] as const) {
      integrated = markIntegratedStepInProgress({
        state: integrated,
        projectId: "p-board",
        step,
        nowIso: NOW,
      });
      integrated = markIntegratedStepDone({
        state: integrated,
        projectId: "p-board",
        step,
        taskRowsCompleted: true,
        nowIso: NOW,
      });
    }
    const board = completedBoard(integrated);
    const notice = buildImplementationReviewStageReadinessNotice({ board, previewReady: false });
    expect(notice).toContain("Preview");
    expect(isImplementationReadyForReviewStage({ board, previewReady: false })).toBe(false);
    const message = buildImplementationExecutionBoardMessage({
      board,
      nowIso: NOW,
      previewReady: false,
    });
    expect(message.content).toContain("Preview");
  });

  it("previewReady true + board complete shows review stage ready", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of ["refactor_common", "integrated_review", "integrated_security", "final_scm"] as const) {
      integrated = markIntegratedStepInProgress({
        state: integrated,
        projectId: "p-board",
        step,
        nowIso: NOW,
      });
      integrated = markIntegratedStepDone({
        state: integrated,
        projectId: "p-board",
        step,
        taskRowsCompleted: true,
        nowIso: NOW,
      });
    }
    const board = completedBoard(integrated);
    expect(isImplementationReadyForReviewStage({ board, previewReady: true })).toBe(true);
    const notice = buildImplementationReviewStageReadinessNotice({ board, previewReady: true });
    expect(notice).toContain("검토단계");
  });

  it("previewReady true + board incomplete shows integrated pending message", () => {
    const board = completedBoard();
    expect(isImplementationReadyForReviewStage({ board, previewReady: true })).toBe(false);
    const notice = buildImplementationReviewStageReadinessNotice({ board, previewReady: true });
    expect(notice).toContain("통합");
  });

  it("board chips and next actions agree for all integrated steps", () => {
    const execState = completedExecutionState();
    const boardInputBase = {
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: execState,
      previewReady: false,
    };

    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    let board = completedBoard(integrated);
    expect(deriveIntegratedStagePrimaryChip(board)).toBe(RUN_REFACTOR_COMMON_CHIP);
    expect(
      deriveImplementationStageNextActions("task_list_ready", execState, null, {
        ...boardInputBase,
        integratedExecutionState: integrated,
      })[0]?.label,
    ).toBe(RUN_REFACTOR_COMMON_CHIP);

    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p-board",
      step: "refactor_common",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p-board",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    board = completedBoard(integrated);
    expect(deriveIntegratedStagePrimaryChip(board)).toBe(RUN_INTEGRATED_REVIEW_CHIP);
    expect(
      deriveImplementationStageNextActions("task_list_ready", execState, null, {
        ...boardInputBase,
        integratedExecutionState: integrated,
      })[0]?.label,
    ).toBe(RUN_INTEGRATED_REVIEW_CHIP);

    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p-board",
      step: "integrated_review",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p-board",
      step: "integrated_review",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    board = completedBoard(integrated);
    expect(deriveIntegratedStagePrimaryChip(board)).toBe(RUN_INTEGRATED_SECURITY_CHIP);
    expect(
      deriveImplementationStageNextActions("task_list_ready", execState, null, {
        ...boardInputBase,
        integratedExecutionState: integrated,
      })[0]?.label,
    ).toBe(RUN_INTEGRATED_SECURITY_CHIP);

    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p-board",
      step: "integrated_security",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p-board",
      step: "integrated_security",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    board = completedBoard(integrated);
    expect(deriveIntegratedStagePrimaryChip(board)).toBe(RUN_FINAL_SCM_CHIP);
    expect(
      deriveImplementationStageNextActions("task_list_ready", execState, null, {
        ...boardInputBase,
        integratedExecutionState: integrated,
      })[0]?.label,
    ).toBe(RUN_FINAL_SCM_CHIP);
  });

  it("board chips and next actions agree for refactor_common ready", () => {
    const board = completedBoard();
    const chips = deriveIntegratedStageInterviewChips(board);
    const actions = deriveImplementationStageNextActions("task_list_ready", completedExecutionState(), null, {
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: completedExecutionState(),
      previewReady: false,
    });
    expect(chips[0]).toBe(RUN_REFACTOR_COMMON_CHIP);
    expect(actions[0]?.label).toBe(RUN_REFACTOR_COMMON_CHIP);
  });

  it("final_scm done + previewReady false next action prefers SCM check", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of ["refactor_common", "integrated_review", "integrated_security", "final_scm"] as const) {
      integrated = markIntegratedStepInProgress({
        state: integrated,
        projectId: "p-board",
        step,
        nowIso: NOW,
      });
      integrated = markIntegratedStepDone({
        state: integrated,
        projectId: "p-board",
        step,
        taskRowsCompleted: true,
        nowIso: NOW,
      });
    }
    const board = completedBoard(integrated);
    const actions = deriveImplementationStageNextActions("task_list_ready", completedExecutionState(), null, {
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: completedExecutionState(),
      integratedExecutionState: integrated,
      previewReady: false,
    });
    expect(actions[0]?.label).toBe(SCM_CRITERIA_CHIP);
  });

  it("confirmation message includes 후속진행 가능 for required_non_blocking", () => {
    const boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p-board",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [
        { taskId: "dev-1", status: "required_non_blocking", reason: "확인" },
      ],
      reworkRequests: [],
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      boardState: boardState ?? null,
      nowIso: NOW,
    });
    const message = buildImplementationUserConfirmationBoardMessage({ board, nowIso: NOW });
    expect(message?.content).toContain("후속진행 가능");
    expect(message?.content).toContain("required_non_blocking");
    expect(message?.meta?.interviewSuggestions).toContain(IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP);
  });

  it("confirmation message includes 해당 작업 보류 for blocking", () => {
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
      taskList: sampleTaskList(),
      boardState: boardState ?? null,
      nowIso: NOW,
    });
    const message = buildImplementationUserConfirmationBoardMessage({ board, nowIso: NOW });
    expect(message?.content).toContain("해당 작업 보류");
    expect(message?.content).toContain("blocking");
  });

  it("board complete + previewReady true includes 검토단계로 이동 chip", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of ["refactor_common", "integrated_review", "integrated_security", "final_scm"] as const) {
      integrated = markIntegratedStepDone({
        state: integrated,
        projectId: "p-board",
        step,
        taskRowsCompleted: true,
        nowIso: NOW,
      });
    }
    const board = completedBoard(integrated);
    const message = buildImplementationExecutionBoardMessage({
      board,
      nowIso: NOW,
      previewReady: true,
    });
    expect(isImplementationReadyForReviewStage({ board, previewReady: true })).toBe(true);
    expect(message.meta?.interviewSuggestions).toContain(MOVE_TO_REVIEW_STAGE_CHIP);
    const actions = deriveImplementationStageNextActions("task_list_ready", completedExecutionState(), null, {
      projectId: "p-board",
      taskList: sampleTaskList(),
      executionState: completedExecutionState(),
      integratedExecutionState: integrated,
      previewReady: true,
    });
    expect(actions[0]?.label).toBe(MOVE_TO_REVIEW_STAGE_CHIP);
  });

  it("board complete + previewReady false does not include 검토단계로 이동 chip", () => {
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p-board",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of ["refactor_common", "integrated_review", "integrated_security", "final_scm"] as const) {
      integrated = markIntegratedStepDone({
        state: integrated,
        projectId: "p-board",
        step,
        taskRowsCompleted: true,
        nowIso: NOW,
      });
    }
    const board = completedBoard(integrated);
    const message = buildImplementationExecutionBoardMessage({
      board,
      nowIso: NOW,
      previewReady: false,
    });
    expect(message.meta?.interviewSuggestions).not.toContain(MOVE_TO_REVIEW_STAGE_CHIP);
  });

  it("board with quality failed row contains 작업 재작업 요청 chip", () => {
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
    const message = buildImplementationExecutionBoardMessage({ board, nowIso: NOW });
    expect(message.meta?.interviewSuggestions).toContain(REQUEST_TASK_REWORK_CHIP);
  });

  it("board diagnostic shows cursor_api when ExecutionSetup is complete", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const message = buildImplementationExecutionBoardMessage({
      board,
      nowIso: NOW,
      executionSetup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        workspacePath: "C:/workspace/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
      },
    });
    const text = message.content;
    expect(text).toContain("Cursor 실행 설정:");
    expect(text).toContain("Mode: cursor_api");
    expect(text).toContain("Cursor API Key: 설정됨");
    expect(text).not.toContain("Cursor Bridge 설정:");
    expect(text).not.toContain("CURSOR_BRIDGE_ENABLED");
    expect(text).not.toContain("GIT_APPLY_PUSH_ENABLED");
    expect(text).not.toContain("http_bridge");
    expect(text).not.toContain("local_runner");
  });

  it("board diagnostic preserves partial setup when only workspace is missing", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p-board",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const message = buildImplementationExecutionBoardMessage({
      board,
      nowIso: NOW,
      executionSetup: {
        gitRepoName: "pjryu0322/aiproject",
        gitRepoProvider: "github",
        baseBranch: "main",
        hasCursorToken: true,
        hasGithubAccessToken: true,
      },
    });
    const text = message.content;
    expect(text).toContain("Status: missing_workspace");
    expect(text).toContain("Git 저장소: 설정됨");
    expect(text).toContain("GitHub Token: 설정됨");
    expect(text).toContain("Cursor API Key: 설정됨");
    expect(text).toContain("Workspace: 미설정");
  });
});

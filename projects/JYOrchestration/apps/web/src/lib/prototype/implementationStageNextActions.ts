import {
  mapImplementationChipToAction,
  type EffectiveImplementationState,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import {
  hasDeveloperWipApprovedWithReviewQueued,
  hasReviewerOrSecurityQualityGateFailed,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveImplementationPrototypeRunSyncSnapshot,
  isImplementationPrototypeComplete,
  type ImplementationPrototypeRunSyncSnapshot,
} from "@/lib/prototype/implementationPrototypeRunSync";
import {
  buildImplementationExecutionBoardFromOrchestration,
  isImplementationReadyForReviewStage,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";
import {
  getActiveReviewFeedbackItems,
  summarizeReviewStageUserFeedback,
  type ReviewStageUserFeedbackListV1,
} from "@/lib/prototype/reviewStageUserFeedback";
import { isReviewStageEntryReady, type ReviewStageUserTestSessionV1 } from "@/lib/prototype/reviewStageUserTest";
import { canCompleteReviewStage } from "@/lib/prototype/reviewStageUserFeedback";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  RUN_FINAL_SCM_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
  MOVE_TO_REVIEW_STAGE_CHIP,
  REQUEST_TASK_REWORK_CHIP,
  REVIEW_STAGE_ADD_FEEDBACK_CHIP,
  REVIEW_STAGE_COMPLETE_TEST_CHIP,
  REVIEW_STAGE_OPEN_PREVIEW_CHIP,
  REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
  REVIEW_STAGE_START_USER_TEST_CHIP,
  REVIEW_STAGE_VIEW_FEEDBACK_CHIP,
  SCM_CRITERIA_CHIP,
  SECURITY_CHECK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { deriveImplementationTaskListReadiness } from "@/lib/prototype/implementationTaskListReadiness";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  deriveImplementationStageStatus,
  type ImplementationStageStatus,
} from "@/lib/prototype/implementationStageStatus";
import {
  CODE_AGENT_WIP_DRAFT_APPROVE_CHIP,
  isRealCursorSourceGenerationCompleted,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";

export type ImplementationStageNextAction = Readonly<{
  actionId: ImplementationStageActionId;
  label: string;
  priority: "primary" | "secondary" | "tertiary";
  reason: string;
}>;

export type ImplementationStageNextActionsBoardInput = Readonly<{
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly previewReady?: boolean;
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly reviewStageUserTestSessionV1?: ReviewStageUserTestSessionV1 | null;
  readonly reviewStageUserFeedbackListV1?: ReviewStageUserFeedbackListV1 | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
}>;

export function deriveReviewStageNextActions(input: {
  readonly session?: ReviewStageUserTestSessionV1 | null;
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
}): readonly ImplementationStageNextAction[] {
  const active = getActiveReviewFeedbackItems(input.feedbackList);
  const summary = summarizeReviewStageUserFeedback(input.feedbackList);
  const canComplete = canCompleteReviewStage({ feedbackList: input.feedbackList }).ok;

  if (input.session?.status === "completed") {
    const actions: ImplementationStageNextAction[] = [];
    if (active.length > 0) {
      actions.push({
        actionId: "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION",
        label: REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
        priority: "primary",
        reason: "검토 완료 후 남은 사용자 피드백을 구현단계 보완 요청으로 전환",
      });
    }
    actions.push({
      actionId: "REVIEW_STAGE_OPEN_PREVIEW",
      label: REVIEW_STAGE_OPEN_PREVIEW_CHIP,
      priority: actions.length ? "secondary" : "primary",
      reason: "프로토타입 Preview 재확인",
    });
    if (summary.total > 0) {
      actions.push({
        actionId: "REVIEW_STAGE_VIEW_FEEDBACK",
        label: REVIEW_STAGE_VIEW_FEEDBACK_CHIP,
        priority: "secondary",
        reason: "등록된 사용자 피드백 목록 확인",
      });
    }
    actions.push({
      actionId: "REVIEW_STAGE_ADD_FEEDBACK",
      label: REVIEW_STAGE_ADD_FEEDBACK_CHIP,
      priority: "tertiary",
      reason: "검토 완료 후 추가 사용자 피드백 등록",
    });
    return actions;
  }

  if (active.length > 0) {
    const actions: ImplementationStageNextAction[] = [
      {
        actionId: "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION",
        label: REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
        priority: "primary",
        reason: "등록된 검토 피드백을 구현단계 재작업 요청으로 전환",
      },
      {
        actionId: "REVIEW_STAGE_VIEW_FEEDBACK",
        label: REVIEW_STAGE_VIEW_FEEDBACK_CHIP,
        priority: "secondary",
        reason: "미처리 피드백 목록 확인",
      },
      {
        actionId: "REVIEW_STAGE_ADD_FEEDBACK",
        label: REVIEW_STAGE_ADD_FEEDBACK_CHIP,
        priority: "secondary",
        reason: "추가 사용자 테스트 피드백 등록",
      },
    ];
    if (canComplete) {
      actions.push({
        actionId: "REVIEW_STAGE_COMPLETE_TEST",
        label: REVIEW_STAGE_COMPLETE_TEST_CHIP,
        priority: "tertiary",
        reason: "blocking 피드백 없음 — 검토 완료 가능",
      });
    }
    actions.push({
      actionId: "REVIEW_STAGE_OPEN_PREVIEW",
      label: REVIEW_STAGE_OPEN_PREVIEW_CHIP,
      priority: "tertiary",
      reason: "프로토타입 Preview 확인",
    });
    return actions;
  }

  const actions: ImplementationStageNextAction[] = [];
  if (!input.session || input.session.status === "not_started") {
    actions.push({
      actionId: "REVIEW_STAGE_START_USER_TEST",
      label: REVIEW_STAGE_START_USER_TEST_CHIP,
      priority: "primary",
      reason: "검토단계 사용자 테스트 세션 시작",
    });
  } else if (canComplete && input.session.status !== "completed") {
    actions.push({
      actionId: "REVIEW_STAGE_COMPLETE_TEST",
      label: REVIEW_STAGE_COMPLETE_TEST_CHIP,
      priority: "primary",
      reason: "미처리 피드백 없음 — 검토 완료",
    });
  }
  actions.push({
    actionId: "REVIEW_STAGE_OPEN_PREVIEW",
    label: REVIEW_STAGE_OPEN_PREVIEW_CHIP,
    priority: actions.length ? "secondary" : "primary",
    reason: "프로토타입 Preview 열기",
  });
  actions.push({
    actionId: "REVIEW_STAGE_ADD_FEEDBACK",
    label: REVIEW_STAGE_ADD_FEEDBACK_CHIP,
    priority: "secondary",
    reason: "사용자 테스트 피드백 등록",
  });
  if (summary.total > 0) {
    actions.push({
      actionId: "REVIEW_STAGE_VIEW_FEEDBACK",
      label: REVIEW_STAGE_VIEW_FEEDBACK_CHIP,
      priority: "tertiary",
      reason: "등록된 피드백 확인",
    });
  }
  return actions;
}

function deriveNextActionsFromIntegratedBoard(
  board: ImplementationExecutionBoardV1,
  previewReady: boolean,
): readonly ImplementationStageNextAction[] | null {
  const allTasksComplete =
    board.taskRows.length > 0 && board.taskRows.every((row) => row.currentRole === "completed");
  if (!allTasksComplete) return null;

  const stepStatus = (step: ImplementationExecutionBoardV1["integratedRows"][number]["step"]) =>
    board.integratedRows.find((row) => row.step === step)?.status;

  if (stepStatus("refactor_common") === "ready") {
    return [
      {
        actionId: "RUN_REFACTOR_COMMON",
        label: RUN_REFACTOR_COMMON_CHIP,
        priority: "primary",
        reason: "모든 개발자 작업 완료 후 리팩토링/공통화 실행",
      },
    ];
  }
  if (stepStatus("refactor_common") === "done" && stepStatus("integrated_review") === "ready") {
    return [
      {
        actionId: "RUN_INTEGRATED_REVIEW",
        label: RUN_INTEGRATED_REVIEW_CHIP,
        priority: "primary",
        reason: "리팩토링/공통화 완료 후 통합 검수 실행",
      },
    ];
  }
  if (stepStatus("integrated_review") === "done" && stepStatus("integrated_security") === "ready") {
    return [
      {
        actionId: "RUN_INTEGRATED_SECURITY",
        label: RUN_INTEGRATED_SECURITY_CHIP,
        priority: "primary",
        reason: "통합 검수 완료 후 통합 보안 점검 실행",
      },
    ];
  }
  if (stepStatus("integrated_security") === "done" && stepStatus("final_scm") === "ready") {
    return [
      {
        actionId: "RUN_FINAL_SCM",
        label: RUN_FINAL_SCM_CHIP,
        priority: "primary",
        reason: "통합 보안 점검 완료 후 최종 SCM 반영 실행",
      },
    ];
  }
  if (stepStatus("final_scm") === "done" && previewReady) {
    if (isImplementationReadyForReviewStage({ board, previewReady: true })) {
      return [
        {
          actionId: "MOVE_TO_REVIEW_STAGE",
          label: MOVE_TO_REVIEW_STAGE_CHIP,
          priority: "primary",
          reason: "구현 보드 완료 및 preview ready — 검토단계 이동",
        },
        {
          actionId: "SHOW_ARTIFACTS",
          label: IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
          priority: "secondary",
          reason: "프로토타입 미리보기 확인",
        },
      ];
    }
    return [
      {
        actionId: "SHOW_ARTIFACTS",
        label: IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
        priority: "primary",
        reason: "통합 단계 완료 및 preview ready — 결과 확인",
      },
    ];
  }
  if (stepStatus("final_scm") === "done" && !previewReady) {
    return [
      {
        actionId: "SHOW_SCM_CHECK",
        label: SCM_CRITERIA_CHIP,
        priority: "primary",
        reason: "통합 단계 완료 — Preview 준비 대기, SCM/배포 상태 확인",
      },
      {
        actionId: "SHOW_ENV_CHECK",
        label: "환경 점검 결과",
        priority: "secondary",
        reason: "Preview 준비 상태 확인",
      },
    ];
  }
  return null;
}

function boardNeedsRemediation(board: ImplementationExecutionBoardV1): boolean {
  if (board.summary.failedTasks > 0) return true;
  if (
    board.taskRows.some(
      (row) => row.reviewerResultStatus === "failed" || row.securityResultStatus === "failed",
    )
  ) {
    return true;
  }
  if (board.taskRows.some((row) => row.reworkCount > 0)) return true;
  return false;
}

function deriveNextActionsFromBoardRemediation(
  board: ImplementationExecutionBoardV1,
): readonly ImplementationStageNextAction[] {
  const hasRework = board.taskRows.some((row) => row.reworkCount > 0);
  return [
    {
      actionId: "REQUEST_CODE_AGENT_WIP",
      label: AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
      priority: "primary",
      reason: hasRework
        ? "등록된 재작업 요청 task 보완 WIP 실행"
        : "검수/보안 실패 또는 실패 작업 보완 WIP 실행",
    },
    {
      actionId: "REQUEST_TASK_REWORK",
      label: REQUEST_TASK_REWORK_CHIP,
      priority: "secondary",
      reason: "재작업 요청을 boardState에 등록",
    },
    {
      actionId: "SHOW_ARTIFACTS",
      label: TASK_LIST_VIEW_CHIP,
      priority: "secondary",
      reason: "작업목록 및 점검 결과 확인",
    },
  ];
}

function deriveNextActionsFromPrototypeComplete(
  prototypeSnapshot: ImplementationPrototypeRunSyncSnapshot | null | undefined,
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
  reviewGate?: { readonly board: ImplementationExecutionBoardV1; readonly previewReady: boolean } | null,
): readonly ImplementationStageNextAction[] | null {
  if (!isImplementationPrototypeComplete({ executionState, prototypeSnapshot })) return null;
  if (reviewGate && !isImplementationReadyForReviewStage(reviewGate)) return null;
  return [
    {
      actionId: "SHOW_ARTIFACTS",
      label: IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
      priority: "primary",
      reason: "프로토타입 preview ready — 결과 확인",
    },
    {
      actionId: "REQUEST_CODE_AGENT_WIP",
      label: "변경사항 보기",
      priority: "secondary",
      reason: "구현 변경사항 확인",
    },
    {
      actionId: "SHOW_ROLE_CHECK",
      label: REVIEWER_CHECK_CHIP,
      priority: "secondary",
      reason: "후속 점검 대기 또는 완료 확인",
    },
    {
      actionId: "SHOW_ROLE_CHECK",
      label: SECURITY_CHECK_CHIP,
      priority: "tertiary",
      reason: "후속 점검 대기 또는 완료 확인",
    },
    {
      actionId: "SHOW_SCM_CHECK",
      label: SCM_CRITERIA_CHIP,
      priority: "tertiary",
      reason: "SCM 반영 기준 확인",
    },
  ];
}

function deriveNextActionsFromExecutionState(
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
  prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null,
  reviewGate?: { readonly board: ImplementationExecutionBoardV1; readonly previewReady: boolean } | null,
): readonly ImplementationStageNextAction[] | null {
  const fromComplete = deriveNextActionsFromPrototypeComplete(
    prototypeSnapshot,
    executionState,
    reviewGate,
  );
  if (fromComplete?.length) return fromComplete;

  if (!executionState?.items.length) return null;

  const summary = executionState.summary;

  if (hasDeveloperWipApprovedWithReviewQueued(executionState)) {
    return [
      {
        actionId: "RUN_REVIEWER_CHECK",
        label: REVIEWER_CHECK_RUN_CHIP,
        priority: "primary",
        reason: "개발자 WIP 승인 후 검수자 점검 실행",
      },
      {
        actionId: "RUN_SECURITY_CHECK",
        label: SECURITY_CHECK_RUN_CHIP,
        priority: "secondary",
        reason: "개발자 WIP 승인 후 보안 점검 실행",
      },
      {
        actionId: "SHOW_ROLE_CHECK",
        label: REVIEWER_CHECK_CHIP,
        priority: "secondary",
        reason: "검수자 점검 대상 확인",
      },
      {
        actionId: "SHOW_SCM_CHECK",
        label: SCM_CRITERIA_CHIP,
        priority: "tertiary",
        reason: "SCM 반영 기준 확인",
      },
    ];
  }

  if (hasReviewerOrSecurityQualityGateFailed(executionState)) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
        priority: "primary",
        reason: "검수/보안 점검 실패 후 개발자 보완 요청",
      },
      {
        actionId: "SHOW_ARTIFACTS",
        label: TASK_LIST_VIEW_CHIP,
        priority: "secondary",
        reason: "작업목록 및 점검 결과 확인",
      },
      {
        actionId: "RUN_REVIEWER_CHECK",
        label: REVIEWER_CHECK_RUN_CHIP,
        priority: "secondary",
        reason: "검수자 점검 재실행",
      },
      {
        actionId: "RUN_SECURITY_CHECK",
        label: SECURITY_CHECK_RUN_CHIP,
        priority: "tertiary",
        reason: "보안 점검 재실행",
      },
    ];
  }

  if (summary.inProgress > 0) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "변경사항 보기",
        priority: "primary",
        reason: "Code Agent WIP 진행 중 변경사항 확인",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "구현 결과 승인",
        priority: "secondary",
        reason: "Code Agent WIP 결과 승인",
      },
    ];
  }

  if (summary.failed > 0) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
        priority: "primary",
        reason: "실패한 구현 작업 재시도",
      },
    ];
  }

  return null;
}

export type ImplementationStageTaskListContext = Readonly<{
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}>;

function deriveNextActionsWhenTaskListMissing(
  taskListContext: ImplementationStageTaskListContext,
): readonly ImplementationStageNextAction[] | null {
  const readiness = deriveImplementationTaskListReadiness({
    implementationSeedV1: taskListContext.implementationSeedV1,
    implementationTaskListV1: taskListContext.implementationTaskListV1,
  });
  if (readiness.status === "task_list_exists") {
    return null;
  }
  if (readiness.canGenerateTaskList) {
    return [
      {
        actionId: "GENERATE_IMPLEMENTATION_TASK_LIST",
        label: GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
        priority: "primary",
        reason: "확정된 Implementation Seed 기준 구현 작업목록 생성",
      },
      {
        actionId: "SHOW_ARTIFACTS",
        label: IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
        priority: "secondary",
        reason: "산출물 확인",
      },
    ];
  }
  if (readiness.status === "missing_seed" || readiness.status === "seed_not_confirmed") {
    return [
      {
        actionId: "SHOW_ARTIFACTS",
        label: IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
        priority: "primary",
        reason: readiness.message,
      },
    ];
  }
  return null;
}

function deriveNextActionsFromCodeAgentWip(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): readonly ImplementationStageNextAction[] | null {
  if (!wip) return null;
  const bridgeStatus = wip.bridgeExecutionStatus;
  if (bridgeStatus === "draft_created") {
    return [
      {
        actionId: "REQUEST_CURSOR_BRIDGE_EXECUTION",
        label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
        priority: "primary",
        reason: "WIP 초안 생성 후 실제 Cursor API 실행",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: CODE_AGENT_WIP_DRAFT_APPROVE_CHIP,
        priority: "secondary",
        reason: "stub WIP 초안 승인",
      },
      {
        actionId: "OPEN_ENV_SETTINGS",
        label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
        priority: "secondary",
        reason: "Cursor API 환경설정",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "작업 폐기",
        priority: "tertiary",
        reason: "WIP 초안 폐기",
      },
    ];
  }
  if (bridgeStatus === "draft_approved") {
    return [
      {
        actionId: "REQUEST_CURSOR_BRIDGE_EXECUTION",
        label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
        priority: "primary",
        reason: "WIP 초안 승인 후 Cursor API 실행",
      },
      {
        actionId: "OPEN_ENV_SETTINGS",
        label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
        priority: "secondary",
        reason: "Cursor API 환경설정",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "작업 폐기",
        priority: "tertiary",
        reason: "WIP 작업 폐기",
      },
    ];
  }
  if (isRealCursorSourceGenerationCompleted(wip)) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "구현 결과 승인",
        priority: "primary",
        reason: "Cursor API 완료 후 구현 결과 승인",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "변경사항 보기",
        priority: "secondary",
        reason: "Cursor API 변경사항 확인",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "추가 수정 요청",
        priority: "secondary",
        reason: "Cursor API 결과 추가 수정",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "작업 폐기",
        priority: "tertiary",
        reason: "WIP 작업 폐기",
      },
    ];
  }
  if (bridgeStatus === "failed") {
    return [
      {
        actionId: "REQUEST_CURSOR_BRIDGE_EXECUTION",
        label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
        priority: "primary",
        reason: "Cursor API 실패 후 재시도",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "추가 수정 요청",
        priority: "secondary",
        reason: "Cursor API 실패 후 WIP 수정",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "작업 폐기",
        priority: "tertiary",
        reason: "WIP 작업 폐기",
      },
    ];
  }
  if (bridgeStatus === "bridge_requested" || bridgeStatus === "bridge_running") {
    return [
      {
        actionId: "OPEN_ENV_SETTINGS",
        label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
        priority: "secondary",
        reason: "Cursor API 실행 중 환경 확인",
      },
    ];
  }
  if (bridgeStatus === "bridge_completed" && !isRealCursorSourceGenerationCompleted(wip)) {
    return [
      {
        actionId: "REQUEST_CURSOR_BRIDGE_EXECUTION",
        label: REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
        priority: "primary",
        reason: "stub WIP 결과 — 실제 Cursor API 실행 필요",
      },
      {
        actionId: "OPEN_ENV_SETTINGS",
        label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
        priority: "secondary",
        reason: "Cursor API 환경설정",
      },
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: "작업 폐기",
        priority: "tertiary",
        reason: "stub WIP 폐기",
      },
    ];
  }
  return null;
}

export function deriveImplementationStageNextActions(
  status: ImplementationStageStatus,
  executionState?: ImplementationTaskExecutionStateV1 | null,
  prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null,
  boardInput?: ImplementationStageNextActionsBoardInput | null,
  taskListContext?: ImplementationStageTaskListContext | null,
): readonly ImplementationStageNextAction[] {
  const missingTaskListActions =
    !boardInput?.taskList?.tasks?.length && taskListContext
      ? deriveNextActionsWhenTaskListMissing(taskListContext)
      : null;
  if (missingTaskListActions?.length) {
    return missingTaskListActions;
  }

  const fromWip = deriveNextActionsFromCodeAgentWip(boardInput?.codeAgentWipExecutionV1);
  if (fromWip?.length) {
    return fromWip;
  }

  let reviewGate: { readonly board: ImplementationExecutionBoardV1; readonly previewReady: boolean } | null =
    null;
  if (boardInput) {
    const board = buildImplementationExecutionBoardFromOrchestration({
      projectId: boardInput.projectId,
      taskList: boardInput.taskList,
      executionState: boardInput.executionState,
      integratedExecutionState: boardInput.integratedExecutionState,
      boardState: boardInput.boardState,
      qualityGateResults: boardInput.qualityGateResults,
    });
    reviewGate = { board, previewReady: boardInput.previewReady === true };

    if (boardNeedsRemediation(board)) {
      return deriveNextActionsFromBoardRemediation(board);
    }

    const allTasksComplete =
      board.taskRows.length > 0 && board.taskRows.every((row) => row.currentRole === "completed");

    const fromIntegrated = deriveNextActionsFromIntegratedBoard(
      board,
      boardInput.previewReady === true,
    );
    if (fromIntegrated?.length) return fromIntegrated;

    if (!allTasksComplete) {
      const fromExecutionWhileBoard = deriveNextActionsFromExecutionState(
        executionState,
        prototypeSnapshot,
        reviewGate,
      );
      if (fromExecutionWhileBoard?.length) return fromExecutionWhileBoard;
      return [
        {
          actionId: "REQUEST_CODE_AGENT_WIP",
          label: IMPLEMENTATION_GENERATION_REQUEST_CHIP,
          priority: "primary",
          reason: "구현 작업 보드 기준 task-scoped 생성요청 WIP",
        },
        {
          actionId: "OPEN_ENV_SETTINGS",
          label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
          priority: "secondary",
          reason: "실행 환경 설정",
        },
      ];
    }

    if (
      reviewGate &&
      isImplementationReadyForReviewStage(reviewGate) &&
      isReviewStageEntryReady({
        implementationReviewStageReadyV1: boardInput.implementationReviewStageReadyV1,
        previewReady: boardInput.previewReady === true,
      })
    ) {
      const reviewActions = deriveReviewStageNextActions({
        session: boardInput.reviewStageUserTestSessionV1,
        feedbackList: boardInput.reviewStageUserFeedbackListV1,
      });
      if (reviewActions.length) return reviewActions;
    }
  }

  const fromExecution = deriveNextActionsFromExecutionState(
    executionState,
    prototypeSnapshot,
    reviewGate,
  );
  if (fromExecution?.length) return fromExecution;

  if (boardInput?.taskList) {
    return [
      {
        actionId: "REQUEST_CODE_AGENT_WIP",
        label: IMPLEMENTATION_GENERATION_REQUEST_CHIP,
        priority: "primary",
        reason: "구현 작업목록 기준 생성요청",
      },
      {
        actionId: "OPEN_ENV_SETTINGS",
        label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
        priority: "secondary",
        reason: "실행 환경 설정",
      },
    ];
  }

  switch (status) {
    case "not_ready":
      return [
        {
          actionId: "SHOW_ENV_CHECK",
          label: "환경 점검 결과",
          priority: "primary",
          reason: "구현 준비 전 환경/기획 준비 상태 확인 필요",
        },
      ];
    case "task_list_ready":
      return [
        {
          actionId: "REQUEST_CODE_AGENT_WIP",
          label: IMPLEMENTATION_GENERATION_REQUEST_CHIP,
          priority: "primary",
          reason: "구현 작업목록 기준 생성요청",
        },
        {
          actionId: "OPEN_ENV_SETTINGS",
          label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
          priority: "secondary",
          reason: "실행 환경 설정",
        },
      ];
    case "implementation_ready":
      return [
        {
          actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
          label: "구현 작업안 초안 생성",
          priority: "primary",
          reason: "구현 준비정보가 준비되어 작업안 초안 생성 가능",
        },
      ];
    case "work_plan_drafted":
      return [
        {
          actionId: "CONFIRM_IMPLEMENTATION_WORK_PLAN",
          label: "구현 작업안 확정",
          priority: "primary",
          reason: "작업안 초안을 확정해 실행 계획으로 전환",
        },
        {
          actionId: "EDIT_IMPLEMENTATION_SCOPE",
          label: "구현 범위 수정",
          priority: "secondary",
          reason: "확정 전 범위 조정 가능",
        },
      ];
    case "work_plan_confirmed":
      return [
        {
          actionId: "CONFIRM_MOCK_IMPLEMENTATION",
          label: "Mock 기반 구현 진행",
          priority: "primary",
          reason: "확정된 작업 계획을 기반으로 구현 진행",
        },
        {
          actionId: "REVIEW_DB_INTEGRATION",
          label: "DB 연동 필요성 검토",
          priority: "secondary",
          reason: "실제 저장소 필요 여부 점검",
        },
      ];
    case "prototype_ready":
      return deriveNextActionsFromPrototypeComplete(prototypeSnapshot, executionState) ?? [];
    default:
      return [];
  }
}

function chipSortIndex(
  label: string,
  nextActions: readonly ImplementationStageNextAction[],
): number {
  const actionId = mapImplementationChipToAction(label);
  const byActionId = actionId
    ? nextActions.findIndex((a) => a.actionId === actionId)
    : -1;
  if (byActionId >= 0) return byActionId;
  const byLabel = nextActions.findIndex((a) => a.label === label);
  return byLabel >= 0 ? byLabel : 999;
}

/** Reorders existing chip labels; does not add or remove labels. */
export function prioritizeImplementationChipsByNextActions(input: {
  readonly labels: readonly string[];
  readonly nextActions: readonly ImplementationStageNextAction[];
}): readonly string[] {
  const indexed = input.labels.map((label, originalIndex) => ({
    label,
    originalIndex,
    sortIndex: chipSortIndex(label, input.nextActions),
  }));
  indexed.sort((a, b) => {
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.originalIndex - b.originalIndex;
  });
  return indexed.map((row) => row.label);
}

export function prioritizeImplementationChipsForState(
  labels: readonly string[],
  state: EffectiveImplementationState,
  executionState?: ImplementationTaskExecutionStateV1 | null,
  boardInput?: ImplementationStageNextActionsBoardInput | null,
  taskListContext?: ImplementationStageTaskListContext | null,
): readonly string[] {
  const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
    latestRun: state.latestRun,
    workUnits: state.latestRun?.workUnits,
  });
  const status = deriveImplementationStageStatus(state, executionState);
  const nextActions = deriveImplementationStageNextActions(
    status,
    executionState,
    prototypeSnapshot,
    boardInput,
    taskListContext ?? {
      implementationSeedV1: state.implementationSeedV1,
      implementationTaskListV1: state.implementationTaskListV1,
    },
  );
  return prioritizeImplementationChipsByNextActions({ labels, nextActions });
}


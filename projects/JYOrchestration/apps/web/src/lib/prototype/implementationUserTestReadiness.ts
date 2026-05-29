import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import { isImplementationReadyForReviewStage } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";

export type ImplementationUserTestReadinessStatus =
  | "ready"
  | "missing_task_list"
  | "missing_execution_state"
  | "blocked_by_failed_tasks"
  | "blocked_by_rework"
  | "blocked_by_user_confirmation"
  | "blocked_by_integrated_stage"
  | "blocked_by_preview";

export type ImplementationUserTestReadiness = Readonly<{
  readonly ready: boolean;
  readonly status: ImplementationUserTestReadinessStatus;
  readonly message: string;
  readonly reviewStageMoveAllowed: boolean;
}>;

const ACTIVE_REWORK_STATUSES = new Set(["requested", "accepted"]);

function countActiveReworkRequests(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
): number {
  if (!boardState?.reworkRequests.length) return 0;
  return boardState.reworkRequests.filter((r) => ACTIVE_REWORK_STATUSES.has(r.status)).length;
}

function countActiveReworkFromBoardRows(board: ImplementationExecutionBoardV1): number {
  return board.taskRows.reduce((sum, row) => sum + row.reworkCount, 0);
}

function formatIntegratedStageSummary(board: ImplementationExecutionBoardV1): string {
  const parts = board.integratedRows.map((row) => `${row.title}:${row.status}`);
  return parts.length ? parts.join(", ") : "(없음)";
}

export function deriveImplementationUserTestReadiness(input: {
  readonly board: ImplementationExecutionBoardV1 | null;
  readonly previewReady: boolean;
  readonly hasTaskList: boolean;
  readonly hasExecutionState: boolean;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
}): ImplementationUserTestReadiness {
  if (!input.hasTaskList) {
    return {
      ready: false,
      status: "missing_task_list",
      message: "구현 작업목록(implementationTaskListV1)이 없습니다. Quick Design 확정 후 작업목록을 생성해 주세요.",
      reviewStageMoveAllowed: false,
    };
  }
  if (!input.hasExecutionState) {
    return {
      ready: false,
      status: "missing_execution_state",
      message:
        "구현 실행 상태(implementationTaskExecutionStateV1)가 없습니다. 구현단계 진입 시 실행 상태를 초기화해 주세요.",
      reviewStageMoveAllowed: false,
    };
  }
  const board = input.board;
  if (!board || board.taskRows.length === 0) {
    return {
      ready: false,
      status: "missing_task_list",
      message: "구현 작업 보드에 표시할 작업이 없습니다.",
      reviewStageMoveAllowed: false,
    };
  }

  if (board.summary.failedTasks > 0) {
    return {
      ready: false,
      status: "blocked_by_failed_tasks",
      message: `실패 작업 ${board.summary.failedTasks}건이 있습니다. 보완 WIP 또는 재작업 요청으로 해소해 주세요.`,
      reviewStageMoveAllowed: false,
    };
  }

  const activeRework =
    countActiveReworkRequests(input.boardState) || countActiveReworkFromBoardRows(board);
  if (activeRework > 0) {
    return {
      ready: false,
      status: "blocked_by_rework",
      message: `진행 중 재작업 요청 ${activeRework}건이 있습니다. 보완 WIP로 처리한 뒤 통합/검토단계로 진행해 주세요.`,
      reviewStageMoveAllowed: false,
    };
  }

  if (board.summary.blockingUserConfirmation > 0) {
    return {
      ready: false,
      status: "blocked_by_user_confirmation",
      message: `사용자 확인 차단 작업 ${board.summary.blockingUserConfirmation}건이 있습니다. 사용자 확인을 처리해 주세요.`,
      reviewStageMoveAllowed: false,
    };
  }

  const allTasksComplete = board.taskRows.every((row) => row.currentRole === "completed");
  const allIntegratedDone = board.integratedRows.every((row) => row.status === "done");
  if (!allTasksComplete || !allIntegratedDone) {
    return {
      ready: false,
      status: "blocked_by_integrated_stage",
      message: allTasksComplete
        ? `통합단계가 완료되지 않았습니다. (${formatIntegratedStageSummary(board)})`
        : `개별 작업이 아직 완료되지 않았습니다. (완료 ${board.summary.completedTasks}/${board.summary.totalTasks})`,
      reviewStageMoveAllowed: false,
    };
  }

  if (!input.previewReady) {
    return {
      ready: false,
      status: "blocked_by_preview",
      message: "프로토타입 Preview가 준비되지 않았습니다. 배포/새로고침 후 Preview ready를 확인해 주세요.",
      reviewStageMoveAllowed: false,
    };
  }

  const reviewStageMoveAllowed = isImplementationReadyForReviewStage({
    board,
    previewReady: input.previewReady,
  });

  return {
    ready: true,
    status: "ready",
    message: reviewStageMoveAllowed
      ? "구현단계 사용자 테스트 준비가 완료되었습니다. 검토단계로 이동할 수 있습니다."
      : "구현단계 핵심 흐름은 완료되었으나 검토단계 이동 조건을 다시 확인해 주세요.",
    reviewStageMoveAllowed,
  };
}

export function buildImplementationUserTestSummaryLines(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly previewReady: boolean;
  readonly readiness: ImplementationUserTestReadiness;
  readonly activeReworkCount?: number;
}): readonly string[] {
  const activeRework =
    input.activeReworkCount ??
    input.board.taskRows.reduce((sum, row) => sum + row.reworkCount, 0);
  const integratedSummary = formatIntegratedStageSummary(input.board);
  return [
    "구현단계 테스트 요약:",
    `- 전체 작업: ${input.board.summary.totalTasks}`,
    `- 완료 작업: ${input.board.summary.completedTasks}`,
    `- 실패 작업: ${input.board.summary.failedTasks}`,
    `- 재작업 요청: ${activeRework}`,
    `- 사용자 확인 필요: ${input.board.summary.userConfirmationRequired} (차단 ${input.board.summary.blockingUserConfirmation})`,
    `- 통합단계: ${integratedSummary}`,
    `- Preview 상태: ${input.previewReady ? "ready" : "not ready"}`,
    `- 검토단계 이동 가능: ${input.readiness.reviewStageMoveAllowed ? "예" : "아니오"} (${input.readiness.status})`,
  ];
}

import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  boardShowsRequestTaskReworkChip,
  buildImplementationReviewStageReadinessNotice,
  deriveIntegratedStageInterviewChips,
  formatBoardExecutionTargetLines,
  formatImplementationExecutionBoardIntegratedLine,
  formatImplementationExecutionBoardTaskLine,
  isImplementationReadyForReviewStage,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import {
  buildImplementationUserTestSummaryLines,
  deriveImplementationUserTestReadiness,
} from "@/lib/prototype/implementationUserTestReadiness";
const IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_LIST_READY_V1" as const;
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
  MOVE_TO_REVIEW_STAGE_CHIP,
  REQUEST_TASK_REWORK_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";

const ROLE_LABEL_KO: Readonly<Record<string, string>> = {
  developer: "AI 개발자",
  reviewer: "AI 검수자",
  security: "AI 보안관",
  scm: "SCM",
  refactor_common: "리팩토링/공통화",
  integrated_review: "통합 검수",
  integrated_security: "통합 보안 점검",
  final_scm: "최종 SCM 반영",
};

function formatCurrentRunningLine(board: ImplementationExecutionBoardV1): string | null {
  if (board.currentTaskId && board.currentStep && board.currentStep in ROLE_LABEL_KO) {
    const row = board.taskRows.find((r) => r.taskId === board.currentTaskId);
    const roleLabel = ROLE_LABEL_KO[board.currentStep] ?? board.currentStep;
    return `${board.currentTaskId} / ${roleLabel} / ${row?.statusLabel ?? "진행 중"}`;
  }
  if (board.currentStep && board.currentStep in ROLE_LABEL_KO) {
    const roleLabel = ROLE_LABEL_KO[board.currentStep] ?? board.currentStep;
    return `${roleLabel} / ${board.integratedRows.find((r) => r.step === board.currentStep)?.status ?? "ready"}`;
  }
  return null;
}

export function buildImplementationExecutionBoardMessage(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly nowIso: string;
  readonly previewReady?: boolean;
  readonly hasExecutionState?: boolean;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const currentLine = formatCurrentRunningLine(input.board);
  const taskLines = input.board.taskRows.map(formatImplementationExecutionBoardTaskLine);
  const integratedLines = input.board.integratedRows.map(formatImplementationExecutionBoardIntegratedLine);

  const hasFailed = input.board.summary.failedTasks > 0;
  const integratedChips = deriveIntegratedStageInterviewChips(input.board);
  const executionTargetLines = formatBoardExecutionTargetLines(input.board);
  const previewReady = input.previewReady === true;
  const testReadiness = deriveImplementationUserTestReadiness({
    board: input.board,
    previewReady,
    hasTaskList: true,
    hasExecutionState: input.hasExecutionState !== false,
    boardState: input.boardState,
  });
  const testSummaryLines = buildImplementationUserTestSummaryLines({
    board: input.board,
    previewReady,
    readiness: testReadiness,
  });
  const reviewReadinessNotice = buildImplementationReviewStageReadinessNotice({
    board: input.board,
    previewReady,
  });
  const reviewReady = testReadiness.reviewStageMoveAllowed;
  const showReworkChip = boardShowsRequestTaskReworkChip(input.board);
  const chips = [
    IMPLEMENTATION_GENERATION_REQUEST_CHIP,
    ...integratedChips,
    ...(reviewReady ? [MOVE_TO_REVIEW_STAGE_CHIP] : []),
    ...(showReworkChip ? [REQUEST_TASK_REWORK_CHIP] : []),
    TASK_LIST_VIEW_CHIP,
    ...(input.board.summary.userConfirmationRequired > 0
      ? [IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP]
      : []),
    ...(hasFailed || showReworkChip
      ? [AI_DEVELOPER_REMEDIATION_REQUEST_CHIP]
      : [AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP]),
  ];

  const content = [
    "구현 작업 보드입니다.",
    "",
    ...(executionTargetLines.length ? [...executionTargetLines, ""] : []),
    ...(currentLine && !executionTargetLines.some((line) => line.startsWith("현재 실행 중"))
      ? [`현재 실행 중:`, currentLine, ""]
      : []),
    "작업 목록:",
    "TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM | 사용자 확인 | 재작업 | 상태",
    ...(taskLines.length ? taskLines : ["(개발자 작업이 없습니다)"]),
    "",
    "통합 정리 단계:",
    ...(integratedLines.length ? integratedLines : ["(통합 단계 없음)"]),
    "",
    ...testSummaryLines,
    "",
    ...(reviewReadinessNotice ? [reviewReadinessNotice, ""] : []),
    ...(testReadiness.ready ? [] : [`진단: ${testReadiness.message}`, ""]),
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    id: `impl-execution-board-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: chips,
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1180,
    },
  });
}

export function buildImplementationUserConfirmationBoardMessage(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly nowIso: string;
}): RequirementsMessage | null {
  const rows = input.board.taskRows.filter(
    (row) =>
      row.userConfirmation === "required_non_blocking" || row.userConfirmation === "blocking",
  );
  if (!rows.length) return null;

  const def = getWorkspaceAiMember("prototype_build");
  const lines = rows.map((row) => {
    const followUp =
      row.userConfirmation === "required_non_blocking" ? "후속진행 가능" : "해당 작업 보류";
    const reason = row.userConfirmationReason?.trim() || "-";
    return `${row.taskId} | ${row.title} | ${row.userConfirmation} | ${followUp} | ${reason} | 미처리`;
  });

  return newRequirementsMessage({
    id: `impl-user-confirmation-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "사용자 확인이 필요한 작업입니다.",
      "",
      "TASK ID | 작업 | 확인상태 | 후속진행 | 사유 | 처리상태",
      ...lines,
    ].join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [
        TASK_LIST_VIEW_CHIP,
        IMPLEMENTATION_GENERATION_REQUEST_CHIP,
        IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP,
      ],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1185,
    },
  });
}

export type AppendImplementationUserConfirmationBoardMessageResult =
  | Readonly<{ readonly kind: "appended" }>
  | Readonly<{ readonly kind: "no_board"; readonly message: string }>
  | Readonly<{ readonly kind: "no_items"; readonly message: string }>;

export function tryAppendImplementationUserConfirmationBoardMessage(input: {
  readonly board: ImplementationExecutionBoardV1 | null;
  readonly nowIso: string;
  readonly appendAiMessage: (message: RequirementsMessage) => void;
  readonly showToast?: (message: string) => void;
}): AppendImplementationUserConfirmationBoardMessageResult {
  if (!input.board) {
    const message = "표시할 구현 작업목록이 없습니다.";
    input.showToast?.(message);
    return { kind: "no_board", message };
  }
  const message = buildImplementationUserConfirmationBoardMessage({
    board: input.board,
    nowIso: input.nowIso,
  });
  if (!message) {
    const blocked = "사용자 확인이 필요한 작업이 없습니다.";
    input.showToast?.(blocked);
    return { kind: "no_items", message: blocked };
  }
  input.appendAiMessage(message);
  return { kind: "appended" };
}

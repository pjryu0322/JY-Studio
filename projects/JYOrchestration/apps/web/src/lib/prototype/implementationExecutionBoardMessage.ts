import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  boardShowsRequestTaskReworkChip,
  buildImplementationReviewStageReadinessNotice,
  formatBoardExecutionTargetLines,
  formatImplementationExecutionBoardIntegratedLine,
  formatImplementationExecutionBoardTaskLine,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import { formatCodeAgentExecutionModeDiagnosticLines } from "@/lib/prototype/codeAgentWipExecution";
import { formatCursorExecutionAvailabilityDiagnosticLines } from "@/lib/prototype/cursorExecutionAvailability";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { deriveImplementationBoardInterviewChips } from "@/lib/prototype/implementationChipPolicy";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import {
  buildImplementationUserTestSummaryLines,
  deriveImplementationUserTestReadiness,
} from "@/lib/prototype/implementationUserTestReadiness";
import { formatImplementationTaskListRoleSummaryLines } from "@/lib/requirements/implementationTaskList";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
const IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_LIST_READY_V1" as const;
import {
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function buildImplementationExecutionBoardMessage(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly nowIso: string;
  readonly previewReady?: boolean;
  readonly hasExecutionState?: boolean;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly includeTaskSummary?: boolean;
  readonly envOk?: boolean;
  readonly codeAgentWipExecutionV1?: import("@/lib/prototype/codeAgentWipExecution").CodeAgentWipExecutionV1 | null;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const taskLines = input.board.taskRows.map(formatImplementationExecutionBoardTaskLine);
  const integratedLines = input.board.integratedRows.map(formatImplementationExecutionBoardIntegratedLine);

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
  const executionTargetLines = formatBoardExecutionTargetLines(input.board);
  const chips = deriveImplementationBoardInterviewChips({
    board: input.board,
    envOk: input.envOk,
    previewReady,
    hasExecutionState: input.hasExecutionState,
    boardState: input.boardState,
    codeAgentWipExecutionV1: input.codeAgentWipExecutionV1,
  });

  const headline =
    input.includeTaskSummary === true
      ? "구현 작업목록이 준비되었습니다."
      : "구현 작업 보드입니다.";

  const introSection =
    input.includeTaskSummary === true
      ? [
          "",
          "Quick Design 확정 산출물을 기준으로 구현 작업목록이 생성되었습니다.",
          "작업목록을 기준으로 AI 개발자, 디자이너, 검수자, 보안관, SCM 역할별 작업을 진행할 수 있습니다.",
        ]
      : [];

  const summarySection =
    input.includeTaskSummary === true && input.taskList
      ? ["", "작업 요약:", ...formatImplementationTaskListRoleSummaryLines(input.taskList), ""]
      : [];

  const content = [
    headline,
    ...introSection,
    ...summarySection,
    ...(executionTargetLines.length ? executionTargetLines : []),
    ...(executionTargetLines.length ? [""] : []),
    "작업 목록:",
    "TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM | 사용자 확인 | 재작업 | 상태",
    ...(taskLines.length ? taskLines : ["(개발자 작업이 없습니다)"]),
    "",
    "통합 정리 단계:",
    ...(integratedLines.length ? integratedLines : ["(통합 단계 없음)"]),
    "",
    ...testSummaryLines,
    "",
    ...formatCodeAgentExecutionModeDiagnosticLines(input.codeAgentWipExecutionV1),
    ...formatCursorExecutionAvailabilityDiagnosticLines({ setup: input.executionSetup }),
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

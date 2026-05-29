import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  formatImplementationExecutionBoardIntegratedLine,
  formatImplementationExecutionBoardTaskLine,
  type ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
const IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_LIST_READY_V1" as const;
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
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
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const currentLine = formatCurrentRunningLine(input.board);
  const taskLines = input.board.taskRows.map(formatImplementationExecutionBoardTaskLine);
  const integratedLines = input.board.integratedRows.map(formatImplementationExecutionBoardIntegratedLine);

  const hasFailed = input.board.summary.failedTasks > 0;
  const chips = [
    IMPLEMENTATION_GENERATION_REQUEST_CHIP,
    TASK_LIST_VIEW_CHIP,
    ...(input.board.summary.userConfirmationRequired > 0
      ? [IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP]
      : []),
    ...(hasFailed ? [AI_DEVELOPER_REMEDIATION_REQUEST_CHIP] : [AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP]),
  ];

  const content = [
    "구현 작업 보드입니다.",
    "",
    ...(currentLine ? [`현재 실행 중:`, currentLine, ""] : []),
    "작업 목록:",
    "TASK ID | 작업 | 개발자 | 검수자 | 보안관 | SCM | 사용자 확인 | 상태",
    ...(taskLines.length ? taskLines : ["(개발자 작업이 없습니다)"]),
    "",
    "통합 정리 단계:",
    ...(integratedLines.length ? integratedLines : ["(통합 단계 없음)"]),
    "",
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
  const lines = rows.map(
    (row) =>
      `${row.taskId} | ${row.title} | ${row.userConfirmation}${row.userConfirmationReason ? ` | ${row.userConfirmationReason}` : ""}`,
  );

  return newRequirementsMessage({
    id: `impl-user-confirmation-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: ["사용자 확인이 필요한 작업입니다.", "", ...lines].join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_TASK_LIST_READY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [TASK_LIST_VIEW_CHIP, IMPLEMENTATION_GENERATION_REQUEST_CHIP],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1185,
    },
  });
}

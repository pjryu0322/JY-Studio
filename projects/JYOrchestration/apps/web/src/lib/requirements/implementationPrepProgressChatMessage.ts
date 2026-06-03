import {
  buildPseudoImplementationPrepProgress,
  formatImplementationPrepProgressUserStepLabel,
  type ImplementationPrepProgressPhase,
  type ImplementationPrepProgressSnapshot,
} from "@/lib/requirements/implementationPrepProgress";
import { QUICK_DESIGN_CONFIRM_ACTION_LABEL } from "@/lib/requirements/implementationUxLabels";
import {
  newRequirementsMessage,
  type RequirementsMessage,
} from "@/lib/requirements/requirementsMessage";

export const QUICK_DESIGN_IMPLEMENTATION_PREP_PROGRESS_INTERNAL_TYPE =
  "quick_design_implementation_prep_progress" as const;

export const IMPLEMENTATION_PREP_LOG_VIEW_CHIP_LABEL = "로그 보기" as const;

export type ImplementationPrepProgressStatus = "running" | "completed" | "partial" | "failed";

export type ImplementationPrepProgressMessageMeta = Readonly<{
  readonly progressKind: "implementation_prep";
  readonly progressStatus: ImplementationPrepProgressStatus;
  readonly progressPercent: number;
  readonly currentStepLabel: string;
  readonly progressPhase?: ImplementationPrepProgressPhase;
}>;

const PROGRESS_MESSAGE_ID = "quick-design-implementation-prep-progress" as const;

export function isImplementationPrepProgressMessage(message: RequirementsMessage): boolean {
  return (
    String(message.meta?.internalType ?? "").trim() ===
    QUICK_DESIGN_IMPLEMENTATION_PREP_PROGRESS_INTERNAL_TYPE
  );
}

export function findImplementationPrepProgressMessageIndex(
  messages: readonly RequirementsMessage[],
): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isImplementationPrepProgressMessage(messages[i]!)) return i;
  }
  return -1;
}

export function removeImplementationPrepProgressMessages(
  messages: readonly RequirementsMessage[],
): RequirementsMessage[] {
  return messages.filter((message) => !isImplementationPrepProgressMessage(message));
}

export function shouldRefreshImplementationPrepProgressMessage(input: {
  readonly previousPercent: number | null;
  readonly previousPhase: ImplementationPrepProgressPhase | null;
  readonly next: ImplementationPrepProgressSnapshot;
}): boolean {
  if (input.previousPercent == null || input.previousPhase == null) return true;
  if (input.previousPhase !== input.next.phase) return true;
  return Math.abs(input.next.percent - input.previousPercent) >= 5;
}

export function buildImplementationPrepProgressChatContent(input: {
  readonly snapshot: ImplementationPrepProgressSnapshot;
  readonly progressStatus: ImplementationPrepProgressStatus;
  readonly errorMessage?: string | null;
}): string {
  const stepLabel = formatImplementationPrepProgressUserStepLabel(input.snapshot.phase);
  if (input.progressStatus === "failed") {
    const detail = String(input.errorMessage ?? "").trim();
    return [
      "구현 준비 산출물 생성에 실패했습니다.",
      "",
      detail || "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      "",
      "필요하면 Quick Design 확정을 다시 시도하거나 로그 탭에서 상세 내용을 확인할 수 있습니다.",
    ].join("\n");
  }

  if (input.progressStatus === "partial") {
    return [
      "구현 준비 산출물은 생성되었지만 일부 CodeTask는 기본 규칙으로 생성되었습니다.",
      "",
      "구현단계 진입은 가능하지만, 작업 전 일부 항목을 확인하는 것이 좋습니다.",
      "",
      "상세 내용은 로그 탭의 실행 로그에서 확인할 수 있습니다.",
    ].join("\n");
  }

  if (input.progressStatus === "completed") {
    const stepLabel = formatImplementationPrepProgressUserStepLabel(input.snapshot.phase);
    return [
      "구현 준비 산출물 생성이 완료되었습니다.",
      "",
      `진행률: ${input.snapshot.percent}%`,
      `현재 단계: ${stepLabel}`,
      "",
      "이제 구현단계에서 실행할 CodeTask를 선택할 수 있습니다.",
      "",
      "상세 내용은 로그 탭의 실행 로그에서 확인할 수 있습니다.",
    ].join("\n");
  }

  return [
    "Quick Design 확정 내용을 기준으로 구현 준비 산출물을 생성하고 있습니다.",
    "",
    `현재 ${stepLabel} 중입니다.`,
    "완료되면 구현단계에서 실행할 수 있는 작업 목록을 보여드리겠습니다.",
    "",
    `진행률: ${input.snapshot.percent}%`,
    `현재 단계: ${stepLabel}`,
    "예상 소요: 약 2~3분",
    "",
    "상세 로그는 로그 탭에서 확인할 수 있습니다.",
  ].join("\n");
}

export function buildImplementationPrepProgressMessage(input: {
  readonly snapshot?: ImplementationPrepProgressSnapshot;
  readonly progressStatus: ImplementationPrepProgressStatus;
  readonly nowIso: string;
  readonly errorMessage?: string | null;
  readonly interviewSuggestions?: readonly string[];
}): RequirementsMessage {
  const snapshot =
    input.snapshot ??
    buildPseudoImplementationPrepProgress(0, { batchConcurrency: undefined });
  const stepLabel = formatImplementationPrepProgressUserStepLabel(snapshot.phase);
  const content = buildImplementationPrepProgressChatContent({
    snapshot,
    progressStatus: input.progressStatus,
    errorMessage: input.errorMessage,
  });
  const suggestions =
    input.progressStatus === "failed"
      ? input.interviewSuggestions ?? [
          QUICK_DESIGN_CONFIRM_ACTION_LABEL,
          IMPLEMENTATION_PREP_LOG_VIEW_CHIP_LABEL,
        ]
      : [];

  return newRequirementsMessage({
    id: PROGRESS_MESSAGE_ID,
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content,
    createdAt: input.nowIso,
    meta: {
      stage: "REQUIREMENTS",
      internalType: QUICK_DESIGN_IMPLEMENTATION_PREP_PROGRESS_INTERNAL_TYPE,
      serviceDesignStage: "requirements",
      interviewAllowCustomInput: true,
      ...(suggestions.length ? { interviewSuggestions: [...suggestions] } : {}),
    },
  });
}

export function upsertImplementationPrepProgressMessage(input: {
  readonly messages: readonly RequirementsMessage[];
  readonly progressStatus: ImplementationPrepProgressStatus;
  readonly snapshot?: ImplementationPrepProgressSnapshot;
  readonly nowIso: string;
  readonly errorMessage?: string | null;
}): RequirementsMessage[] {
  const next = buildImplementationPrepProgressMessage({
    snapshot: input.snapshot,
    progressStatus: input.progressStatus,
    nowIso: input.nowIso,
    errorMessage: input.errorMessage,
  });
  const index = findImplementationPrepProgressMessageIndex(input.messages);
  if (index < 0) return [...input.messages, next];
  return input.messages.map((message, i) => (i === index ? next : message));
}

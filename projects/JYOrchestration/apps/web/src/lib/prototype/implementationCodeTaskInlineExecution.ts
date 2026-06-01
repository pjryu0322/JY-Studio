import type {
  CodeAgentExecutionProgressStep,
  CodeAgentExecutionProgressView,
} from "@/lib/prototype/codeAgentExecutionProgressView";

export type CodeTaskInlineExecutionDetail = Readonly<{
  readonly statusLabel: string;
  readonly summaryLine?: string;
  readonly nextProcessingHint?: string;
  readonly pipelineSteps?: readonly CodeAgentExecutionProgressStep[];
  readonly canCancelCloudAgentPolling?: boolean;
  readonly technicalProgress?: CodeAgentExecutionProgressView;
}>;

const DEFAULT_NEXT_HINT =
  "다음 처리: AI 개발자 실행 → GitHub commit 확인 → 경량검사 → 필요 시 검수/보안" as const;

export function buildCodeTaskInlineExecutionDetail(input: {
  readonly progress: CodeAgentExecutionProgressView;
  readonly parentTaskId: string;
  readonly isSelected: boolean;
}): CodeTaskInlineExecutionDetail | undefined {
  if (!input.isSelected) return undefined;

  const activeParentId = input.progress.selectedTaskId?.trim();
  const matchesActiveParent = !activeParentId || activeParentId === input.parentTaskId;

  if (!matchesActiveParent) {
    return {
      statusLabel: "대기",
      nextProcessingHint: DEFAULT_NEXT_HINT,
    };
  }

  const isIdle = input.progress.status === "idle";
  return {
    statusLabel: input.progress.statusLabel,
    ...(input.progress.summaryLine ? { summaryLine: input.progress.summaryLine } : {}),
    nextProcessingHint: input.progress.nextProcessingHint ?? DEFAULT_NEXT_HINT,
    ...(input.progress.compactSteps?.length ? { pipelineSteps: input.progress.compactSteps } : {}),
    ...(input.progress.canCancelCloudAgentPolling ? { canCancelCloudAgentPolling: true } : {}),
    ...(matchesActiveParent && !isIdle ? { technicalProgress: input.progress } : {}),
  };
}

export const CODE_TASK_INLINE_TIMELINE_HINT =
  "상세 로그는 로그 탭의 실행 로그에서 확인할 수 있습니다." as const;

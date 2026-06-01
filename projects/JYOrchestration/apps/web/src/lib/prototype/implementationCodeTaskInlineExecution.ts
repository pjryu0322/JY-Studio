import type {
  CodeAgentExecutionProgressStep,
  CodeAgentExecutionProgressView,
} from "@/lib/prototype/codeAgentExecutionProgressView";
import { formatTaskCursorElapsedMinutes } from "@/lib/prototype/taskCursorClientPollLoop";
import type { CodeTaskExecutionFlowStepVm } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import {
  TASK_CURSOR_POLLING_CANCEL_HINT,
  TASK_CURSOR_STATUS_CHECK_RESUME_HINT,
} from "@/lib/prototype/taskCursorExecution";

export type CodeTaskInlineExecutionDetail = Readonly<{
  readonly statusLabel: string;
  readonly scopeLine: string;
  readonly compactLine: string;
  readonly summaryLine?: string;
  readonly nextProcessingHint?: string;
  readonly executionFlowSteps?: readonly CodeTaskExecutionFlowStepVm[];
  readonly pipelineSteps?: readonly CodeAgentExecutionProgressStep[];
  readonly canCancelCloudAgentPolling?: boolean;
  readonly pollingCancelHint?: string;
  readonly canResumeStatusCheck?: boolean;
  readonly statusCheckResumeHint?: string;
  readonly technicalProgress?: CodeAgentExecutionProgressView;
}>;

export const CODE_TASK_INLINE_PARENT_SCOPE_LABEL =
  "이 CodeTask가 포함된 Process Task 실행 상태입니다." as const;

export {
  TASK_CURSOR_POLLING_CANCEL_HINT as CODE_TASK_INLINE_POLLING_CANCEL_HINT,
  TASK_CURSOR_STATUS_CHECK_RESUME_HINT as CODE_TASK_INLINE_STATUS_CHECK_RESUME_HINT,
} from "@/lib/prototype/taskCursorExecution";

const DEFAULT_NEXT_HINT =
  "다음 처리: AI 개발자 실행 → GitHub commit 확인 → 경량검사 → 필요 시 검수/보안" as const;

function buildCompactLine(input: {
  readonly statusLabel: string;
  readonly progress: CodeAgentExecutionProgressView;
}): string {
  const progressHint = input.progress.nextProcessingHint?.trim();
  const shortProgress =
    progressHint && progressHint.length <= 48
      ? progressHint
      : input.progress.status === "cursor_running" ||
          input.progress.status === "cursor_requested" ||
          input.progress.status === "status_check_stopped"
        ? input.progress.status === "status_check_stopped"
          ? "상태 확인 중단됨"
          : "Cloud Agent 결과 확인 중"
        : progressHint?.slice(0, 40) ?? "대기";
  return `상태: ${input.statusLabel} · 진행: ${shortProgress}`;
}

export function buildCodeTaskInlineExecutionDetail(input: {
  readonly progress: CodeAgentExecutionProgressView;
  readonly parentTaskId: string;
  readonly isSelected: boolean;
  readonly executionFlowSteps?: readonly CodeTaskExecutionFlowStepVm[];
}): CodeTaskInlineExecutionDetail | undefined {
  if (!input.isSelected) return undefined;

  const activeParentId = input.progress.selectedTaskId?.trim();
  const matchesActiveParent = !activeParentId || activeParentId === input.parentTaskId;

  if (!matchesActiveParent) {
    return {
      statusLabel: "대기",
      scopeLine: CODE_TASK_INLINE_PARENT_SCOPE_LABEL,
      compactLine: `상태: 대기 · 진행: Quick 실행 대기`,
      nextProcessingHint: DEFAULT_NEXT_HINT,
    };
  }

  const isIdle = input.progress.status === "idle";
  const statusLabel = input.progress.statusLabel;
  const elapsed =
    input.progress.status === "cursor_running" || input.progress.status === "cursor_requested"
      ? formatTaskCursorElapsedMinutes(
          input.progress.recentEvents?.[0]?.updatedAt ??
            input.progress.recentEvents?.[0]?.createdAt,
        )
      : null;
  const statusWithElapsed =
    elapsed != null && !statusLabel.includes("분")
      ? `${statusLabel} · 경과 ${elapsed}분`
      : statusLabel;

  return {
    statusLabel: statusWithElapsed,
    scopeLine: CODE_TASK_INLINE_PARENT_SCOPE_LABEL,
    compactLine: buildCompactLine({
      statusLabel,
      progress: input.progress,
    }),
    ...(input.progress.summaryLine ? { summaryLine: input.progress.summaryLine } : {}),
    nextProcessingHint: input.progress.nextProcessingHint ?? DEFAULT_NEXT_HINT,
    ...(input.executionFlowSteps?.length ? { executionFlowSteps: input.executionFlowSteps } : {}),
    ...(input.progress.compactSteps?.length && !isIdle
      ? { pipelineSteps: input.progress.compactSteps }
      : {}),
    ...(input.progress.canCancelCloudAgentPolling
      ? {
          canCancelCloudAgentPolling: true,
          pollingCancelHint: TASK_CURSOR_POLLING_CANCEL_HINT,
        }
      : {}),
    ...(input.progress.canResumeStatusCheck
      ? {
          canResumeStatusCheck: true,
          statusCheckResumeHint: TASK_CURSOR_STATUS_CHECK_RESUME_HINT,
        }
      : {}),
    ...(matchesActiveParent && !isIdle ? { technicalProgress: input.progress } : {}),
  };
}

export const CODE_TASK_INLINE_TIMELINE_HINT =
  "상세 로그는 로그 탭의 실행 로그에서 확인할 수 있습니다." as const;

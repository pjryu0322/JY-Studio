import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { recoverImplementationRuntimeState } from "@/lib/prototype/implementationRuntimeRecovery";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export const IMPLEMENTATION_EXECUTION_STALE_MINUTES = 30 as const;
export const EXECUTION_STALE_FAILURE_REASON = "execution_stale" as const;
export const EXECUTION_FORCE_RELEASE_FAILURE_REASON = "admin_force_release" as const;

export const EXECUTION_STALE_USER_MESSAGE =
  "30분 이상 진행이 없어 실행을 만료(STALE) 처리했습니다. [선택한 CodeTask 실행]으로 다시 시도해 주세요." as const;

export const EXECUTION_FORCE_RELEASE_USER_MESSAGE =
  "실행 잠금을 해제했습니다. 환경을 확인한 뒤 [선택한 CodeTask 실행]으로 다시 시도해 주세요." as const;

export type ImplementationExecutionDeadlockIssue =
  | "stale_task_cursor"
  | "stale_code_task_run"
  | "stale_quick_run"
  | "in_flight_without_run"
  | "force_release";

export type ImplementationExecutionDeadlockRecoveryResult = Readonly<{
  readonly issues: readonly ImplementationExecutionDeadlockIssue[];
  readonly patch: Record<string, unknown> | null;
  readonly userMessage: string | null;
  readonly redispatch: import("@/lib/prototype/implementationRuntimeState").ImplementationRuntimeActiveDispatchV1 | null;
}>;

/** @deprecated Runtime recovery로 위임 — 하위 호환용 래퍼 */
export function recoverImplementationExecutionDeadlock(input: {
  readonly rawRequirementsState: Record<string, unknown>;
  readonly projectId?: string;
  readonly nowIso?: string;
  readonly forceRelease?: boolean;
  readonly staleMinutes?: number;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
}): ImplementationExecutionDeadlockRecoveryResult {
  const projectId =
    input.projectId?.trim() ||
    String(
      (input.rawRequirementsState.implementationRuntimeStateV1 as { projectId?: string } | undefined)
        ?.projectId ??
        (input.rawRequirementsState.codeTaskExecutionQueueV1 as { projectId?: string } | undefined)
          ?.projectId ??
        "",
    ).trim();
  if (!projectId) {
    return { issues: [], patch: null, userMessage: null, redispatch: null };
  }
  const result = recoverImplementationRuntimeState({
    rawRequirementsState: input.rawRequirementsState,
    projectId,
    nowIso: input.nowIso,
    forceRelease: input.forceRelease,
  });
  return {
    issues: result.issues as ImplementationExecutionDeadlockIssue[],
    patch: result.patch,
    userMessage: result.userMessage,
    redispatch: result.redispatch,
  };
}

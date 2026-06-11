import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

/** Board/integration UX: block integration prepare while runnable CodeTasks remain. */
export const INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE =
  "실행 가능한 미완료 작업이 있습니다. 먼저 선택 작업 실행을 완료해 주세요." as const;

export function evaluateIntegrationBlockedByRunnableBoardSummary(
  summary: Pick<ImplementationCodeTaskSelectionSummaryV1, "runnableCount">,
): Readonly<{ readonly ok: boolean; readonly message: string | null }> {
  if (summary.runnableCount > 0) {
    return { ok: false, message: INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE };
  }
  return { ok: true, message: null };
}

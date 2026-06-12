import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

/** Board gate summary for eligibility tests (integration-ready, no runnable). */
export function integrationReadyBoardGateSummary(input: {
  readonly integrationReadyCodeTaskIds: readonly string[];
}): ImplementationCodeTaskSelectionSummaryV1 {
  const ids = [...input.integrationReadyCodeTaskIds];
  return {
    totalCount: ids.length,
    runnableCount: 0,
    selectedRunnableCount: 0,
    selectedRunnableCodeTaskIds: [],
    integrationReadyCount: ids.length,
    integrationReadyCodeTaskIds: ids,
  };
}

export function blockedBoardGateSummary(input: {
  readonly totalCount: number;
  readonly integrationReadyCount?: number;
  readonly runnableCount?: number;
}): ImplementationCodeTaskSelectionSummaryV1 {
  const total = input.totalCount;
  const integrationReady = input.integrationReadyCount ?? 0;
  const runnable = input.runnableCount ?? Math.max(0, total - integrationReady);
  return {
    totalCount: total,
    runnableCount: runnable,
    selectedRunnableCount: runnable,
    selectedRunnableCodeTaskIds: [],
    integrationReadyCount: integrationReady,
    integrationReadyCodeTaskIds: [],
  };
}

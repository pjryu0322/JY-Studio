import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

/** Board 기준 통합 merge gate: runnable 없음 + integration-ready 1개 이상 */
export function isBoardSummaryReadyForIntegrationMerge(
  summary: Pick<ImplementationCodeTaskSelectionSummaryV1, "runnableCount" | "integrationReadyCount">,
): boolean {
  return summary.runnableCount === 0 && summary.integrationReadyCount > 0;
}

export function shouldLogIntegrationReadyPartialCoverage(
  summary: Pick<
    ImplementationCodeTaskSelectionSummaryV1,
    "totalCount" | "integrationReadyCount" | "runnableCount"
  >,
): boolean {
  return (
    summary.runnableCount === 0 &&
    summary.integrationReadyCount > 0 &&
    summary.totalCount > 0 &&
    summary.integrationReadyCount < summary.totalCount
  );
}

export function logIntegrationReadyPartialCoverageWarning(input: {
  readonly projectId?: string | null;
  readonly summary: Pick<
    ImplementationCodeTaskSelectionSummaryV1,
    "totalCount" | "integrationReadyCount" | "runnableCount"
  >;
}): void {
  if (!shouldLogIntegrationReadyPartialCoverage(input.summary)) return;
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: "implementation_integration_gate_partial_ready_warning",
      projectId: input.projectId ?? null,
      runnableCount: input.summary.runnableCount,
      integrationReadyCount: input.summary.integrationReadyCount,
      totalCount: input.summary.totalCount,
      message:
        "integrationReadyCount < totalCount; proceeding with integration-ready CodeTasks only (not a block)",
    }),
  );
}

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
  countSummary?: Pick<
    ImplementationIntegrationCountSummaryV1,
    "executableCodeTaskCount" | "totalOrchestrationUnitCount" | "integrationTaskCount"
  > | null,
): boolean {
  if (summary.runnableCount > 0 || summary.integrationReadyCount === 0) return false;

  const executableBasis = countSummary?.executableCodeTaskCount ?? summary.totalCount;
  if (summary.integrationReadyCount < executableBasis) {
    return true;
  }

  if (
    countSummary &&
    countSummary.totalOrchestrationUnitCount > executableBasis &&
    summary.integrationReadyCount >= executableBasis
  ) {
    return true;
  }

  return (
    summary.totalCount > 0 && summary.integrationReadyCount < summary.totalCount
  );
}

export function logIntegrationReadyPartialCoverageWarning(input: {
  readonly projectId?: string | null;
  readonly summary: Pick<
    ImplementationCodeTaskSelectionSummaryV1,
    "totalCount" | "integrationReadyCount" | "runnableCount"
  >;
  readonly countSummary?: Pick<
    ImplementationIntegrationCountSummaryV1,
    "executableCodeTaskCount" | "totalOrchestrationUnitCount" | "integrationTaskCount"
  > | null;
}): void {
  if (!shouldLogIntegrationReadyPartialCoverage(input.summary, input.countSummary)) return;
  if (typeof console === "undefined" || !console.info) return;
  const executableBasis =
    input.countSummary?.executableCodeTaskCount ?? input.summary.totalCount;
  console.info(
    JSON.stringify({
      action: "implementation_integration_gate_partial_ready_warning",
      projectId: input.projectId ?? null,
      runnableCount: input.summary.runnableCount,
      integrationReadyCount: input.summary.integrationReadyCount,
      totalCount: input.summary.totalCount,
      executableCodeTaskCount: executableBasis,
      integrationTaskCount: input.countSummary?.integrationTaskCount ?? null,
      totalOrchestrationUnitCount: input.countSummary?.totalOrchestrationUnitCount ?? null,
      warningReason: "partial_integration_ready_count",
      message:
        "Gate uses executable CodeTask count only; integration orchestration tasks are excluded from block conditions",
    }),
  );
}

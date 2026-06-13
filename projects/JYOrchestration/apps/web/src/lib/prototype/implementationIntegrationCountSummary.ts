import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveCodeTaskPlanAggregateCounts } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  isExecutableCodeTaskExecutionUnit,
  isIntegrationOrchestrationExecutionUnit,
} from "@/lib/prototype/implementationExecutionUnitOrchestrationKind";

export type ImplementationIntegrationCountSummaryV1 = Readonly<{
  readonly executableCodeTaskCount: number;
  readonly integrationTaskCount: number;
  readonly totalOrchestrationUnitCount: number;
  readonly runnableCodeTaskCount: number;
  readonly completedCodeTaskCount: number;
  readonly verifiedCodeTaskCount: number;
  readonly integrationReadyCodeTaskCount: number;
  readonly countModel: "code_tasks_exclude_integration";
}>;

export function buildImplementationIntegrationCountSummary(input: {
  readonly boardSummary: Pick<
    ImplementationCodeTaskSelectionSummaryV1,
    "totalCount" | "runnableCount" | "integrationReadyCount"
  >;
  readonly planTasks: readonly ImplementationCodeTaskV1[];
  readonly executionUnits?: readonly ImplementationExecutionUnitV1[];
}): ImplementationIntegrationCountSummaryV1 {
  const planCounts = resolveCodeTaskPlanAggregateCounts(input.planTasks);
  const units = input.executionUnits ?? [];
  const orchestrationUnitCount = units.filter((u) => isIntegrationOrchestrationExecutionUnit(u)).length;
  const executableUnitCount = units.filter((u) => isExecutableCodeTaskExecutionUnit(u)).length;

  const integrationTaskCount = Math.max(
    planCounts.integrationOrchestrationTaskCount,
    orchestrationUnitCount,
  );
  const executableCodeTaskCount =
    input.boardSummary.totalCount > 0
      ? input.boardSummary.totalCount
      : Math.max(planCounts.executableCodeTaskCount, executableUnitCount);

  const totalOrchestrationUnitCount = Math.max(
    planCounts.totalPlannedTaskCount,
    executableCodeTaskCount + integrationTaskCount,
    units.length,
  );

  const integrationReadyCodeTaskCount = input.boardSummary.integrationReadyCount;
  const verifiedCodeTaskCount = integrationReadyCodeTaskCount;

  return {
    executableCodeTaskCount,
    integrationTaskCount,
    totalOrchestrationUnitCount,
    runnableCodeTaskCount: input.boardSummary.runnableCount,
    completedCodeTaskCount: integrationReadyCodeTaskCount,
    verifiedCodeTaskCount,
    integrationReadyCodeTaskCount,
    countModel: "code_tasks_exclude_integration",
  };
}

export function logImplementationIntegrationCountSummary(input: {
  readonly projectId?: string | null;
  readonly action?: string;
  readonly summary: ImplementationIntegrationCountSummaryV1;
}): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: input.action ?? "implementation_integration_count_summary_resolved",
      projectId: input.projectId ?? null,
      ...input.summary,
      gateBasis: "executable_code_tasks_only",
    }),
  );
}

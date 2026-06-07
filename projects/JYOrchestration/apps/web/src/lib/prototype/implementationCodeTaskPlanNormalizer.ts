import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  isMockCodeTaskId,
  planContainsLegacyMockCodeTaskId,
  repairLegacyMockCodeTaskIdsInPlan,
  repairMockCodeTaskIdIfPossible,
} from "@/lib/prototype/codeTaskCanonicalId";
import { parseImplementationCodeTaskPlanValidationReportV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";

export type NormalizeProductionCodeTaskPlanResult = Readonly<{
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly idRepairs: readonly Readonly<{ readonly from: string; readonly to: string; readonly reason: string }>[];
  readonly blockedMockIds: readonly string[];
}>;

export function normalizeProductionCodeTaskPlan(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly nowIso?: string;
}): NormalizeProductionCodeTaskPlanResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];
  const idRepairs: Array<{ from: string; to: string; reason: string }> = [];
  const blockedMockIds: string[] = [];

  for (const task of input.plan.tasks) {
    if (!isMockCodeTaskId(task.codeTaskId)) continue;
    const repair = repairMockCodeTaskIdIfPossible({
      codeTaskId: task.codeTaskId,
      title: task.title,
      branchGroup: parseCodeTaskBranchPlanV1(task.branchPlan)?.branchGroup ?? null,
      workBranch: parseCodeTaskBranchPlanV1(task.branchPlan)?.workBranch ?? null,
      existingCodeTaskIds: input.plan.tasks.map((t) => t.codeTaskId),
    });
    if (repair.status === "repaired") {
      idRepairs.push({
        from: repair.fromCodeTaskId,
        to: repair.toCodeTaskId,
        reason: repair.reason,
      });
      timelineEntries.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_code_task_id_repaired",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: input.plan.projectId,
            fromCodeTaskId: repair.fromCodeTaskId,
            toCodeTaskId: repair.toCodeTaskId,
            reason: repair.reason,
          },
          nowIso,
        }),
      );
    } else if (repair.status === "blocked") {
      blockedMockIds.push(repair.codeTaskId);
    }
  }

  let tasks = repairLegacyMockCodeTaskIdsInPlan(input.plan.tasks);
  const stillMock = planContainsLegacyMockCodeTaskId(tasks);
  const priorReport = parseImplementationCodeTaskPlanValidationReportV1(input.plan.validationReport);
  const validationReport =
    stillMock || blockedMockIds.length
      ? {
          status: "failed" as const,
          checkedAt: nowIso,
          errors: [
            ...(priorReport?.errors ?? []),
            "production_code_task_contains_mock_id",
            ...blockedMockIds.map((id) => `mock_code_task_id_blocked:${id}`),
          ],
          warnings: [
            ...(priorReport?.warnings ?? []),
            ...idRepairs.map((r) => `code_task_id_repaired:${r.from}->${r.to}`),
          ],
        }
      : priorReport ?? {
          status: "passed" as const,
          checkedAt: nowIso,
          errors: [],
          warnings: idRepairs.map((r) => `code_task_id_repaired:${r.from}->${r.to}`),
        };

  return {
    plan: {
      ...input.plan,
      tasks,
      updatedAt: nowIso,
      validationReport,
    },
    timelineEntries,
    idRepairs,
    blockedMockIds,
  };
}

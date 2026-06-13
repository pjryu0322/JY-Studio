import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";

export function resolveSelectedExecutionUnitIdsForFinalWiringGate(input: {
  readonly executionUnits: readonly ImplementationExecutionUnitV1[];
  readonly selectedExecutionUnitIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
}): readonly string[] {
  const persisted = input.selectedExecutionUnitIds.map((id) => id.trim()).filter(Boolean);
  if (persisted.length) return persisted;

  const taskByCodeTaskId = new Map(
    (input.codeTaskPlan?.tasks ?? []).map((task) => [task.codeTaskId.trim(), task] as const),
  );

  return input.executionUnits
    .filter((unit) => {
      const task = taskByCodeTaskId.get(unit.codeTaskId.trim());
      if (task) return !isIntegrationWiringCodeTask(task);
      return !isIntegrationWiringCodeTask({
        codeTaskId: unit.codeTaskId,
        changeType: "unknown",
        title: unit.title,
      });
    })
    .map((unit) => unit.unitId);
}

import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { buildExecutionUnitsFromLegacyState } from "@/lib/prototype/implementationExecutionUnitBuilder";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
  resolveNextExecutableUnit,
  type ResolveNextExecutableUnitResultV1,
} from "@/lib/prototype/implementationExecutionScheduler";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export function resolveQuickRunExecutionContext(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly workItemCount?: number;
}): Readonly<{
  readonly units: ReturnType<typeof buildExecutionUnitsFromLegacyState>["units"];
  readonly selectedUnitIds: readonly string[];
  readonly next: ResolveNextExecutableUnitResultV1;
}> {
  const { units } = buildExecutionUnitsFromLegacyState({
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.runs,
    workItemCount: input.workItemCount,
  });

  const dbSelected =
    input.dbBundle?.job?.selectedCodeTaskIds?.map((id) => id.trim()).filter(Boolean) ?? [];
  const rawSelected = mapSelectedCodeTaskIdsToExecutionUnitIds(
    input.selectedCodeTaskIds?.length ? input.selectedCodeTaskIds : dbSelected,
  );
  const { selectedUnitIds } = reconcileSelectedExecutionUnitIds({
    selectedUnitIds: rawSelected.length ? rawSelected : units.map((u) => u.unitId),
    units,
  });

  const next = resolveNextExecutableUnit({ units, selectedUnitIds });
  return { units, selectedUnitIds, next };
}

export function resolveNextCodeTaskIdFromExecutionUnits(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): string | null {
  const ctx = resolveQuickRunExecutionContext(input);
  if (ctx.next.status === "next") return ctx.next.unit.codeTaskId;
  return null;
}

export function shouldMarkQuickRunHasNextDispatch(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): boolean {
  const ctx = resolveQuickRunExecutionContext(input);
  return ctx.next.status === "next" || ctx.next.status === "in_flight" || ctx.next.status === "blocked";
}

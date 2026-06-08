import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  resolveQuickRunExecutionContextFromPersisted,
  shouldPersistHasNextQuickRunDispatch,
} from "@/lib/prototype/implementationExecutionRuntime";
import type { ResolveNextExecutableUnitResultV1 } from "@/lib/prototype/implementationExecutionScheduler";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/** @deprecated legacy_projection_only — use resolveQuickRunExecutionContextFromPersisted */
export function resolveQuickRunExecutionContext(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly workItemCount?: number;
}): Readonly<{
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
  readonly next: ResolveNextExecutableUnitResultV1;
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const ctx = resolveQuickRunExecutionContextFromPersisted(input);
  return {
    units: ctx.units,
    selectedUnitIds: ctx.selectedUnitIds,
    next: ctx.next,
    orchestrationPatch: ctx.orchestrationPatch,
    timeline: ctx.timeline,
  };
}

export function resolveNextCodeTaskIdFromExecutionUnits(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): string | null {
  const ctx = resolveQuickRunExecutionContextFromPersisted(input);
  if (ctx.next.status === "next") return ctx.next.unit.codeTaskId;
  return null;
}

export function resolveNextExecutionUnitFromRuntime(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): ImplementationExecutionUnitV1 | null {
  const ctx = resolveQuickRunExecutionContextFromPersisted(input);
  return ctx.next.status === "next" ? ctx.next.unit : null;
}

export function shouldMarkQuickRunHasNextDispatch(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): boolean {
  if (!input.projectId.trim()) return false;
  return shouldPersistHasNextQuickRunDispatch({
    projectId: input.projectId,
    requirementsState: input.requirementsState ?? {},
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.runs,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    dbBundle: input.dbBundle,
  });
}

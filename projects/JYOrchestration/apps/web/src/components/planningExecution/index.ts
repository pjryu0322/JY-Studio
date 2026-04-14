/**
 * Planning-originated execution UI skeleton.
 *
 * Components consume only {@link PlanningExecutionScreenViewModel} / embedded view-models built from
 * normalized application responses — not planning handoff, preparation bundle, bridge input, or seed payloads.
 */

export { PlanningExecutionWorkspace } from "./PlanningExecutionWorkspace";
export type { PlanningExecutionWorkspaceProps } from "./PlanningExecutionWorkspace";

export { PlanningExecutionInputPanel } from "./PlanningExecutionInputPanel";
export { PlanningExecutionStatusCard } from "./PlanningExecutionStatusCard";
/** Alias matching UX spec naming (“StatusSummaryCard”). */
export { PlanningExecutionStatusCard as PlanningExecutionStatusSummaryCard } from "./PlanningExecutionStatusCard";

export { PlanningExecutionCounts } from "./PlanningExecutionCounts";
export { PlanningExecutionTaskList } from "./PlanningExecutionTaskList";
/**
 * Combined metrics + ordered task ids (same data as separate METRICS_ROW + TASK_SCREEN sections in the workspace).
 * Use when a single block is enough; {@link PlanningExecutionWorkspace} keeps them split for layout clarity.
 */
export { PlanningExecutionTaskSummaryPanel } from "./PlanningExecutionTaskSummaryPanel";

export { PlanningExecutionMessagePanel } from "./PlanningExecutionMessagePanel";
export { PlanningExecutionActionBar } from "./PlanningExecutionActionBar";
export { PlanningExecutionPlanningSummaryPanel } from "./PlanningExecutionPlanningSummaryPanel";
export { PlanningExecutionConfirmationOrBlockingPanel } from "./PlanningExecutionConfirmationOrBlockingPanel";
export { PlanningExecutionReadinessPanel } from "./PlanningExecutionReadinessPanel";
export { PlanningExecutionExecutionStatusPanel } from "./PlanningExecutionExecutionStatusPanel";

export {
  demoPlanningExecutionScreenViewModel,
  demoPlanningOriginatedExecutionResponse,
} from "./planningExecutionDemoSamples";

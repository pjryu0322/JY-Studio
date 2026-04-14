/**
 * **Planning-originated execution — screen / tab UX structure (structural only).**
 *
 * **Boundaries:**
 * - Normalized {@link import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionResponse}
 *   is the **API/application** contract.
 * - {@link PlanningOriginatedExecutionViewModel} is the **UI data** contract (cards, tones, action intents).
 * - {@link PlanningExecutionScreenViewModel} is the **screen composition** contract: which regions render and how
 *   they bind to the view-model. **Screens must not** read planning handoff, preparation bundle, bridge input, or seed payloads.
 *
 * This module defines **UX structure and bindings** only — no React components, routes, or styling.
 */

import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import { planningOriginatedExecutionStatePolicy } from "../planningOriginatedExecution/planningOriginatedExecutionStateModel";
import type { PlanningOriginatedExecutionViewModel } from "./planningOriginatedExecutionViewModel";
import type { PlanningExecutionStructuralAction } from "./planningOriginatedExecutionViewModel";

/** Optional tab strip for denser UIs; `null` = single-page flow (default minimal layout). */
export type PlanningExecutionScreenTab = "PLANNING" | "EXECUTION_READY" | "RUN_STATUS";

/**
 * Main screen regions (map to cards / stacked panels top-to-bottom).
 * Naming follows product areas: input, status, planning outcome, gating, readiness, run, tasks, actions.
 */
export type PlanningExecutionScreenSection =
  | "INPUT_PANEL"
  | "STATUS_BANNER"
  | "PLANNING_RESULT_SUMMARY"
  | "CONFIRMATION_BLOCKING_PANEL"
  | "EXECUTION_READINESS_PANEL"
  | "EXECUTION_START_STATUS_PANEL"
  | "TASK_SCREEN_SUMMARY_PANEL"
  | "METRICS_ROW"
  | "ACTION_BAR";

/** Which narrative block the layout emphasizes in the middle column. */
export type PlanningExecutionEmphasizedSummary =
  | "BLOCKING"
  | "CONFIRMATION"
  | "READINESS"
  | "RUN"
  | "EXECUTION_FAILURE"
  | "TASKS";

/**
 * Maps a screen section to fields on {@link PlanningOriginatedExecutionViewModel}.
 * Future UI: for each binding, read only the listed slices (no other keys).
 */
export type PlanningExecutionScreenFieldBinding =
  | "statusCard"
  | "counts"
  | "message"
  | "actions"
  | "planningHints"
  | "confirmationNeededSummary"
  | "runId"
  | "projectId";

export type PlanningExecutionScreenSectionBinding = Readonly<{
  section: PlanningExecutionScreenSection;
  /** View-model fields that supply this section’s content. */
  fields: readonly PlanningExecutionScreenFieldBinding[];
}>;

/** Root screen contract: layout + embedded data view-model (single prop for a page shell). */
export type PlanningExecutionScreenViewModel = Readonly<{
  layoutVersion: 1;
  responseStatus: PlanningOriginatedExecutionStatus;
  /**
   * When non-null, a tab strip may highlight this tab; v1 builder keeps `null` for a **single main screen**
   * (minimal wizard-free flow). Tabs are reserved for future density reduction.
   */
  activeTab: PlanningExecutionScreenTab | null;
  /** Sections to render in order (top → bottom). */
  visibleSections: readonly PlanningExecutionScreenSection[];
  /** Ordered bindings for implementers who prefer explicit section→field maps. */
  sectionBindings: readonly PlanningExecutionScreenSectionBinding[];
  emphasizedSummary: PlanningExecutionEmphasizedSummary | null;
  /** Full UI view-model; all screen data must be derived from here or from this layout object only. */
  viewModel: PlanningOriginatedExecutionViewModel;
}>;

/**
 * Which structural actions are valid for each terminal status (documentation + validation).
 * Must stay aligned with {@link import("./planningOriginatedExecutionViewModelBuilder").planningExecutionStructuralActionsForStatus}.
 */
export const PLANNING_EXECUTION_ACTION_AVAILABILITY: Readonly<
  Record<PlanningOriginatedExecutionStatus, readonly PlanningExecutionStructuralAction[]>
> = {
  BLOCKED: [planningOriginatedExecutionStatePolicy("BLOCKED").primaryAction],
  NEEDS_CONFIRMATION: [
    planningOriginatedExecutionStatePolicy("NEEDS_CONFIRMATION").primaryAction,
    ...planningOriginatedExecutionStatePolicy("NEEDS_CONFIRMATION").secondaryActions,
  ],
  READY_FOR_EXECUTION: [
    planningOriginatedExecutionStatePolicy("READY_FOR_EXECUTION").primaryAction,
    ...planningOriginatedExecutionStatePolicy("READY_FOR_EXECUTION").secondaryActions,
  ],
  EXECUTION_STARTED: [
    planningOriginatedExecutionStatePolicy("EXECUTION_STARTED").primaryAction,
    ...planningOriginatedExecutionStatePolicy("EXECUTION_STARTED").secondaryActions,
  ],
  EXECUTION_START_FAILED: [
    planningOriginatedExecutionStatePolicy("EXECUTION_START_FAILED").primaryAction,
    ...planningOriginatedExecutionStatePolicy("EXECUTION_START_FAILED").secondaryActions,
  ],
} as const;

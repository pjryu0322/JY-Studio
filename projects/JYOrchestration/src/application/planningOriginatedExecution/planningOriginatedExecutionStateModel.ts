/**
 * Planning-originated execution — **explicit outward state transition model**.
 *
 * This is the UX/process truth table for the 5 outward terminal states:
 * - which actions are valid (primary/secondary)
 * - whether "prepare execution preview" is allowed
 * - whether "guarded start" is allowed
 *
 * **Boundary:** this models outward UX semantics only; it must not expose internal bundles (handoff/prep/bridge).
 * UI should derive buttons from view-models built from this model (not from engine internals).
 */

import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningExecutionStructuralAction } from "../viewmodels/planningOriginatedExecutionViewModel";

export type PlanningOriginatedExecutionStatePolicy = Readonly<{
  status: PlanningOriginatedExecutionStatus;
  primaryAction: PlanningExecutionStructuralAction;
  secondaryActions: readonly PlanningExecutionStructuralAction[];
  /** May call the facade in PREPARE_ONLY mode. */
  allowPrepare: boolean;
  /** May call the facade in PREPARE_AND_START mode. */
  allowGuardedStart: boolean;
}>;

export const PLANNING_ORIGINATED_EXECUTION_STATE_POLICY: Readonly<
  Record<PlanningOriginatedExecutionStatus, PlanningOriginatedExecutionStatePolicy>
> = {
  BLOCKED: {
    status: "BLOCKED",
    primaryAction: "EDIT_INPUT",
    secondaryActions: [],
    allowPrepare: true,
    allowGuardedStart: false,
  },
  NEEDS_CONFIRMATION: {
    status: "NEEDS_CONFIRMATION",
    primaryAction: "REVIEW_CONFIRMATION",
    secondaryActions: ["EDIT_INPUT"],
    allowPrepare: true,
    allowGuardedStart: true,
  },
  READY_FOR_EXECUTION: {
    status: "READY_FOR_EXECUTION",
    primaryAction: "START_EXECUTION",
    secondaryActions: ["EDIT_INPUT"],
    allowPrepare: true,
    allowGuardedStart: true,
  },
  EXECUTION_STARTED: {
    status: "EXECUTION_STARTED",
    primaryAction: "VIEW_RUN_STATUS",
    secondaryActions: ["REFRESH_STATUS", "EDIT_INPUT"],
    allowPrepare: true,
    allowGuardedStart: false,
  },
  EXECUTION_START_FAILED: {
    status: "EXECUTION_START_FAILED",
    primaryAction: "RETRY_EXECUTION",
    secondaryActions: ["INSPECT_FAILURE", "EDIT_INPUT"],
    allowPrepare: true,
    allowGuardedStart: true,
  },
} as const;

export function planningOriginatedExecutionStatePolicy(
  status: PlanningOriginatedExecutionStatus
): PlanningOriginatedExecutionStatePolicy {
  return PLANNING_ORIGINATED_EXECUTION_STATE_POLICY[status];
}


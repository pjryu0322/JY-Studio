import type { PlanningExecutionActionViewModel, PlanningExecutionStructuralAction } from "@jy-orch/application/public";

function uniq<T>(xs: readonly T[]): T[] {
  const out: T[] = [];
  for (const x of xs) {
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

function removeAction(
  actions: PlanningExecutionActionViewModel,
  a: PlanningExecutionStructuralAction
): PlanningExecutionActionViewModel {
  return normalizePlanningExecutionActions({
    primaryAction: actions.primaryAction === a ? "EDIT_INPUT" : actions.primaryAction,
    secondaryAction: actions.secondaryAction === a ? null : actions.secondaryAction,
    availableActions: actions.availableActions.filter((x) => x !== a),
  });
}

/**
 * Normalizes an action view-model to ensure:
 * - `secondaryAction` is not equal to `primaryAction`
 * - `availableActions` has no duplicates
 * - `availableActions` always contains primary/secondary first (in that order)
 */
export function normalizePlanningExecutionActions(input: PlanningExecutionActionViewModel): PlanningExecutionActionViewModel {
  const primary = input.primaryAction;
  const secondary = input.secondaryAction === primary ? null : input.secondaryAction;
  const available = uniq([
    primary,
    ...(secondary ? ([secondary] as const) : []),
    ...input.availableActions,
  ] as const);
  return { primaryAction: primary, secondaryAction: secondary, availableActions: available };
}

export function deriveRuntimeFailureActions(input: {
  baseActions: PlanningExecutionActionViewModel;
  canInspect: boolean;
  canRetry: boolean;
}): PlanningExecutionActionViewModel {
  const primary: PlanningExecutionStructuralAction = input.canInspect ? "INSPECT_FAILURE" : "RETRY_EXECUTION";
  const secondary: PlanningExecutionStructuralAction | null =
    input.canInspect && input.canRetry ? "RETRY_EXECUTION" : input.canRetry ? "INSPECT_FAILURE" : null;
  return normalizePlanningExecutionActions({
    primaryAction: primary,
    secondaryAction: secondary,
    availableActions: [
      ...(input.canInspect ? (["INSPECT_FAILURE"] as const) : ([] as const)),
      ...(input.canRetry ? (["RETRY_EXECUTION"] as const) : ([] as const)),
      ...input.baseActions.availableActions,
    ],
  });
}

/**
 * Centralized primary-action priority resolver for the workspace.
 *
 * Goal: avoid re-implementing priority logic in React components.
 */
export function resolvePlanningExecutionPrimaryAction(input: {
  responseStatus: "BLOCKED" | "NEEDS_CONFIRMATION" | "READY_FOR_EXECUTION" | "EXECUTION_STARTED" | "EXECUTION_START_FAILED";
  baseActions: PlanningExecutionActionViewModel;
  runStatus: { status: "RUNNING" | "COMPLETED" | "FAILED"; canInspect: boolean; canRetry: boolean } | null;
}): PlanningExecutionActionViewModel {
  const base = normalizePlanningExecutionActions(input.baseActions);
  if (input.responseStatus !== "EXECUTION_STARTED") return base;

  // When run-status is available, ongoing status checks should be panel-local.
  // De-emphasize VIEW_RUN_STATUS in the global action bar to reduce duplication/ambiguity.
  if (input.runStatus && input.runStatus.status !== "FAILED") {
    const stripped = removeAction(base, "VIEW_RUN_STATUS");
    return normalizePlanningExecutionActions({
      primaryAction: "EDIT_INPUT",
      secondaryAction: "REFRESH_STATUS",
      availableActions: ["EDIT_INPUT", "REFRESH_STATUS", ...stripped.availableActions],
    });
  }

  if (input.runStatus && input.runStatus.status === "FAILED") {
    return deriveRuntimeFailureActions({
      baseActions: removeAction(base, "VIEW_RUN_STATUS"),
      canInspect: input.runStatus.canInspect,
      canRetry: input.runStatus.canRetry,
    });
  }

  // No run-status yet: keep VIEW_RUN_STATUS as the entry point.
  return base;
}

const FLOW_ACTIONS: readonly PlanningExecutionStructuralAction[] = [
  "EDIT_INPUT",
  "START_EXECUTION",
  "RETRY_EXECUTION",
] as const;

function keepFlowActionsOnly(actions: PlanningExecutionActionViewModel): PlanningExecutionActionViewModel {
  const allowed = new Set(FLOW_ACTIONS);
  const available = actions.availableActions.filter((a) => allowed.has(a));
  const primary = allowed.has(actions.primaryAction) ? actions.primaryAction : "EDIT_INPUT";
  const secondary =
    actions.secondaryAction && allowed.has(actions.secondaryAction) && actions.secondaryAction !== primary
      ? actions.secondaryAction
      : null;
  return normalizePlanningExecutionActions({ primaryAction: primary, secondaryAction: secondary, availableActions: available });
}

/**
 * ActionBar should be flow control only:
 * - EDIT_INPUT
 * - START_EXECUTION
 * - RETRY_EXECUTION
 *
 * Everything else (run-status refresh/inspect, confirmation review) is handled locally in panels.
 */
export function resolvePlanningExecutionActionBarActions(input: {
  responseStatus: "BLOCKED" | "NEEDS_CONFIRMATION" | "READY_FOR_EXECUTION" | "EXECUTION_STARTED" | "EXECUTION_START_FAILED";
  baseActions: PlanningExecutionActionViewModel;
  runStatus: { status: "RUNNING" | "COMPLETED" | "FAILED"; canInspect: boolean; canRetry: boolean } | null;
}): PlanningExecutionActionViewModel {
  const resolved = resolvePlanningExecutionPrimaryAction(input);
  // Runtime failure: ActionBar offers retry (flow), while inspect stays in the panel.
  if (input.responseStatus === "EXECUTION_STARTED" && input.runStatus?.status === "FAILED") {
    return normalizePlanningExecutionActions({
      primaryAction: "RETRY_EXECUTION",
      secondaryAction: "EDIT_INPUT",
      availableActions: ["RETRY_EXECUTION", "EDIT_INPUT"],
    });
  }
  return keepFlowActionsOnly(resolved);
}



import type { PlanningExecutionActionViewModel, PlanningExecutionStructuralAction } from "@jy-orch/application/public";

function uniq<T>(xs: readonly T[]): T[] {
  const out: T[] = [];
  for (const x of xs) {
    if (!out.includes(x)) out.push(x);
  }
  return out;
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


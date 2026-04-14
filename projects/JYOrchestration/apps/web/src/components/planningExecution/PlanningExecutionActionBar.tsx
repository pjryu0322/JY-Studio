"use client";

/**
 * Structural action intents only — wire `onStructuralAction` to route/facade later; no direct executionService.
 */

import { planningExecutionActionLabel } from "@jy-orch/application/public";
import type { PlanningExecutionActionViewModel, PlanningExecutionStructuralAction } from "@jy-orch/application/public";

export function PlanningExecutionActionBar({
  actions,
  onStructuralAction,
  disabled,
  runStatusRefreshHint,
}: {
  readonly actions: PlanningExecutionActionViewModel;
  readonly onStructuralAction: (a: PlanningExecutionStructuralAction) => void;
  readonly disabled?: boolean;
  readonly runStatusRefreshHint?: boolean;
}) {
  return (
    <footer
      className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
      aria-label="Planning execution actions"
    >
      <button
        type="button"
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        data-action={actions.primaryAction}
        disabled={disabled}
        onClick={() => onStructuralAction(actions.primaryAction)}
      >
        {planningExecutionActionLabel(actions.primaryAction, runStatusRefreshHint ? { kind: "run_status_refresh" } : { kind: "default" })}
      </button>
      {actions.secondaryAction ? (
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
          data-action={actions.secondaryAction}
          disabled={disabled}
          onClick={() => onStructuralAction(actions.secondaryAction!)}
        >
          {planningExecutionActionLabel(actions.secondaryAction!, runStatusRefreshHint ? { kind: "run_status_refresh" } : { kind: "default" })}
        </button>
      ) : null}
      <span className="ml-auto text-xs text-neutral-500">
        Available: {actions.availableActions.map((a) => planningExecutionActionLabel(a, runStatusRefreshHint ? { kind: "run_status_refresh" } : { kind: "default" })).join(" · ")}
      </span>
    </footer>
  );
}

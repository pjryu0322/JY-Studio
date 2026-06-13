"use client";

import { useCallback, type MutableRefObject } from "react";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { dispatchSimpleImplementationStageAction } from "@/lib/prototype/implementationStageActionSimpleDispatch";
import type { ImplementationStageActionSimpleDispatchDeps } from "@/lib/prototype/implementationStageActionSimpleDispatch";
import {
  dispatchReviewAndConfirmationStageAction,
  type ImplementationStageActionReviewDispatchDeps,
} from "@/lib/prototype/implementationStageActionReviewDispatch";
import {
  dispatchExecutionStageAction,
  type ImplementationStageActionExecutionDispatchDeps,
} from "@/lib/prototype/implementationStageActionExecutionDispatch";

/**
 * Controls implementation-stage user/action dispatch.
 *
 * Scope:
 * - route implementation stage actions to the correct controller
 * - execute selected/runnable CodeTask actions
 * - bridge primary Control Plane actions to runtime dispatch
 * - keep runImplementationStageActionRef stable for legacy callers
 *
 * Not scope:
 * - Quick Run job start internals
 * - GitHub verification internals
 * - Integration pipeline internals
 * - Preview deployment internals
 * - board rendering
 */
export type ImplementationStageActionControllerInput = Readonly<{
  readonly startImplementationQuickRunRef: MutableRefObject<
    (() => Promise<ImplementationStageActionRunResult>) | undefined
  >;
  readonly simple: Omit<ImplementationStageActionSimpleDispatchDeps, "startImplementationQuickRun">;
  readonly review: ImplementationStageActionReviewDispatchDeps;
  readonly execution: ImplementationStageActionExecutionDispatchDeps;
}>;

export type ImplementationStageActionControllerValue = Readonly<{
  readonly runImplementationStageAction: (
    actionId: ImplementationStageActionId,
  ) => ImplementationStageActionRunResult;
}>;

export function useImplementationStageActionController(
  input: ImplementationStageActionControllerInput,
): ImplementationStageActionControllerValue {
  const runImplementationStageAction = useCallback(
    (actionId: ImplementationStageActionId): ImplementationStageActionRunResult => {
      const simple = dispatchSimpleImplementationStageAction(actionId, {
        ...input.simple,
        startImplementationQuickRun: () => {
          void input.startImplementationQuickRunRef.current?.();
        },
      });
      if (simple) return simple;

      const reviewOrConfirmation = dispatchReviewAndConfirmationStageAction(
        actionId,
        input.review,
      );
      if (reviewOrConfirmation) return reviewOrConfirmation;

      const execution = dispatchExecutionStageAction(actionId, input.execution);
      if (execution) return execution;
      return { outcome: "blocked", message: "지원하지 않는 구현단계 action입니다." };
    },
    [input],
  );

  return { runImplementationStageAction };
}

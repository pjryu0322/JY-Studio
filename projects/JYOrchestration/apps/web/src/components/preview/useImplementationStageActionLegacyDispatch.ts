"use client";

import { useMemo } from "react";
import type { ImplementationStageActionExecutionDispatchDeps } from "@/lib/prototype/implementationStageActionExecutionDispatch";
import type { ImplementationStageActionReviewDispatchDeps } from "@/lib/prototype/implementationStageActionReviewDispatch";
import type { ImplementationStageActionSimpleDispatchDeps } from "@/lib/prototype/implementationStageActionSimpleDispatch";

export type ImplementationStageActionLegacyDispatchValue = Readonly<{
  readonly simple: Omit<ImplementationStageActionSimpleDispatchDeps, "startImplementationQuickRun">;
  readonly review: ImplementationStageActionReviewDispatchDeps;
  readonly execution: ImplementationStageActionExecutionDispatchDeps;
}>;

export type ImplementationStageActionLegacyDispatchInput = ImplementationStageActionLegacyDispatchValue;

export function useImplementationStageActionLegacyDispatch(
  input: ImplementationStageActionLegacyDispatchInput,
): ImplementationStageActionLegacyDispatchValue {
  return useMemo(
    () => ({
      simple: input.simple,
      review: input.review,
      execution: input.execution,
    }),
    [input.simple, input.execution, input.review],
  );
}

import { useMemo } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentExecutionState } from "@/lib/workflow/executionSelectors";
import {
  buildExecutionPageViews,
  getExecutionRunTimelineViewState,
} from "@/lib/workflow/executionViewState";
import { createExecutionProcessActions } from "@/lib/workflow/executionProcessActions";

type UseExecutionPageViewStateInput = {
  router: AppRouterInstance;
  search: ReadonlyURLSearchParams | null;
  sessionResultsVersion: number;
};

export function useExecutionPageViewState(input: UseExecutionPageViewStateInput) {
  const requirementId = input.search?.get("requirementId")?.trim() || null;
  const sessionId = input.search?.get("sessionId")?.trim() || null;

  const { pre, monitoring, actionState, nextAction } = getCurrentExecutionState(sessionId);

  const timeline = useMemo(
    () =>
      getExecutionRunTimelineViewState({
        sessionId,
        run: pre.businessExecutionRun,
        isRunCurrent: pre.isBusinessExecutionRunCurrent,
        maxEvents: 10,
      }),
    [sessionId, pre.businessExecutionRun, pre.isBusinessExecutionRunCurrent, input.sessionResultsVersion]
  );

  const views = useMemo(
    () =>
      buildExecutionPageViews({
        sessionId,
        requirementId,
        pre,
        monitoring,
        actions: actionState,
        nextAction,
        timeline,
      }),
    [
      sessionId,
      requirementId,
      pre,
      monitoring,
      actionState,
      nextAction,
      timeline,
      input.sessionResultsVersion,
    ]
  );

  const pageActions = useMemo(
    () =>
      createExecutionProcessActions({
        router: input.router,
        sessionId,
        requirementId,
        pre,
        actions: actionState,
      }),
    [input.router, sessionId, requirementId, pre, actionState]
  );

  return {
    sessionId,
    requirementId,
    pre,
    monitoring,
    actions: actionState,
    nextAction,
    timeline,
    views,
    pageActions,
  };
}

import { useMemo } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getPreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import { buildExecutionPageActionState, getBusinessExecutionSessionState } from "@/lib/workflow/businessExecutionSelectors";
import { getBusinessExecutionMonitoringStateForSessionFromPre } from "@/lib/workflow/businessExecutionRunMonitoring";
import { createExecutionPageActions } from "@/lib/workflow/executionPageActions";
import { getExecutionRunTimelineViewState } from "@/lib/workflow/executionPageViewState";

type UseExecutionPageViewStateInput = {
  router: AppRouterInstance;
  search: ReadonlyURLSearchParams | null;
  /** used to trigger recompute when session store updates */
  sessionResultsVersion: number;
};

export function useExecutionPageViewState(input: UseExecutionPageViewStateInput) {
  const requirementId = input.search?.get("requirementId")?.trim() || null;
  const sessionId = input.search?.get("sessionId")?.trim() || null;

  // This selector is cheap and must refresh when the session store version changes.
  // The caller provides `sessionResultsVersion` to force a rerender; we intentionally do not
  // hide it behind useMemo to avoid React Compiler / hooks lint mismatches.
  const pre = getBusinessExecutionSessionState(sessionId);
  const monitoring = getBusinessExecutionMonitoringStateForSessionFromPre(sessionId, pre);
  const actions = buildExecutionPageActionState(pre, monitoring);

  const nextAction = useMemo(
    () =>
      getPreLaunchActionAvailability({
        active: pre.active,
        snapshot: pre.snapshot,
        launchReadiness: pre.launchReadiness,
      }),
    [pre.active, pre.snapshot, pre.launchReadiness]
  );

  const timeline = useMemo(
    () =>
      getExecutionRunTimelineViewState({
        sessionId,
        run: pre.businessExecutionRun,
        isRunCurrent: pre.isBusinessExecutionRunCurrent,
        maxEvents: 8,
      }),
    [sessionId, pre.businessExecutionRun, pre.isBusinessExecutionRunCurrent]
  );

  const pageActions = useMemo(
    () =>
      createExecutionPageActions({
        router: input.router,
        sessionId,
        requirementId,
        pre,
        actions,
      }),
    [input.router, sessionId, requirementId, pre, actions]
  );

  return {
    sessionId,
    requirementId,
    pre,
    monitoring,
    actions,
    nextAction,
    timeline,
    pageActions,
  };
}


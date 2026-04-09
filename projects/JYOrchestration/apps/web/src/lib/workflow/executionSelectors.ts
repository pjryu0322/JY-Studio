/**
 * Read-side selectors for business execution (/execution).
 * Composes session state, monitoring, gating flags, and pre-launch next action.
 */

import { buildExecutionPageActionState, getBusinessExecutionSessionState } from "@/lib/workflow/businessExecutionSelectors";
import type { ExecutionPageActionState } from "@/lib/workflow/businessExecutionSelectors";
import { getBusinessExecutionMonitoringStateForSessionFromPre } from "@/lib/workflow/businessExecutionRunMonitoring";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import { getPreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { PreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { PreExecutionSessionSelector } from "@/lib/workflow/preExecutionSelectors";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";

export type CurrentExecutionBundle = {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actionState: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
};

export function getCurrentExecutionState(sessionId: string | null): CurrentExecutionBundle {
  const pre = getBusinessExecutionSessionState(sessionId);
  const monitoring = getBusinessExecutionMonitoringStateForSessionFromPre(sessionId, pre);
  const actionState = buildExecutionPageActionState(pre, monitoring);
  const nextAction = getPreLaunchActionAvailability({
    active: pre.active,
    snapshot: pre.snapshot,
    launchReadiness: pre.launchReadiness,
  });
  return { sessionId, pre, monitoring, actionState, nextAction };
}

export type ExecutionPhase =
  | "no_session"
  | "needs_snapshot"
  | "needs_active_input"
  | "needs_handoff"
  | "needs_request_approval"
  | "needs_package_or_assignment"
  | "needs_preparation_chain"
  | "needs_run_or_integration"
  | "needs_connector"
  | "complete";

export function getExecutionPhase(sessionId: string | null, pre: PreExecutionSessionSelector): ExecutionPhase {
  if (!sessionId) return "no_session";
  if (!pre.snapshot) return "needs_snapshot";
  if (!pre.isSnapshotActive) return "needs_active_input";
  if (!pre.isHandoffPreparedActive) return "needs_handoff";
  if (!pre.isExecutionDraftApproved || !pre.businessExecutionRequest || !pre.isBusinessExecutionApproved) return "needs_request_approval";
  if (!pre.isBusinessExecutionPackaged || !pre.isExecutionPackageAssigned) return "needs_package_or_assignment";
  if (!pre.isActualLaunchCommandCurrent) return "needs_preparation_chain";
  if (!pre.isBusinessExecutionRunCurrent || !pre.isExecutorIntegrationAdapterCurrent) return "needs_run_or_integration";
  if (!pre.isExecutorConnectorResultCurrent) return "needs_connector";
  return "complete";
}

export function getNextAction(sessionId: string | null): PreLaunchActionAvailability {
  return getCurrentExecutionState(sessionId).nextAction;
}

export function getCurrentRun(pre: PreExecutionSessionSelector): BusinessExecutionRun | null {
  return pre.businessExecutionRun ?? null;
}

export function getCurrentConnectorResult(pre: PreExecutionSessionSelector): ExecutorConnectorResult | null {
  return pre.executorConnectorResult ?? null;
}

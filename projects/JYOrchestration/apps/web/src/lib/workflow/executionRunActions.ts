/**
 * Business execution run mutations (local control + run creation).
 * Centralizes run lifecycle side effects used by /execution process + connector flows.
 */

import {
  appendSessionBusinessExecutionRunEvent,
  applyExecutorConnectorResultToBusinessExecutionRun,
  invokeBusinessExecution,
  markBusinessExecutionRunCompleted,
  markBusinessExecutionRunFailed,
  markBusinessExecutionRunRunning,
  recordSessionBusinessExecutionRun,
} from "@/lib/workflow/collaborationSessionResultStore";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";
import type { PreExecutionSessionSelector } from "@/lib/workflow/preExecutionSelectors";
import {
  createRunCreatedEvent,
  createRunEventFromConnectorResult,
  createTerminalRunEventFromStatus,
} from "@/lib/workflow/businessExecutionRunEvent";

export function startBusinessExecutionForSession(input: {
  sessionId: string | null;
  canStart: boolean;
  pre: PreExecutionSessionSelector;
}): void {
  const { sessionId, canStart, pre } = input;
  if (!sessionId || !canStart) return;
  if (
    !pre.actualLaunchCommand ||
    !pre.actualExecutionAdapterRequest ||
    !pre.executionTriggerIntent ||
    !pre.executorLaunchContract ||
    !pre.executionBridgePayload
  ) {
    return;
  }
  const run = invokeBusinessExecution({
    command: pre.actualLaunchCommand,
    adapter: pre.actualExecutionAdapterRequest,
    triggerIntent: pre.executionTriggerIntent,
    contract: pre.executorLaunchContract,
    bridge: pre.executionBridgePayload,
    handoffRecord: pre.businessLaunchHandoffRecord,
    intent: pre.businessLaunchIntent,
    readiness: pre.executionReadiness,
    workOrder: pre.executorWorkOrder,
    sessionId,
  });
  recordSessionBusinessExecutionRun(sessionId, run);
  appendSessionBusinessExecutionRunEvent(sessionId, run.runId, createRunCreatedEvent(run));
}

export function applyBusinessRunControlForSession(input: {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  kind: "running" | "completed" | "failed";
}): void {
  const { sessionId, pre, kind } = input;
  if (!sessionId || !pre.businessExecutionRun || !pre.isBusinessExecutionRunCurrent) return;
  try {
    const next =
      kind === "running"
        ? markBusinessExecutionRunRunning(pre.businessExecutionRun)
        : kind === "completed"
          ? markBusinessExecutionRunCompleted(pre.businessExecutionRun)
          : markBusinessExecutionRunFailed(pre.businessExecutionRun);
    recordSessionBusinessExecutionRun(sessionId, next);
  } catch {
    /* invalid transition — ignore */
  }
}

/** Append connector run event, apply pilot semantics to run when applicable, record connector result. */
export function recordConnectorInvocationEffects(input: {
  sessionId: string;
  pre: PreExecutionSessionSelector;
  result: ExecutorConnectorResult;
}): void {
  const { sessionId, pre, result } = input;
  if (!pre.businessExecutionRun) return;
  appendSessionBusinessExecutionRunEvent(
    sessionId,
    pre.businessExecutionRun.runId,
    createRunEventFromConnectorResult({ run: pre.businessExecutionRun, result })
  );
  if ((result.executorType === "cursor_executor" || result.executorType === "reviewer") && pre.isBusinessExecutionRunCurrent) {
    const nextRun = applyExecutorConnectorResultToBusinessExecutionRun({
      run: pre.businessExecutionRun,
      connectorResult: result,
    });
    recordSessionBusinessExecutionRun(sessionId, nextRun);
    const terminal = createTerminalRunEventFromStatus(nextRun);
    if (terminal) appendSessionBusinessExecutionRunEvent(sessionId, nextRun.runId, terminal);
  }
}

/** Alias: apply normalized connector result to the current run (events + pilot semantics). */
export const applyConnectorOutcomeToRun = recordConnectorInvocationEffects;

export function applyBusinessExecutionRunControl(input: {
  sessionId: string | null;
  pre: PreExecutionSessionSelector;
  kind: "running" | "completed" | "failed";
}): void {
  applyBusinessRunControlForSession(input);
}

/**
 * Cursor executor pilot connector — distinct path from generic stub (reviewer/scm/security).
 * Real-like internal boundary: validates and normalizes cursor integration payload into a standard result.
 *
 * NOT Stage1/Stage2. NOT Git/PR/merge. NOT environment/procedure test execution.
 *
 * TODO: Reviewer real connector (same normalized result shape).
 * TODO: SCM real connector.
 * TODO: Security real connector.
 * TODO: Connector retry policy (idempotency, max attempts).
 * TODO: Connector timeout policy for async HTTP.
 * TODO: Connector error normalization (HTTP vs validation vs timeout).
 * TODO: Optional HTTP/SDK handoff to external Cursor service when safe.
 */

import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import type { ExecutorIntegrationAdapter } from "@/lib/workflow/executorIntegrationAdapter";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";
import type { ExecutorIntegrationCursorPayload } from "@/lib/workflow/executorIntegrationAdapter";

export type CursorExecutorConnectorPilotInput = {
  integrationAdapter: ExecutorIntegrationAdapter;
  run: BusinessExecutionRun;
  command: ActualLaunchCommand;
  adapter: ActualExecutionAdapterRequest | undefined;
  triggerIntent: ExecutionTriggerIntent | undefined;
  contract: ExecutorLaunchContract | undefined;
  bridge: ExecutionBridgePayload | undefined;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string;
};

function nextCursorPilotRunId(): string {
  return `exconn-curpilot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function summarizeCursorPayload(p: ExecutorIntegrationCursorPayload): string {
  const parts = [
    `Objective: ${p.objective.slice(0, 140)}${p.objective.length > 140 ? "…" : ""}`,
    `Scope: ${p.taskScopeSummary.slice(0, 120)}${p.taskScopeSummary.length > 120 ? "…" : ""}`,
    `Success: ${p.successCriteria.slice(0, 100)}${p.successCriteria.length > 100 ? "…" : ""}`,
  ];
  return parts.join(" · ");
}

/**
 * Pilot path for cursor_executor only. Caller must have already verified integration adapter currency.
 */
export function invokeCursorExecutorConnectorPilot(input: CursorExecutorConnectorPilotInput): ExecutorConnectorResult {
  const { integrationAdapter, sessionId } = input;
  if (integrationAdapter.executorType !== "cursor_executor") {
    throw new Error("invokeCursorExecutorConnectorPilot: executorType must be cursor_executor");
  }
  if (integrationAdapter.sessionId !== sessionId) {
    throw new Error("invokeCursorExecutorConnectorPilot: session mismatch");
  }

  const startedAtIso = new Date().toISOString();
  const payload = integrationAdapter.adapterPayload;

  if (payload.kind !== "cursor_executor") {
    return {
      connectorRunId: nextCursorPilotRunId(),
      integrationAdapterId: integrationAdapter.integrationAdapterId,
      executorType: "cursor_executor",
      requirementId: integrationAdapter.requirementId,
      sessionId: integrationAdapter.sessionId,
      startedAtIso,
      finishedAtIso: startedAtIso,
      status: "failed",
      message: "Cursor pilot connector: integration payload is not a cursor envelope.",
      source: "executor_connector",
      errorMessage: "adapterPayload.kind !== cursor_executor",
      connectorType: "cursor_pilot_v1",
    };
  }

  const objective = payload.objective.trim();
  const instructions = payload.instructions.trim();
  if (!objective || !instructions) {
    return {
      connectorRunId: nextCursorPilotRunId(),
      integrationAdapterId: integrationAdapter.integrationAdapterId,
      executorType: "cursor_executor",
      requirementId: integrationAdapter.requirementId,
      sessionId: integrationAdapter.sessionId,
      startedAtIso,
      finishedAtIso: startedAtIso,
      status: "failed",
      message: "Cursor pilot connector: rejected empty objective or instructions.",
      source: "executor_connector",
      errorMessage: "Validation failed on cursor integration payload.",
      connectorType: "cursor_pilot_v1",
    };
  }

  // Internal boundary: normalize handoff text (real-like step; no network yet).
  const resultSummary = summarizeCursorPayload(payload);

  // Pilot models a short lifecycle in one synchronous boundary: accepted → completed (no Stage1/Stage2).
  return {
    connectorRunId: nextCursorPilotRunId(),
    integrationAdapterId: integrationAdapter.integrationAdapterId,
    executorType: "cursor_executor",
    requirementId: integrationAdapter.requirementId,
    sessionId: integrationAdapter.sessionId,
    startedAtIso,
    finishedAtIso: startedAtIso,
    status: "completed",
    message:
      "Cursor pilot: connector accepted integration envelope, normalized handoff fields, and completed local boundary (not Stage1/Stage2 · not Git · not env test).",
    source: "executor_connector",
    resultSummary,
    connectorType: "cursor_pilot_v1",
  };
}

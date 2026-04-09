/**
 * Reviewer executor pilot connector — distinct path from stub (scm/security) and separate from Stage1/Stage2.
 *
 * Real-like internal boundary: validates reviewer integration payload and produces a normalized connector result.
 * No external calls, no Git/PR/merge, no environment/procedure tests.
 *
 * TODO: SCM real connector pilot (keep stubbed until then).
 * TODO: Security real connector pilot (keep stubbed until then).
 * TODO: Reviewer rubric expansion (beyond focus/checklist/summary).
 * TODO: Timeout + retry policy refinement.
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
import type { ExecutorIntegrationAdapter, ExecutorIntegrationReviewerPayload } from "@/lib/workflow/executorIntegrationAdapter";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";

export type ReviewerExecutorConnectorPilotInput = {
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

function nextReviewerPilotRunId(): string {
  return `exconn-revpilot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function summarizeReviewerPayload(p: ExecutorIntegrationReviewerPayload): string {
  const focus = p.reviewFocus.slice(0, 120) + (p.reviewFocus.length > 120 ? "…" : "");
  const scope = p.targetScopeSummary.slice(0, 120) + (p.targetScopeSummary.length > 120 ? "…" : "");
  const checklist = p.checklist.slice(0, 120) + (p.checklist.length > 120 ? "…" : "");
  return `Focus: ${focus} · Scope: ${scope} · Checklist: ${checklist}`;
}

export function invokeReviewerExecutorConnectorPilot(input: ReviewerExecutorConnectorPilotInput): ExecutorConnectorResult {
  const { integrationAdapter, sessionId } = input;
  if (integrationAdapter.executorType !== "reviewer") {
    throw new Error("invokeReviewerExecutorConnectorPilot: executorType must be reviewer");
  }
  if (integrationAdapter.sessionId !== sessionId) {
    throw new Error("invokeReviewerExecutorConnectorPilot: session mismatch");
  }
  const startedAtIso = new Date().toISOString();
  const payload = integrationAdapter.adapterPayload;

  if (payload.kind !== "reviewer") {
    return {
      connectorRunId: nextReviewerPilotRunId(),
      integrationAdapterId: integrationAdapter.integrationAdapterId,
      executorType: "reviewer",
      requirementId: integrationAdapter.requirementId,
      sessionId: integrationAdapter.sessionId,
      startedAtIso,
      finishedAtIso: startedAtIso,
      status: "failed",
      message: "Reviewer pilot connector: integration payload is not a reviewer envelope.",
      rawStatus: "pilot_invalid_payload_kind",
      source: "executor_connector",
      errorMessage: "adapterPayload.kind !== reviewer",
      errorCode: "invalid_payload",
      connectorType: "reviewer_pilot_v1",
    };
  }

  const focus = payload.reviewFocus.trim();
  const checklist = payload.checklist.trim();
  const scope = payload.targetScopeSummary.trim();
  if (!focus || !checklist || !scope) {
    return {
      connectorRunId: nextReviewerPilotRunId(),
      integrationAdapterId: integrationAdapter.integrationAdapterId,
      executorType: "reviewer",
      requirementId: integrationAdapter.requirementId,
      sessionId: integrationAdapter.sessionId,
      startedAtIso,
      finishedAtIso: startedAtIso,
      status: "failed",
      message: "Reviewer pilot connector: rejected empty focus/checklist/scope.",
      rawStatus: "pilot_invalid_payload_empty_fields",
      source: "executor_connector",
      errorMessage: "Validation failed on reviewer integration payload.",
      errorCode: "invalid_payload",
      connectorType: "reviewer_pilot_v1",
    };
  }

  const resultSummary = summarizeReviewerPayload(payload);
  return {
    connectorRunId: nextReviewerPilotRunId(),
    integrationAdapterId: integrationAdapter.integrationAdapterId,
    executorType: "reviewer",
    requirementId: integrationAdapter.requirementId,
    sessionId: integrationAdapter.sessionId,
    startedAtIso,
    finishedAtIso: startedAtIso,
    status: "completed",
    message:
      "Reviewer pilot: connector accepted reviewer envelope and completed local validation boundary (not Stage1/Stage2 · not Git · not env test).",
    rawStatus: "pilot_completed",
    source: "executor_connector",
    resultSummary,
    connectorType: "reviewer_pilot_v1",
  };
}


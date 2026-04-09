/**
 * Executor integration adapter: structured handoff payload from a business execution run.
 * NOT a real executor connector. NOT Stage1/Stage2. No external calls.
 */

import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import { isBusinessExecutionRunCurrent } from "@/lib/workflow/businessExecutionRun";

export type ExecutorIntegrationAdapterStatus = "integration_ready";

export type ExecutorIntegrationCursorPayload = {
  kind: "cursor_executor";
  integrationMode: "implementation_integration";
  /** High-level outcome the implementation executor should pursue. */
  objective: string;
  /** Plain-language operator instructions (still in-app; no external dispatch). */
  instructions: string;
  /** How success is judged for this handoff envelope. */
  successCriteria: string;
  /** Compact summary of task scope implied by the business run / snapshot. */
  taskScopeSummary: string;
  workloadRef: string;
};

export type ExecutorIntegrationReviewerPayload = {
  kind: "reviewer";
  integrationMode: "review_integration";
  reviewFocus: string;
  checklist: string;
  artifactRef: string;
};

export type ExecutorIntegrationScmPayload = {
  kind: "scm";
  integrationMode: "scm_integration";
  packageHint: string;
  flowHandlingHints: string;
  changeRefHint: string;
};

export type ExecutorIntegrationSecurityPayload = {
  kind: "security";
  integrationMode: "security_integration";
  validationFocus: string;
  riskHints: string;
  policyHint: string;
};

export type ExecutorIntegrationUnassignedPayload = {
  kind: "unassigned";
  integrationMode: "placeholder";
  message: string;
};

export type ExecutorIntegrationAdapterPayload =
  | ExecutorIntegrationCursorPayload
  | ExecutorIntegrationReviewerPayload
  | ExecutorIntegrationScmPayload
  | ExecutorIntegrationSecurityPayload
  | ExecutorIntegrationUnassignedPayload;

export type ExecutorIntegrationAdapter = {
  integrationAdapterId: string;
  runId: string;
  launchCommandId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  adapterPayload: ExecutorIntegrationAdapterPayload;
  createdAtIso: string;
  status: ExecutorIntegrationAdapterStatus;
  source: "executor_integration_adapter";
  adapterType?: string;
  summary?: string;
  note?: string;
};

function nextIntegrationAdapterId(): string {
  return `exint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Lightweight executor-specific payload (typed envelope per executor role). */
export function shapeExecutorIntegrationPayload(
  executorType: ExecutionExecutorType,
  run: BusinessExecutionRun
): ExecutorIntegrationAdapterPayload {
  const ref = `${run.snapshotId.slice(0, 8)}…/${run.runId.slice(0, 12)}…`;
  const runSummaryLine =
    run.summary && run.summary.trim().length > 0
      ? run.summary.trim().slice(0, 160)
      : `Snapshot ${run.snapshotId} · business run ${run.runId} (no run summary).`;
  switch (executorType) {
    case "cursor_executor":
      return {
        kind: "cursor_executor",
        integrationMode: "implementation_integration",
        objective: `Implement work consistent with launch command ${run.launchCommandId} and prepared snapshot (adapter only · not dispatched).`,
        instructions: `Use in-app business execution context for session ${run.sessionId}; do not treat this envelope as Stage1/Stage2 or env test.`,
        successCriteria: `Deliverables map to the confirmed task scope for this snapshot; external execution remains disconnected until a real connector runs.`,
        taskScopeSummary: runSummaryLine,
        workloadRef: ref,
      };
    case "reviewer":
      return {
        kind: "reviewer",
        integrationMode: "review_integration",
        reviewFocus: `Review quality, risk, and fit for snapshot ${run.snapshotId} tied to run ${run.runId}.`,
        checklist: `Trace to requirements · edge cases · testability · rollback posture · security-sensitive paths.`,
        artifactRef: ref,
      };
    case "scm":
      return {
        kind: "scm",
        integrationMode: "scm_integration",
        packageHint: `Anchor SCM integration metadata on launch command ${run.launchCommandId} and snapshot ${run.snapshotId}.`,
        flowHandlingHints: `Prefer explicit branch/change identity per snapshot; no automated Git/PR actions from this adapter layer.`,
        changeRefHint: ref,
      };
    case "security":
      return {
        kind: "security",
        integrationMode: "security_integration",
        validationFocus: `Security validation focus for handoff session ${run.sessionId} · command ${run.launchCommandId}.`,
        riskHints: `Secrets handling · dependency surface · auth boundaries · supply-chain posture (preview text only · no scan run).`,
        policyHint: "No policy scan executed · adapter only.",
      };
    case "unassigned":
      return {
        kind: "unassigned",
        integrationMode: "placeholder",
        message: "Executor not assigned · placeholder integration envelope only.",
      };
  }
}

export function executorIntegrationAdapterPayloadSummary(payload: ExecutorIntegrationAdapterPayload): string {
  switch (payload.kind) {
    case "cursor_executor":
      return payload.taskScopeSummary;
    case "reviewer":
      return payload.reviewFocus;
    case "scm":
      return payload.packageHint;
    case "security":
      return payload.validationFocus;
    case "unassigned":
      return payload.message;
  }
}

export function executorIntegrationAdapterExecutorHint(payload: ExecutorIntegrationAdapterPayload): string {
  switch (payload.kind) {
    case "cursor_executor":
      return `Cursor · ${payload.successCriteria.slice(0, 120)}${payload.successCriteria.length > 120 ? "…" : ""}`;
    case "reviewer":
      return `Reviewer · checklist: ${payload.checklist.slice(0, 100)}${payload.checklist.length > 100 ? "…" : ""}`;
    case "scm":
      return `SCM · flow: ${payload.flowHandlingHints.slice(0, 100)}${payload.flowHandlingHints.length > 100 ? "…" : ""}`;
    case "security":
      return `Security · risks: ${payload.riskHints.slice(0, 100)}${payload.riskHints.length > 100 ? "…" : ""}`;
    case "unassigned":
      return "Unassigned · no executor-specific channel.";
  }
}

export function createExecutorIntegrationAdapter(input: {
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
  note?: string;
}): ExecutorIntegrationAdapter {
  if (input.run.sessionId !== input.sessionId || input.command.sessionId !== input.sessionId) {
    throw new Error("createExecutorIntegrationAdapter: session mismatch");
  }
  if (
    !isBusinessExecutionRunCurrent({
      run: input.run,
      command: input.command,
      adapter: input.adapter,
      triggerIntent: input.triggerIntent,
      contract: input.contract,
      bridge: input.bridge,
      handoffRecord: input.handoffRecord,
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    throw new Error("createExecutorIntegrationAdapter: business execution run is not current");
  }
  const createdAtIso = new Date().toISOString();
  const adapterPayload = shapeExecutorIntegrationPayload(input.run.executorType, input.run);
  const summary = executorIntegrationAdapterPayloadSummary(adapterPayload);
  return {
    integrationAdapterId: nextIntegrationAdapterId(),
    runId: input.run.runId,
    launchCommandId: input.run.launchCommandId,
    executorType: input.run.executorType,
    requirementId: input.run.requirementId,
    sessionId: input.run.sessionId,
    snapshotId: input.run.snapshotId,
    adapterPayload,
    createdAtIso,
    status: "integration_ready",
    source: "executor_integration_adapter",
    adapterType: input.run.executorType,
    summary,
    note: input.note,
  };
}

export function isExecutorIntegrationAdapterCurrent(input: {
  integrationAdapter: ExecutorIntegrationAdapter | undefined;
  run: BusinessExecutionRun | undefined;
  command: ActualLaunchCommand | undefined;
  adapter: ActualExecutionAdapterRequest | undefined;
  triggerIntent: ExecutionTriggerIntent | undefined;
  contract: ExecutorLaunchContract | undefined;
  bridge: ExecutionBridgePayload | undefined;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.integrationAdapter || !input.run || !input.command || !input.sessionId) return false;
  if (input.integrationAdapter.source !== "executor_integration_adapter") return false;
  if (input.integrationAdapter.status !== "integration_ready") return false;
  if (input.integrationAdapter.runId !== input.run.runId) return false;
  if (input.integrationAdapter.launchCommandId !== input.run.launchCommandId) return false;
  if (input.integrationAdapter.sessionId !== input.run.sessionId) return false;
  if (input.integrationAdapter.snapshotId !== input.run.snapshotId) return false;
  if (input.integrationAdapter.executorType !== input.run.executorType) return false;
  if (input.integrationAdapter.requirementId !== input.run.requirementId) return false;
  return isBusinessExecutionRunCurrent({
    run: input.run,
    command: input.command,
    adapter: input.adapter,
    triggerIntent: input.triggerIntent,
    contract: input.contract,
    bridge: input.bridge,
    handoffRecord: input.handoffRecord,
    intent: input.intent,
    readiness: input.readiness,
    workOrder: input.workOrder,
    sessionId: input.sessionId,
  });
}

/** Subtle copy for /tasks and /requirements when an integration row exists. */
export function executorIntegrationAdapterSubtleNote(
  adapter: ExecutorIntegrationAdapter | undefined,
  isCurrent: boolean
): string | null {
  if (!adapter) return null;
  if (!isCurrent) {
    return "Executor integration adapter on file · not tied to current run.";
  }
  return "Integration adapter ready · executor integration prepared · not connected yet.";
}

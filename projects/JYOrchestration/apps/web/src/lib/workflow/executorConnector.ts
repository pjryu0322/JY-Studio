/**
 * Executor connector layer: accepts integration adapter, returns a connector result.
 * cursor_executor → cursor pilot path ({@link invokeCursorExecutorConnectorPilot}).
 * reviewer → reviewer pilot path ({@link invokeReviewerExecutorConnectorPilot}).
 * scm / security / unassigned → {@link stubNonPilotExecutorConnector} (stub only).
 *
 * NOT Stage1/Stage2. NOT env/procedure test execution. No Git/PR/merge here.
 *
 * TODO: SCM / security real connector pilots (same result shape as cursor/reviewer).
 * TODO: Connector retry and timeout policy at this boundary.
 */

import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import type { ExecutorIntegrationAdapter } from "@/lib/workflow/executorIntegrationAdapter";
import { isExecutorIntegrationAdapterCurrent } from "@/lib/workflow/executorIntegrationAdapter";
import { invokeCursorExecutorConnectorPilot } from "@/lib/workflow/cursorExecutorConnectorPilot";
import { invokeReviewerExecutorConnectorPilot } from "@/lib/workflow/reviewerExecutorConnectorPilot";

export type ExecutorConnectorResultStatus = "accepted" | "running" | "completed" | "failed";

export type ExecutorConnectorErrorCode =
  | "execution_error"
  | "timeout"
  | "invalid_payload"
  | "connector_unavailable";

export type ExecutorConnectorResult = {
  connectorRunId: string;
  integrationAdapterId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  startedAtIso: string;
  finishedAtIso?: string;
  status: ExecutorConnectorResultStatus;
  message: string;
  /** Optional raw status from pilot/stub layers before normalization. */
  rawStatus?: string;
  source: "executor_connector";
  resultSummary?: string;
  errorMessage?: string;
  errorCode?: ExecutorConnectorErrorCode;
  connectorType?: string;
};

function nextConnectorRunId(): string {
  return `exconn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeConnectorResult(input: {
  result: ExecutorConnectorResult;
  defaultConnectorType: string;
}): ExecutorConnectorResult {
  const r = input.result;
  const normalized: ExecutorConnectorResult = {
    ...r,
    source: "executor_connector",
    connectorType: r.connectorType ?? input.defaultConnectorType,
  };
  if (normalized.status === "failed") {
    return {
      ...normalized,
      errorCode: normalized.errorCode ?? "execution_error",
      errorMessage: normalized.errorMessage ?? normalized.message,
    };
  }
  return normalized;
}

/**
 * Stub/mock connector for non-cursor executors only.
 * cursor_executor uses {@link invokeCursorExecutorConnectorPilot} — do not add cursor cases here.
 */
function stubNonPilotExecutorConnector(executorType: ExecutionExecutorType): {
  status: ExecutorConnectorResultStatus;
  message: string;
  resultSummary?: string;
  errorMessage?: string;
  rawStatus?: string;
  errorCode?: ExecutorConnectorErrorCode;
} {
  const baseMsg = "Stub connector (no external call · not Stage1/Stage2 · not env test).";
  switch (executorType) {
    case "scm":
      return {
        status: "completed",
        message: `${baseMsg} Mock SCM integration acknowledged.`,
        resultSummary: "Mock SCM connector completed locally.",
        rawStatus: "stub_completed",
      };
    case "security":
      return {
        status: "completed",
        message: `${baseMsg} Mock security integration acknowledged.`,
        resultSummary: "Mock security connector completed locally.",
        rawStatus: "stub_completed",
      };
    case "unassigned":
      return {
        status: "accepted",
        message: `${baseMsg} Placeholder executor — accepted only.`,
        resultSummary: "Unassigned executor stub — no downstream channel.",
        rawStatus: "stub_accepted",
      };
    case "cursor_executor":
      throw new Error("stubNonPilotExecutorConnector: cursor_executor must use pilot path");
    case "reviewer":
      throw new Error("stubNonPilotExecutorConnector: reviewer must use pilot path");
  }
}

/**
 * Single entry point: validates current integration adapter, returns mock connector result (instant).
 * Replace internals later with real connectors; keep this module free of Stage1/Stage2 and Git.
 */
export function invokeExecutorConnector(input: {
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
}): ExecutorConnectorResult {
  if (input.integrationAdapter.sessionId !== input.sessionId) {
    throw new Error("invokeExecutorConnector: session mismatch");
  }
  if (
    !isExecutorIntegrationAdapterCurrent({
      integrationAdapter: input.integrationAdapter,
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
    throw new Error("invokeExecutorConnector: integration adapter is not current");
  }
  if (input.integrationAdapter.executorType === "cursor_executor") {
    const pilot = invokeCursorExecutorConnectorPilot(input);
    return normalizeConnectorResult({ result: pilot, defaultConnectorType: "cursor_pilot_v1" });
  }
  if (input.integrationAdapter.executorType === "reviewer") {
    const pilot = invokeReviewerExecutorConnectorPilot(input);
    return normalizeConnectorResult({ result: pilot, defaultConnectorType: "reviewer_pilot_v1" });
  }
  const startedAtIso = new Date().toISOString();
  const stub = stubNonPilotExecutorConnector(input.integrationAdapter.executorType);
  const finishedAtIso = stub.status === "completed" || stub.status === "failed" ? startedAtIso : undefined;
  const result: ExecutorConnectorResult = {
    connectorRunId: nextConnectorRunId(),
    integrationAdapterId: input.integrationAdapter.integrationAdapterId,
    executorType: input.integrationAdapter.executorType,
    requirementId: input.integrationAdapter.requirementId,
    sessionId: input.integrationAdapter.sessionId,
    startedAtIso,
    finishedAtIso,
    status: stub.status,
    message: stub.message,
    rawStatus: stub.rawStatus,
    source: "executor_connector",
    resultSummary: stub.resultSummary,
    errorMessage: stub.errorMessage,
    errorCode: stub.errorCode,
    connectorType: `stub_${input.integrationAdapter.executorType}`,
  };
  return normalizeConnectorResult({
    result,
    defaultConnectorType: `stub_${input.integrationAdapter.executorType}`,
  });
}

export function isExecutorConnectorResultCurrent(input: {
  result: ExecutorConnectorResult | undefined;
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
  if (!input.result || !input.integrationAdapter || !input.sessionId) return false;
  if (input.result.source !== "executor_connector") return false;
  if (input.result.integrationAdapterId !== input.integrationAdapter.integrationAdapterId) return false;
  if (input.result.sessionId !== input.integrationAdapter.sessionId) return false;
  if (input.result.executorType !== input.integrationAdapter.executorType) return false;
  if (input.result.requirementId !== input.integrationAdapter.requirementId) return false;
  return isExecutorIntegrationAdapterCurrent({
    integrationAdapter: input.integrationAdapter,
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

export function executorConnectorResultSubtleNote(
  result: ExecutorConnectorResult | undefined,
  isCurrent: boolean
): string | null {
  if (!result) return null;
  if (!isCurrent) {
    return "Connector result on file · not tied to current integration adapter.";
  }
  const isCursorPilot = result.connectorType?.startsWith("cursor_pilot") === true;
  switch (result.status) {
    case "accepted":
      return "Connector accepted · not Stage1/Stage2 · not env test.";
    case "running":
      return isCursorPilot
        ? "Cursor pilot running · not env procedure test."
        : "Executor running (stub) · not env procedure test.";
    case "completed":
      return isCursorPilot
        ? "Cursor pilot completed · not Stage1/Stage2 · not env test."
        : "Execution completed (stub) · not env test flow.";
    case "failed":
      return isCursorPilot
        ? "Cursor pilot failed · not env test flow."
        : "Execution failed (stub) · not env test flow.";
    default:
      return "Connector result on file.";
  }
}

/**
 * Executor connector layer: accepts integration adapter, returns a connector result.
 * cursor_executor → cursor pilot path ({@link invokeCursorExecutorConnectorPilot}).
 * reviewer / scm / security / unassigned → {@link stubNonCursorExecutorConnector} (stub only).
 *
 * NOT Stage1/Stage2. NOT env/procedure test execution. No Git/PR/merge here.
 *
 * TODO: Reviewer / SCM / security real connector pilots (same result shape as cursor).
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

export type ExecutorConnectorResultStatus = "accepted" | "running" | "completed" | "failed";

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
  source: "executor_connector";
  resultSummary?: string;
  errorMessage?: string;
  connectorType?: string;
};

function nextConnectorRunId(): string {
  return `exconn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Stub/mock connector for non-cursor executors only.
 * cursor_executor uses {@link invokeCursorExecutorConnectorPilot} — do not add cursor cases here.
 */
function stubNonCursorExecutorConnector(executorType: ExecutionExecutorType): {
  status: ExecutorConnectorResultStatus;
  message: string;
  resultSummary?: string;
  errorMessage?: string;
} {
  const baseMsg = "Stub connector (no external call · not Stage1/Stage2 · not env test).";
  switch (executorType) {
    case "reviewer":
      return {
        status: "completed",
        message: `${baseMsg} Mock review integration acknowledged.`,
        resultSummary: "Mock review connector completed locally.",
      };
    case "scm":
      return {
        status: "completed",
        message: `${baseMsg} Mock SCM integration acknowledged.`,
        resultSummary: "Mock SCM connector completed locally.",
      };
    case "security":
      return {
        status: "completed",
        message: `${baseMsg} Mock security integration acknowledged.`,
        resultSummary: "Mock security connector completed locally.",
      };
    case "unassigned":
      return {
        status: "accepted",
        message: `${baseMsg} Placeholder executor — accepted only.`,
        resultSummary: "Unassigned executor stub — no downstream channel.",
      };
    case "cursor_executor":
      throw new Error("stubNonCursorExecutorConnector: cursor_executor must use cursor pilot path");
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
    return invokeCursorExecutorConnectorPilot(input);
  }
  const startedAtIso = new Date().toISOString();
  const stub = stubNonCursorExecutorConnector(input.integrationAdapter.executorType);
  const finishedAtIso = stub.status === "completed" || stub.status === "failed" ? startedAtIso : undefined;
  return {
    connectorRunId: nextConnectorRunId(),
    integrationAdapterId: input.integrationAdapter.integrationAdapterId,
    executorType: input.integrationAdapter.executorType,
    requirementId: input.integrationAdapter.requirementId,
    sessionId: input.integrationAdapter.sessionId,
    startedAtIso,
    finishedAtIso,
    status: stub.status,
    message: stub.message,
    source: "executor_connector",
    resultSummary: stub.resultSummary,
    errorMessage: stub.errorMessage,
    connectorType: `stub_${input.integrationAdapter.executorType}`,
  };
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

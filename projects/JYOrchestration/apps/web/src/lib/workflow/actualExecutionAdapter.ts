/**
 * Actual execution adapter request: handoff-shaped payload for a future real execution consumer (NOT Stage1/Stage2, NOT launch).
 */

import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import { executorLaunchContractContextSummary } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import { isExecutionTriggerIntentCurrent } from "@/lib/workflow/executionTriggerIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type ActualExecutionAdapterPayload =
  | {
      executorType: "cursor_executor";
      implementationPayload: { candidateTaskCount: number; snapshotId: string };
      objective: string;
      workInstructions: string;
      successCriteria: string;
      executorHint: string;
    }
  | {
      executorType: "reviewer";
      reviewPayload: { candidateTaskCount: number; snapshotId: string };
      reviewFocus: string;
      checklist: string[];
      executorHint: string;
    }
  | {
      executorType: "scm";
      scmHandoffPayload: { packageId: string; snapshotId: string };
      flowNotes: string;
      executorHint: string;
    }
  | {
      executorType: "security";
      securityValidationPayload: { candidateTaskCount: number; snapshotId: string };
      validationFocus: string;
      executorHint: string;
    }
  | {
      executorType: "unassigned";
      routingPayload: { snapshotId: string };
      executorHint: string;
    };

export type ActualExecutionAdapterRequest = {
  adapterRequestId: string;
  triggerIntentId: string;
  launchContractId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  payload: ActualExecutionAdapterPayload;
  createdAtIso: string;
  status: "adapter_ready";
  source: "actual_execution_adapter";
  adapterType?: string;
  summary?: string;
  note?: string;
};

function nextAdapterRequestId(): string {
  return `actexecadp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Executor-specific adapter payload from the current launch contract + trigger intent (no external I/O). */
export function shapeActualExecutionAdapterPayload(input: {
  contract: ExecutorLaunchContract;
  triggerIntent: ExecutionTriggerIntent;
}): ActualExecutionAdapterPayload {
  const wo = input.contract.executionContext.workOrder;
  const n = input.contract.candidateTaskIds.length;
  const snap = input.contract.snapshotId;
  const hints = input.contract.launchHints;
  switch (input.contract.executorType) {
    case "cursor_executor":
      return {
        executorType: "cursor_executor",
        implementationPayload: { candidateTaskCount: n, snapshotId: snap },
        objective: wo.objective,
        workInstructions: wo.workInstructions,
        successCriteria: wo.successCriteria,
        executorHint:
          "Implementation handoff for actual execution runtime — not started here; no Stage1/Stage2.",
      };
    case "reviewer": {
      const reviewFocus =
        hints.executorType === "reviewer" ? hints.reviewScope : `Review ${n} candidate tasks · ${snap}`;
      return {
        executorType: "reviewer",
        reviewPayload: { candidateTaskCount: n, snapshotId: snap },
        reviewFocus,
        checklist: ["Scope clarity", "Risk notes", "Review exit criteria"],
        executorHint: "Review-only adapter — no build or merge implied.",
      };
    }
    case "scm": {
      const pkg = input.contract.executionContext.assignment.packageId;
      const flowNotes =
        hints.executorType === "scm" ? hints.scmFlowHints : `SCM prep for snapshot ${snap}`;
      return {
        executorType: "scm",
        scmHandoffPayload: { packageId: pkg, snapshotId: snap },
        flowNotes,
        executorHint: "SCM flow documentation handoff — pipeline not started from this artifact.",
      };
    }
    case "security": {
      const validationFocus =
        hints.executorType === "security"
          ? hints.securityValidationHints
          : `Security validation for ${n} tasks · ${snap}`;
      return {
        executorType: "security",
        securityValidationPayload: { candidateTaskCount: n, snapshotId: snap },
        validationFocus,
        executorHint: "Security validation packet — actual scan/run triggered separately.",
      };
    }
    case "unassigned":
      return {
        executorType: "unassigned",
        routingPayload: { snapshotId: snap },
        executorHint: "Executor unassigned — resolve routing before actual execution handoff.",
      };
    default:
      throw new Error("shapeActualExecutionAdapterPayload: unsupported executor type");
  }
}

export function actualExecutionAdapterPayloadSummary(request: ActualExecutionAdapterRequest): string {
  const p = request.payload;
  switch (p.executorType) {
    case "cursor_executor":
      return `Implementation · ${p.implementationPayload.candidateTaskCount} tasks · ${truncate(p.objective, 72)}`;
    case "reviewer":
      return `Review · ${p.reviewPayload.candidateTaskCount} tasks · ${truncate(p.reviewFocus, 72)}`;
    case "scm":
      return `SCM · ${p.scmHandoffPayload.packageId} · ${truncate(p.flowNotes, 72)}`;
    case "security":
      return `Security · ${p.securityValidationPayload.candidateTaskCount} tasks · ${truncate(p.validationFocus, 72)}`;
    case "unassigned":
      return `Routing · ${p.routingPayload.snapshotId}`;
    default:
      throw new Error("actualExecutionAdapterPayloadSummary: unsupported payload");
  }
}

export function actualExecutionAdapterExecutorHintPreview(request: ActualExecutionAdapterRequest): string {
  return truncate(request.payload.executorHint, 120);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function createActualExecutionAdapterRequest(input: {
  triggerIntent: ExecutionTriggerIntent;
  contract: ExecutorLaunchContract;
  bridge: ExecutionBridgePayload;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string;
  note?: string;
}): ActualExecutionAdapterRequest {
  if (
    !isExecutionTriggerIntentCurrent({
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
    throw new Error("createActualExecutionAdapterRequest: execution trigger intent is not current");
  }
  if (input.triggerIntent.sessionId !== input.sessionId) {
    throw new Error("createActualExecutionAdapterRequest: trigger intent session mismatch");
  }
  const payload = shapeActualExecutionAdapterPayload({
    contract: input.contract,
    triggerIntent: input.triggerIntent,
  });
  return {
    adapterRequestId: nextAdapterRequestId(),
    triggerIntentId: input.triggerIntent.triggerIntentId,
    launchContractId: input.contract.launchContractId,
    executorType: input.contract.executorType,
    requirementId: input.contract.requirementId,
    sessionId: input.contract.sessionId,
    snapshotId: input.contract.snapshotId,
    payload,
    createdAtIso: new Date().toISOString(),
    status: "adapter_ready",
    source: "actual_execution_adapter",
    adapterType: "actual_execution_adapter_v1",
    summary: executorLaunchContractContextSummary(input.contract),
    note: input.note,
  };
}

export function isActualExecutionAdapterRequestCurrent(input: {
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
  if (!input.adapter || !input.triggerIntent || !input.contract || !input.bridge || !input.sessionId) {
    return false;
  }
  if (
    !isExecutionTriggerIntentCurrent({
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
    return false;
  }
  return (
    input.adapter.status === "adapter_ready" &&
    input.adapter.source === "actual_execution_adapter" &&
    input.adapter.triggerIntentId === input.triggerIntent.triggerIntentId &&
    input.adapter.launchContractId === input.contract.launchContractId &&
    input.adapter.sessionId === input.sessionId &&
    input.adapter.snapshotId === input.contract.snapshotId &&
    input.adapter.executorType === input.contract.executorType &&
    input.adapter.requirementId === input.contract.requirementId &&
    input.adapter.payload.executorType === input.contract.executorType
  );
}

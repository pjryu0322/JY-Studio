/**
 * Executor launch contract: final structured input before real launch (NOT Stage1/Stage2, NOT launch).
 */

import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutionBridgeContext, ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import { isExecutionBridgePayloadCurrent } from "@/lib/workflow/executionBridgePayload";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type ExecutorLaunchHints =
  | { executorType: "cursor_executor"; implementationScope: string; taskExecutionFocus: string }
  | { executorType: "reviewer"; reviewScope: string; reviewCompletionHints: string }
  | { executorType: "scm"; scmFlowHints: string; packagingHints: string }
  | { executorType: "security"; securityValidationHints: string; riskFocus: string }
  | { executorType: "unassigned"; routingHints: string; placeholderFocus: string };

export type ExecutorLaunchContract = {
  launchContractId: string;
  bridgeId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  candidateTaskIds: string[];
  executionContext: ExecutionBridgeContext;
  launchHints: ExecutorLaunchHints;
  createdAtIso: string;
  status: "launch_contract_ready";
  source: "executor_launch_contract";
  contractVersion?: string;
  summary?: string;
  note?: string;
};

function nextLaunchContractId(): string {
  return `exlaunch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function bridgeContextLine(bridge: ExecutionBridgePayload): string {
  const n = bridge.candidateTaskIds.length;
  return `${n} candidate task(s), snapshot ${bridge.snapshotId}`;
}

/** Lightweight executor-specific launch hints derived from the bridge (no external I/O). */
export function shapeExecutorLaunchContract(bridge: ExecutionBridgePayload): ExecutorLaunchHints {
  const line = bridgeContextLine(bridge);
  switch (bridge.executorType) {
    case "cursor_executor":
      return {
        executorType: "cursor_executor",
        implementationScope: `Implementation scope: ${line}. Align with bridge work order objective and instructions.`,
        taskExecutionFocus: `Task execution focus: work candidate tasks for snapshot ${bridge.snapshotId}; keep changes scoped to the package.`,
      };
    case "reviewer":
      return {
        executorType: "reviewer",
        reviewScope: `Review scope: ${line}. Assess clarity, risk, and fit against the bridge context.`,
        reviewCompletionHints: `Complete review with structured feedback; do not start implementation from this contract.`,
      };
    case "scm":
      return {
        executorType: "scm",
        scmFlowHints: `SCM / flow hints: ${line}. Document branching and packaging expectations from assignment context.`,
        packagingHints: `Packaging: mirror package ${bridge.executionContext.assignment.packageId} intent; no merge implied here.`,
      };
    case "security":
      return {
        executorType: "security",
        securityValidationHints: `Security validation: ${line}. Triage data handling, dependencies, and exposure from task descriptions.`,
        riskFocus: `Risk focus: record mitigations and blockers before any launch decision.`,
      };
    case "unassigned":
      return {
        executorType: "unassigned",
        routingHints: `Routing: ${line}. Executor not assigned on bridge — resolve routing before launch.`,
        placeholderFocus: `Placeholder: no executor-specific launch path until assignment is explicit.`,
      };
    default:
      throw new Error("shapeExecutorLaunchContract: unsupported executor type");
  }
}

function cloneBridgeExecutionContext(ctx: ExecutionBridgeContext): ExecutionBridgeContext {
  return {
    workOrder: { ...ctx.workOrder },
    intakeHints: {
      shaped: ctx.intakeHints.shaped,
      summary: ctx.intakeHints.summary,
      note: ctx.intakeHints.note,
      previewLine: ctx.intakeHints.previewLine,
    },
    assignment: { ...ctx.assignment },
  };
}

/** One-line preview for UI (work order title + task count). */
export function executorLaunchContractContextSummary(contract: ExecutorLaunchContract): string {
  const t = contract.executionContext.workOrder.title;
  return `${t} · ${contract.candidateTaskIds.length} tasks`;
}

/** Short preview of launch hints for compact UI. */
export function executorLaunchHintsPreview(hints: ExecutorLaunchHints): string {
  switch (hints.executorType) {
    case "cursor_executor":
      return hints.taskExecutionFocus.slice(0, 120);
    case "reviewer":
      return hints.reviewCompletionHints.slice(0, 120);
    case "scm":
      return hints.packagingHints.slice(0, 120);
    case "security":
      return hints.riskFocus.slice(0, 120);
    case "unassigned":
      return hints.placeholderFocus.slice(0, 120);
    default:
      throw new Error("executorLaunchHintsPreview: unsupported executor type");
  }
}

export function createExecutorLaunchContract(input: {
  bridge: ExecutionBridgePayload;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string;
}): ExecutorLaunchContract {
  if (!isExecutionBridgePayloadCurrent({
    bridge: input.bridge,
    handoffRecord: input.handoffRecord,
    intent: input.intent,
    readiness: input.readiness,
    workOrder: input.workOrder,
    sessionId: input.sessionId,
  })) {
    throw new Error("createExecutorLaunchContract: execution bridge payload is not current");
  }
  if (input.bridge.sessionId !== input.sessionId) {
    throw new Error("createExecutorLaunchContract: bridge session mismatch");
  }
  const launchHints = shapeExecutorLaunchContract(input.bridge);
  const summary = `${input.bridge.executionContext.workOrder.title} · ${input.bridge.candidateTaskIds.length} tasks`;
  return {
    launchContractId: nextLaunchContractId(),
    bridgeId: input.bridge.bridgeId,
    executorType: input.bridge.executorType,
    requirementId: input.bridge.requirementId,
    sessionId: input.bridge.sessionId,
    snapshotId: input.bridge.snapshotId,
    candidateTaskIds: [...input.bridge.candidateTaskIds],
    executionContext: cloneBridgeExecutionContext(input.bridge.executionContext),
    launchHints,
    createdAtIso: new Date().toISOString(),
    status: "launch_contract_ready",
    source: "executor_launch_contract",
    contractVersion: "1",
    summary,
  };
}

export function isExecutorLaunchContractCurrent(input: {
  contract: ExecutorLaunchContract | undefined;
  bridge: ExecutionBridgePayload | undefined;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.contract || !input.bridge || !input.sessionId) return false;
  if (
    !isExecutionBridgePayloadCurrent({
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
    input.contract.status === "launch_contract_ready" &&
    input.contract.source === "executor_launch_contract" &&
    input.contract.bridgeId === input.bridge.bridgeId &&
    input.contract.sessionId === input.sessionId &&
    input.contract.snapshotId === input.bridge.snapshotId &&
    input.contract.executorType === input.bridge.executorType &&
    input.contract.requirementId === input.bridge.requirementId
  );
}

/**
 * Actual launch command: final invocation-shaped artifact before real execution (NOT Stage1/Stage2, NOT launch).
 */

import type {
  ActualExecutionAdapterRequest,
} from "@/lib/workflow/actualExecutionAdapter";
import { isActualExecutionAdapterRequestCurrent } from "@/lib/workflow/actualExecutionAdapter";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";

export type ActualLaunchCommandPayload =
  | {
      executorType: "cursor_executor";
      implementationCommand: {
        mode: "invoke_implementation";
        snapshotId: string;
        candidateTaskCount: number;
      };
      commandHint: string;
    }
  | {
      executorType: "reviewer";
      reviewCommand: { mode: "invoke_review"; snapshotId: string; candidateTaskCount: number };
      commandHint: string;
    }
  | {
      executorType: "scm";
      scmCommand: { mode: "invoke_scm_handoff"; packageId: string; snapshotId: string };
      commandHint: string;
    }
  | {
      executorType: "security";
      securityCommand: { mode: "invoke_security_validation"; snapshotId: string; candidateTaskCount: number };
      commandHint: string;
    }
  | {
      executorType: "unassigned";
      routingCommand: { mode: "defer_until_assigned"; snapshotId: string };
      commandHint: string;
    };

export type ActualLaunchCommand = {
  launchCommandId: string;
  adapterRequestId: string;
  triggerIntentId: string;
  launchContractId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  commandPayload: ActualLaunchCommandPayload;
  createdAtIso: string;
  status: "command_ready";
  source: "actual_launch_command";
  commandType?: string;
  summary?: string;
  note?: string;
};

function nextLaunchCommandId(): string {
  return `actlaunchcmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Executor-specific launch command envelope from a current adapter request (no external I/O). */
export function shapeActualLaunchCommandPayload(adapter: ActualExecutionAdapterRequest): ActualLaunchCommandPayload {
  const p = adapter.payload;
  const snap = adapter.snapshotId;
  switch (p.executorType) {
    case "cursor_executor":
      return {
        executorType: "cursor_executor",
        implementationCommand: {
          mode: "invoke_implementation",
          snapshotId: snap,
          candidateTaskCount: p.implementationPayload.candidateTaskCount,
        },
        commandHint:
          "Final implementation invoke command — execution runtime only; not run from this UI (no Stage1/Stage2).",
      };
    case "reviewer":
      return {
        executorType: "reviewer",
        reviewCommand: {
          mode: "invoke_review",
          snapshotId: snap,
          candidateTaskCount: p.reviewPayload.candidateTaskCount,
        },
        commandHint: "Review invoke command — structured review pass; no build triggered here.",
      };
    case "scm":
      return {
        executorType: "scm",
        scmCommand: {
          mode: "invoke_scm_handoff",
          packageId: p.scmHandoffPayload.packageId,
          snapshotId: snap,
        },
        commandHint: "SCM handoff invoke — branch/merge mechanics deferred to execution layer.",
      };
    case "security":
      return {
        executorType: "security",
        securityCommand: {
          mode: "invoke_security_validation",
          snapshotId: snap,
          candidateTaskCount: p.securityValidationPayload.candidateTaskCount,
        },
        commandHint: "Security validation invoke — actual scans/tools run only after explicit dispatch.",
      };
    case "unassigned":
      return {
        executorType: "unassigned",
        routingCommand: { mode: "defer_until_assigned", snapshotId: p.routingPayload.snapshotId },
        commandHint: "Cannot invoke until executor is assigned — command is a placeholder only.",
      };
    default:
      throw new Error("shapeActualLaunchCommandPayload: unsupported adapter payload");
  }
}

export function actualLaunchCommandPayloadSummary(command: ActualLaunchCommand): string {
  const c = command.commandPayload;
  switch (c.executorType) {
    case "cursor_executor":
      return `Implementation invoke · ${c.implementationCommand.candidateTaskCount} tasks · ${c.implementationCommand.snapshotId}`;
    case "reviewer":
      return `Review invoke · ${c.reviewCommand.candidateTaskCount} tasks · ${c.reviewCommand.snapshotId}`;
    case "scm":
      return `SCM invoke · ${c.scmCommand.packageId} · ${c.scmCommand.snapshotId}`;
    case "security":
      return `Security invoke · ${c.securityCommand.candidateTaskCount} tasks · ${c.securityCommand.snapshotId}`;
    case "unassigned":
      return `Deferred · ${c.routingCommand.snapshotId}`;
    default:
      throw new Error("actualLaunchCommandPayloadSummary: unsupported command payload");
  }
}

export function actualLaunchCommandExecutorHintPreview(command: ActualLaunchCommand): string {
  return truncate(command.commandPayload.commandHint, 120);
}

export function createActualLaunchCommand(input: {
  adapter: ActualExecutionAdapterRequest;
  triggerIntent: ExecutionTriggerIntent;
  contract: ExecutorLaunchContract;
  bridge: ExecutionBridgePayload;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string;
  note?: string;
}): ActualLaunchCommand {
  if (
    !isActualExecutionAdapterRequestCurrent({
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
    throw new Error("createActualLaunchCommand: actual execution adapter request is not current");
  }
  if (input.adapter.sessionId !== input.sessionId) {
    throw new Error("createActualLaunchCommand: adapter session mismatch");
  }
  const commandPayload = shapeActualLaunchCommandPayload(input.adapter);
  return {
    launchCommandId: nextLaunchCommandId(),
    adapterRequestId: input.adapter.adapterRequestId,
    triggerIntentId: input.adapter.triggerIntentId,
    launchContractId: input.adapter.launchContractId,
    executorType: input.adapter.executorType,
    requirementId: input.adapter.requirementId,
    sessionId: input.adapter.sessionId,
    snapshotId: input.adapter.snapshotId,
    commandPayload,
    createdAtIso: new Date().toISOString(),
    status: "command_ready",
    source: "actual_launch_command",
    commandType: "actual_launch_command_v1",
    summary: input.adapter.summary,
    note: input.note,
  };
}

export function isActualLaunchCommandCurrent(input: {
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
  if (!input.command || !input.adapter || !input.triggerIntent || !input.contract || !input.bridge || !input.sessionId) {
    return false;
  }
  if (
    !isActualExecutionAdapterRequestCurrent({
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
    return false;
  }
  return (
    input.command.status === "command_ready" &&
    input.command.source === "actual_launch_command" &&
    input.command.adapterRequestId === input.adapter.adapterRequestId &&
    input.command.triggerIntentId === input.adapter.triggerIntentId &&
    input.command.launchContractId === input.adapter.launchContractId &&
    input.command.sessionId === input.sessionId &&
    input.command.snapshotId === input.adapter.snapshotId &&
    input.command.executorType === input.adapter.executorType &&
    input.command.requirementId === input.adapter.requirementId &&
    input.command.commandPayload.executorType === input.adapter.executorType
  );
}

/**
 * Connector Gateway Facade — registry-based plan/evaluate only (no API calls).
 */

import { validateAgentCapabilityBinding } from "@/lib/agents/agentCapabilityBinding";
import { getAgentById } from "@/lib/agents/agentRegistry";
import { getCapabilityById } from "@/lib/agents/capabilityRegistry";
import type {
  ConnectorInvocationMode,
  ConnectorInvocationRequest,
  ConnectorInvocationResult,
  ConnectorInvocationStatus,
} from "@/lib/agents/connectorGatewayFacadeTypes";
import {
  getConnectorById,
  isConnectorEnabledForExecution,
} from "@/lib/agents/connectorRegistry";

export interface BuildConnectorInvocationInput {
  readonly connectorId: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly operation: string;
  readonly mode?: ConnectorInvocationMode;
  readonly reason?: string;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function resultBase(
  request: ConnectorInvocationRequest,
  status: ConnectorInvocationStatus,
  allowed: boolean,
  reason: string,
  warnings?: readonly string[],
): ConnectorInvocationResult {
  return {
    connectorId: request.connectorId,
    status,
    mode: request.mode,
    operation: request.operation,
    allowed,
    reason,
    ...(request.agentId ? { agentId: request.agentId } : {}),
    ...(request.capabilityId ? { capabilityId: request.capabilityId } : {}),
    ...(warnings?.length ? { warnings } : {}),
    ...(request.metadata ? { metadata: request.metadata } : {}),
  };
}

export function buildConnectorInvocationRequest(
  input: BuildConnectorInvocationInput,
): ConnectorInvocationRequest {
  return {
    connectorId: input.connectorId,
    mode: input.mode ?? "dry_run",
    operation: input.operation,
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function evaluateConnectorInvocation(
  request: ConnectorInvocationRequest,
): ConnectorInvocationResult {
  const warnings: string[] = [];

  if (request.mode === "disabled") {
    return resultBase(request, "skipped", false, "mode:disabled");
  }

  const connector = getConnectorById(request.connectorId);
  if (!connector) {
    return resultBase(request, "blocked", false, `connector_not_found:${request.connectorId}`);
  }

  if (!connector.enabled || !isConnectorEnabledForExecution(request.connectorId)) {
    return resultBase(request, "skipped", false, `connector_disabled:${request.connectorId}`);
  }

  const agentId = request.agentId?.trim();
  if (agentId) {
    const agent = getAgentById(agentId);
    if (!agent) {
      return resultBase(request, "blocked", false, `agent_not_found:${agentId}`, [
        `unknown_agent:${agentId}`,
      ]);
    }
    if (!(agent.allowedConnectors as readonly string[]).includes(request.connectorId)) {
      return resultBase(
        request,
        "blocked",
        false,
        `agent_connector_denied:${agentId}+${request.connectorId}`,
        [`agent ${agentId} does not allow connector ${request.connectorId}`],
      );
    }
  }

  const capabilityId = request.capabilityId?.trim();
  if (capabilityId) {
    const cap = getCapabilityById(capabilityId);
    if (!cap) {
      warnings.push(`unknown_capability:${capabilityId}`);
    } else if (cap.requiredConnectors?.length) {
      if (!(cap.requiredConnectors as readonly string[]).includes(request.connectorId)) {
        return resultBase(
          request,
          "blocked",
          false,
          `capability_connector_mismatch:${capabilityId}+${request.connectorId}`,
          [
            `capability ${capabilityId} requires ${cap.requiredConnectors.join(",")}, not ${request.connectorId}`,
          ],
        );
      }
    }

    if (agentId && !validateAgentCapabilityBinding(agentId, capabilityId)) {
      return resultBase(
        request,
        "blocked",
        false,
        `agent_capability_binding_invalid:${agentId}+${capabilityId}`,
        warnings.length ? warnings : [`binding_invalid:${agentId}+${capabilityId}`],
      );
    }
  }

  if (request.mode === "pass_through") {
    return resultBase(
      request,
      "passed_through",
      true,
      "pass_through:facade_record_only",
      warnings.length ? warnings : undefined,
    );
  }

  return resultBase(request, "planned", true, "dry_run:planned", warnings.length ? warnings : undefined);
}

export function planConnectorInvocation(
  input: BuildConnectorInvocationInput,
): ConnectorInvocationResult {
  return evaluateConnectorInvocation(buildConnectorInvocationRequest(input));
}

export interface PlanNamedConnectorInvocationInput {
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly operation: string;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;
  readonly mode?: ConnectorInvocationMode;
}

function planNamedConnectorInvocation(
  connectorId: string,
  input: PlanNamedConnectorInvocationInput,
): ConnectorInvocationResult {
  return planConnectorInvocation({
    connectorId,
    operation: input.operation,
    agentId: input.agentId,
    capabilityId: input.capabilityId,
    projectId: input.projectId,
    runId: input.runId,
    taskId: input.taskId,
    conversationId: input.conversationId,
    mode: input.mode ?? "dry_run",
  });
}

export function planCursorConnectorInvocation(
  input: PlanNamedConnectorInvocationInput,
): ConnectorInvocationResult {
  return planNamedConnectorInvocation("cursor", input);
}

export function planGithubConnectorInvocation(
  input: PlanNamedConnectorInvocationInput,
): ConnectorInvocationResult {
  return planNamedConnectorInvocation("github", input);
}

export interface BuildConnectorPlanFromAgentMetadataInput {
  readonly connectorId: string;
  readonly operation: string;
  readonly agentRuntimeMetadata?: Readonly<{
    readonly agentId?: string;
    readonly capabilityId?: string;
  }>;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;
}

function connectorPlanFailedResult(
  input: Pick<BuildConnectorPlanFromAgentMetadataInput, "connectorId" | "operation">,
): ConnectorInvocationResult {
  return {
    connectorId: input.connectorId,
    status: "failed",
    mode: "dry_run",
    operation: input.operation,
    allowed: false,
    reason: "connector_plan_build_failed",
  };
}

/** Safe wrapper — never throws; dry-run plan from Stage 2-1 dispatch metadata fields. */
export function buildConnectorPlanFromAgentMetadata(
  input: BuildConnectorPlanFromAgentMetadataInput,
): ConnectorInvocationResult {
  try {
    return planConnectorInvocation({
      connectorId: input.connectorId,
      operation: input.operation,
      agentId: input.agentRuntimeMetadata?.agentId,
      capabilityId: input.agentRuntimeMetadata?.capabilityId,
      projectId: input.projectId,
      runId: input.runId,
      taskId: input.taskId,
      conversationId: input.conversationId,
      mode: "dry_run",
    });
  } catch {
    return connectorPlanFailedResult(input);
  }
}

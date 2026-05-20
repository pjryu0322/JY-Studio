/**
 * Build pass-through record candidates via connector facade (no external calls).
 */

import { planConnectorInvocation } from "@/lib/agents/connectorGatewayFacade";
import { getConnectorPassThroughBoundaryById } from "@/lib/agents/connectorPassThroughBoundaryRegistry";
import {
  CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION,
  type ConnectorPassThroughRecordCandidate,
  type ConnectorPassThroughRecordSource,
} from "@/lib/agents/connectorPassThroughBoundaryTypes";
import { truncateReason } from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

function recordTraceFields(input: {
  readonly source?: ConnectorPassThroughRecordSource;
  readonly createdAt?: string;
}): Pick<ConnectorPassThroughRecordCandidate, "source" | "createdAt"> {
  return {
    source: input.source ?? "diagnostic",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function failedRecord(input: {
  readonly boundaryId: string;
  readonly connectorId: string;
  readonly operation: string;
  readonly reason: string;
  readonly source?: ConnectorPassThroughRecordSource;
  readonly createdAt?: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;
}): ConnectorPassThroughRecordCandidate {
  return {
    schemaVersion: CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION,
    boundaryId: input.boundaryId,
    connectorId: input.connectorId,
    operation: input.operation,
    mode: "pass_through",
    recordOnly: true,
    ...recordTraceFields(input),
    allowed: false,
    facadeStatus: "blocked",
    reason: truncateReason(input.reason),
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
  };
}

/** Safe wrapper — never throws; does not invoke Cursor/GitHub APIs. */
export function buildConnectorPassThroughRecordCandidate(input: {
  readonly boundaryId: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly projectId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly conversationId?: string;
  readonly source?: ConnectorPassThroughRecordSource;
  readonly createdAt?: string;
}): ConnectorPassThroughRecordCandidate {
  try {
    const boundaryId = String(input.boundaryId ?? "").trim();
    const boundary = getConnectorPassThroughBoundaryById(boundaryId);

    if (!boundary) {
      return failedRecord({
        boundaryId,
        connectorId: "unknown",
        operation: "unknown",
        reason: `boundary_not_found:${boundaryId}`,
        agentId: input.agentId,
        capabilityId: input.capabilityId,
        projectId: input.projectId,
        runId: input.runId,
        taskId: input.taskId,
        conversationId: input.conversationId,
        source: input.source,
        createdAt: input.createdAt,
      });
    }

    if (!boundary.enabled) {
      return failedRecord({
        boundaryId: boundary.id,
        connectorId: boundary.connectorId,
        operation: boundary.operation,
        reason: `boundary_disabled:${boundary.id}`,
        source: input.source,
        createdAt: input.createdAt,
        agentId: input.agentId,
        capabilityId: input.capabilityId,
        projectId: input.projectId,
        runId: input.runId,
        taskId: input.taskId,
        conversationId: input.conversationId,
      });
    }

    const facade = planConnectorInvocation({
      connectorId: boundary.connectorId,
      operation: boundary.operation,
      agentId: input.agentId,
      capabilityId: input.capabilityId,
      projectId: input.projectId,
      runId: input.runId,
      taskId: input.taskId,
      conversationId: input.conversationId,
      mode: "pass_through",
    });

    return {
      schemaVersion: CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION,
      boundaryId: boundary.id,
      connectorId: boundary.connectorId,
      operation: boundary.operation,
      mode: "pass_through",
      recordOnly: true,
      ...recordTraceFields(input),
      facadeStatus: facade.status,
      allowed: facade.allowed,
      reason: truncateReason(facade.reason),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      ...(facade.warnings?.length ? { warnings: facade.warnings.slice(0, 10) } : {}),
    };
  } catch {
    return failedRecord({
      boundaryId: String(input.boundaryId ?? ""),
      connectorId: "unknown",
      operation: "unknown",
      reason: "pass_through_record_build_failed",
      source: input.source,
      createdAt: input.createdAt,
    });
  }
}

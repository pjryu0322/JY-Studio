/**
 * Pass-through record ↔ harness / persistence candidate helpers (no storage).
 */

import { buildConnectorPassThroughRecordCandidate } from "@/lib/agents/buildConnectorPassThroughRecordCandidate";
import type { HarnessDryRunResult } from "@/lib/agents/agentHarnessDryRunTypes";
import type { ConnectorPassThroughRecordCandidate } from "@/lib/agents/connectorPassThroughBoundaryTypes";
import type {
  AgentConnectorPassThroughSummary,
  AgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import { truncateReason } from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

const MAX_PASS_THROUGH_RECORDS = 10;

function stringMeta(value: unknown): string | undefined {
  const t = String(value ?? "").trim();
  return t || undefined;
}

export function buildConnectorPassThroughRecordFromHarness(input: {
  readonly boundaryId: string;
  readonly harnessResult: HarnessDryRunResult;
}): ConnectorPassThroughRecordCandidate {
  const meta = input.harnessResult.metadata ?? {};
  return buildConnectorPassThroughRecordCandidate({
    boundaryId: input.boundaryId,
    agentId: input.harnessResult.agentId,
    capabilityId: input.harnessResult.capabilityId,
    projectId: stringMeta(meta.projectId),
    runId: stringMeta(meta.runId),
    taskId: stringMeta(meta.taskId),
    conversationId: stringMeta(meta.conversationId),
  });
}

function toPassThroughSummary(
  record: ConnectorPassThroughRecordCandidate,
): AgentConnectorPassThroughSummary {
  return {
    boundaryId: record.boundaryId,
    connectorId: record.connectorId,
    operation: record.operation,
    allowed: record.allowed ?? false,
    reason: truncateReason(record.reason ?? ""),
  };
}

export function attachPassThroughSummaryToPersistenceCandidate(input: {
  readonly candidate: AgentRuntimePersistenceCandidate;
  readonly records: readonly ConnectorPassThroughRecordCandidate[];
}): AgentRuntimePersistenceCandidate {
  if (!input.records.length) return input.candidate;

  const passThroughRecordSummary = input.records
    .slice(0, MAX_PASS_THROUGH_RECORDS)
    .map(toPassThroughSummary);

  return {
    ...input.candidate,
    passThroughRecordSummary,
  };
}

/**
 * Build read-only diagnostic view model from dry-run artifacts (no dispatch/connector/storage).
 */

import type { HarnessDryRunResult } from "@/lib/agents/agentHarnessDryRunTypes";
import type { AgentRuntimePersistenceCandidate } from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import { validateAgentRuntimePersistenceCandidate } from "@/lib/agents/agentRuntimePersistenceCandidateValidation";
import {
  AGENT_RUNTIME_DIAGNOSTIC_DISCLAIMER,
  AGENT_RUNTIME_DIAGNOSTIC_TITLE,
  type AgentRuntimeDiagnosticViewModel,
  type GovernanceDiagnosticSection,
  type HarnessDiagnosticSection,
  type PassThroughDiagnosticRecordRow,
  type PassThroughDiagnosticSection,
  type PersistenceCandidateDiagnosticSection,
} from "@/lib/agents/agentRuntimeDiagnosticViewTypes";
import type { ConnectorPassThroughRecordCandidate } from "@/lib/agents/connectorPassThroughBoundaryTypes";
import { listConnectorPassThroughBoundaries } from "@/lib/agents/connectorPassThroughBoundaryRegistry";
import {
  evaluateAgentRuntimePersistenceDecision,
  mapPersistenceDecisionToDiagnosticSection,
} from "@/lib/agents/evaluateAgentRuntimePersistenceDecision";

function buildHarnessSection(result: HarnessDryRunResult): HarnessDiagnosticSection {
  return {
    status: result.status,
    executable: result.executable,
    agentId: result.agentId,
    agentType: result.agentType,
    capabilityId: result.capabilityId,
    reason: result.reason,
    requiredConnectors: [...result.requiredConnectors],
  };
}

function buildGovernanceSection(result: HarnessDryRunResult): GovernanceDiagnosticSection | undefined {
  const gov = result.governanceDryRun;
  if (!gov) return undefined;
  return {
    status: gov.status,
    requiredChecks: [...gov.requiredChecks],
    evaluatedPolicyIds: [...gov.evaluatedPolicyIds],
    findingCount: gov.findings.length,
    warningCount: gov.warnings.length,
    blockingCandidateCount: gov.blockingCandidates.length,
  };
}

function buildPersistenceSection(
  candidate: AgentRuntimePersistenceCandidate,
): PersistenceCandidateDiagnosticSection {
  const validation = validateAgentRuntimePersistenceCandidate(candidate);
  let jsonSize = 0;
  try {
    jsonSize = JSON.stringify(candidate).length;
  } catch {
    jsonSize = 0;
  }
  return {
    schemaVersion: candidate.schemaVersion,
    registryVersion: candidate.registryVersion,
    kind: candidate.kind,
    valid: validation.valid,
    validationWarnings: [...validation.warnings],
    jsonSize,
  };
}

function mapPassThroughRecord(record: ConnectorPassThroughRecordCandidate): PassThroughDiagnosticRecordRow {
  return {
    boundaryId: record.boundaryId,
    connectorId: record.connectorId,
    operation: record.operation,
    mode: record.mode,
    recordOnly: record.recordOnly,
    allowed: record.allowed,
    reason: record.reason,
    source: record.source,
    createdAt: record.createdAt,
  };
}

function buildPassThroughSection(
  records: readonly ConnectorPassThroughRecordCandidate[] | undefined,
): PassThroughDiagnosticSection {
  const boundaryCount = listConnectorPassThroughBoundaries().length;
  const rows = (records ?? []).map(mapPassThroughRecord);
  return { boundaryCount, records: rows };
}

function appendUniqueWarnings(target: string[], items: readonly string[]): void {
  for (const item of items) {
    const t = String(item).trim();
    if (t && !target.includes(t)) target.push(t);
  }
}

/** Read-only VM — does not invoke dispatch, connectors, runtime execution, or timeline/replay storage. */
export function buildAgentRuntimeDiagnosticViewModel(input: {
  readonly harnessResult?: HarnessDryRunResult;
  readonly persistenceCandidate?: AgentRuntimePersistenceCandidate;
  readonly passThroughRecords?: readonly ConnectorPassThroughRecordCandidate[];
}): AgentRuntimeDiagnosticViewModel {
  const warnings: string[] = [];

  const harness = input.harnessResult ? buildHarnessSection(input.harnessResult) : undefined;
  const governance = input.harnessResult ? buildGovernanceSection(input.harnessResult) : undefined;

  const persistenceCandidate = input.persistenceCandidate
    ? buildPersistenceSection(input.persistenceCandidate)
    : undefined;

  const persistenceDecision = input.persistenceCandidate
    ? buildPersistenceDecisionSection(input.persistenceCandidate)
    : undefined;

  if (persistenceCandidate && !persistenceCandidate.valid) {
    warnings.push("persistence_candidate_invalid");
  }
  if (persistenceCandidate?.validationWarnings.length) {
    appendUniqueWarnings(warnings, persistenceCandidate.validationWarnings);
  }

  if (input.harnessResult?.warnings.length) {
    appendUniqueWarnings(warnings, input.harnessResult.warnings.slice(0, 20));
  }

  const passThrough = buildPassThroughSection(input.passThroughRecords);

  return {
    mode: "read_only_dry_run",
    title: AGENT_RUNTIME_DIAGNOSTIC_TITLE,
    disclaimer: AGENT_RUNTIME_DIAGNOSTIC_DISCLAIMER,
    ...(harness ? { harness } : {}),
    ...(governance ? { governance } : {}),
    ...(persistenceCandidate ? { persistenceCandidate } : {}),
    ...(persistenceDecision ? { persistenceDecision } : {}),
    passThrough,
    warnings,
  };
}

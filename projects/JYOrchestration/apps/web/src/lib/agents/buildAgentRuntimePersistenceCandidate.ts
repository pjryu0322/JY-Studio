/**
 * Build persistence-ready metadata candidates from harness dry-run (no storage).
 */

import type { HarnessDryRunResult } from "@/lib/agents/agentHarnessDryRunTypes";
import type {
  AgentConnectorPlanSummary,
  AgentGovernanceDryRunPersistenceSummary,
  AgentRuntimePersistenceCandidate,
  AgentRuntimePersistenceCandidateKind,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  AGENT_RUNTIME_REGISTRY_VERSION,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import { truncateReason } from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

const MAX_WARNINGS = 20;
const MAX_BLOCKING_REASONS = 20;
const MAX_CONNECTOR_PLANS = 10;
const MAX_GOVERNANCE_CHECKS = 20;
const MAX_POLICY_IDS = 20;

function stringMeta(value: unknown): string | undefined {
  const t = String(value ?? "").trim();
  return t || undefined;
}

function limitStrings(items: readonly string[] | undefined, max: number): readonly string[] | undefined {
  if (!items?.length) return undefined;
  const sliced = items.slice(0, max).map((s) => truncateReason(String(s)));
  return sliced.length ? sliced : undefined;
}

function summarizeConnectorPlans(
  result: HarnessDryRunResult,
): readonly AgentConnectorPlanSummary[] | undefined {
  if (!result.connectorPlans.length) return undefined;
  return result.connectorPlans.slice(0, MAX_CONNECTOR_PLANS).map((plan) => ({
    connectorId: plan.connectorId,
    status: plan.status,
    mode: plan.mode,
    allowed: plan.allowed,
    reason: truncateReason(plan.reason),
  }));
}

function summarizeGovernance(
  result: HarnessDryRunResult,
): AgentGovernanceDryRunPersistenceSummary | undefined {
  const gov = result.governanceDryRun;
  if (!gov) return undefined;
  return {
    status: gov.status,
    requiredChecks: gov.requiredChecks.slice(0, MAX_GOVERNANCE_CHECKS),
    evaluatedPolicyIds: gov.evaluatedPolicyIds.slice(0, MAX_POLICY_IDS),
    findingCount: gov.findings.length,
    warningCount: gov.warnings.length,
    blockingCandidateCount: gov.blockingCandidates.length,
  };
}

/** Safe wrapper — never throws. */
export function buildAgentRuntimePersistenceCandidateFromHarness(input: {
  readonly result: HarnessDryRunResult;
  readonly kind?: AgentRuntimePersistenceCandidateKind;
  readonly createdAt?: string;
}): AgentRuntimePersistenceCandidate {
  try {
    const meta = input.result.metadata ?? {};
    const createdAt = input.createdAt ?? new Date().toISOString();
    const connectorPlanSummary = summarizeConnectorPlans(input.result);
    const governanceSummary = summarizeGovernance(input.result);
    const warnings = limitStrings(input.result.warnings, MAX_WARNINGS);
    const blockingReasons = limitStrings(input.result.blockingReasons, MAX_BLOCKING_REASONS);

    return {
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      registryVersion: AGENT_RUNTIME_REGISTRY_VERSION,
      kind: input.kind ?? "diagnostic_metadata",
      createdAt,
      ...(stringMeta(meta.source) ? { source: stringMeta(meta.source) } : {}),
      ...(stringMeta(meta.projectId) ? { projectId: stringMeta(meta.projectId) } : {}),
      ...(stringMeta(meta.conversationId) ? { conversationId: stringMeta(meta.conversationId) } : {}),
      ...(stringMeta(meta.runId) ? { runId: stringMeta(meta.runId) } : {}),
      ...(stringMeta(meta.taskId) ? { taskId: stringMeta(meta.taskId) } : {}),
      ...(input.result.agentId ? { agentId: input.result.agentId } : {}),
      ...(input.result.agentType ? { agentType: input.result.agentType } : {}),
      ...(input.result.capabilityId ? { capabilityId: input.result.capabilityId } : {}),
      harnessStatus: input.result.status,
      executable: input.result.executable,
      reason: truncateReason(input.result.reason),
      ...(connectorPlanSummary ? { connectorPlanSummary } : {}),
      ...(governanceSummary ? { governanceSummary } : {}),
      ...(warnings ? { warnings } : {}),
      ...(blockingReasons ? { blockingReasons } : {}),
    };
  } catch {
    return {
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      registryVersion: AGENT_RUNTIME_REGISTRY_VERSION,
      kind: input.kind ?? "diagnostic_metadata",
      harnessStatus: "blocked",
      executable: false,
      reason: "persistence_candidate_build_failed",
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
  }
}

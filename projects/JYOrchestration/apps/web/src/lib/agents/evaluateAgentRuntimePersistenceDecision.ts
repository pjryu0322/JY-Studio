/**
 * Evaluate whether a persistence candidate is ready for Timeline/Replay apply (read-only).
 */

import type {
  AgentRuntimePersistenceCandidate,
  AgentRuntimePersistenceCandidateKind,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  AGENT_RUNTIME_REGISTRY_VERSION,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import type {
  AgentRuntimePersistenceDecision,
  AgentRuntimePersistenceDecisionFinding,
  AgentRuntimePersistenceDecisionReport,
  AgentRuntimePersistenceTarget,
} from "@/lib/agents/agentRuntimePersistenceDecisionTypes";
import type { PersistenceDecisionDiagnosticSection } from "@/lib/agents/agentRuntimeDiagnosticViewTypes";
import {
  MAX_CANDIDATE_JSON_LENGTH,
  validateAgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

function finding(
  severity: AgentRuntimePersistenceDecisionFinding["severity"],
  code: string,
  message: string,
): AgentRuntimePersistenceDecisionFinding {
  return { severity, code, message };
}

function buildRecommendedTargets(
  candidate: AgentRuntimePersistenceCandidate,
): AgentRuntimePersistenceTarget[] {
  const targets: AgentRuntimePersistenceTarget[] = [];

  if (
    candidate.kind === "timeline_metadata" &&
    candidate.agentId &&
    candidate.capabilityId
  ) {
    targets.push("timeline_metadata");
  }

  if (candidate.governanceSummary || candidate.passThroughRecordSummary?.length) {
    targets.push("diagnostic_log");
  }

  if (candidate.kind === "diagnostic_metadata" && !targets.includes("diagnostic_log")) {
    targets.push("diagnostic_log");
  }

  return targets;
}

function collectValidationFindings(
  warnings: readonly string[],
): AgentRuntimePersistenceDecisionFinding[] {
  const out: AgentRuntimePersistenceDecisionFinding[] = [];
  for (const w of warnings) {
    if (w.startsWith("forbidden_key_detected:")) {
      out.push(finding("blocking", "forbidden_key", w));
    } else if (w === "candidate_json_exceeds_limit") {
      out.push(finding("warning", "candidate_json_exceeds_limit", "JSON size exceeds limit"));
    } else {
      out.push(finding("warning", w, `validation: ${w}`));
    }
  }
  return out;
}

function isOnlyJsonSizeIssue(
  candidateValid: boolean,
  warnings: readonly string[],
  blockingCount: number,
): boolean {
  return (
    !candidateValid &&
    warnings.length > 0 &&
    warnings.every((w) => w === "candidate_json_exceeds_limit") &&
    blockingCount === 0
  );
}

function resolvePersistenceDecision(input: {
  readonly blockingCount: number;
  readonly candidateValid: boolean;
  readonly onlySizeIssue: boolean;
  readonly kind: AgentRuntimePersistenceCandidateKind;
}): AgentRuntimePersistenceDecision {
  if (input.blockingCount > 0) return "blocked";
  if (!input.candidateValid && input.onlySizeIssue) return "defer";
  if (!input.candidateValid) return "blocked";
  if (input.kind === "replay_snapshot") return "defer";
  if (input.kind === "timeline_metadata" || input.kind === "diagnostic_metadata") {
    return "ready_for_design";
  }
  return "defer";
}

function appendDecisionInfoFindings(
  findings: AgentRuntimePersistenceDecisionFinding[],
  decision: AgentRuntimePersistenceDecision,
  kind: AgentRuntimePersistenceCandidateKind,
  onlySizeIssue: boolean,
): void {
  if (onlySizeIssue) {
    findings.push(
      finding(
        "info",
        "defer_json_size",
        "candidate exceeds size limit; defer until trim or schema split",
      ),
    );
    return;
  }

  if (decision === "defer" && kind === "replay_snapshot") {
    findings.push(
      finding(
        "info",
        "defer_replay_snapshot",
        "replay_snapshot affects storage structure; defer actual apply",
      ),
    );
    return;
  }

  if (decision === "ready_for_design" && kind === "timeline_metadata") {
    findings.push(
      finding(
        "info",
        "ready_timeline_metadata",
        "valid timeline_metadata candidate; design apply path before wire",
      ),
    );
    return;
  }

  if (decision === "ready_for_design" && kind === "diagnostic_metadata") {
    findings.push(
      finding(
        "info",
        "ready_diagnostic_metadata",
        "valid diagnostic_metadata candidate; prefer diagnostic_log target",
      ),
    );
    return;
  }

  if (decision === "defer") {
    findings.push(finding("warning", "unknown_kind_path", "no apply path selected yet"));
  }
}

/** Maps decision report to diagnostic VM section (no storage calls). */
export function mapPersistenceDecisionToDiagnosticSection(
  report: AgentRuntimePersistenceDecisionReport,
): PersistenceDecisionDiagnosticSection {
  return {
    decision: report.decision,
    recommendedTargets: [...report.recommendedTargets],
    requiresSchemaChange: report.requiresSchemaChange,
    requiresMigration: report.requiresMigration,
    findingCount: report.findings.length,
    blockingFindingCount: report.findings.filter((f) => f.severity === "blocking").length,
  };
}

/** Read-only decision report — does not persist or call Timeline/Replay storage. */
export function evaluateAgentRuntimePersistenceDecision(input: {
  readonly candidate: AgentRuntimePersistenceCandidate;
}): AgentRuntimePersistenceDecisionReport {
  const findings: AgentRuntimePersistenceDecisionFinding[] = [];
  const candidate = input.candidate;

  if (candidate.schemaVersion !== AGENT_RUNTIME_METADATA_SCHEMA_VERSION) {
    findings.push(
      finding("blocking", "invalid_schema_version", "schemaVersion is missing or invalid"),
    );
  }

  if (candidate.registryVersion !== AGENT_RUNTIME_REGISTRY_VERSION) {
    findings.push(
      finding("blocking", "invalid_registry_version", "registryVersion is missing or invalid"),
    );
  }

  const validation = validateAgentRuntimePersistenceCandidate(candidate);
  const candidateValid = validation.valid;

  if (!candidateValid) {
    findings.push(...collectValidationFindings(validation.warnings));
  }

  let jsonSize = 0;
  try {
    jsonSize = JSON.stringify(candidate).length;
  } catch {
    findings.push(finding("blocking", "candidate_not_serializable", "candidate cannot be serialized"));
  }

  if (jsonSize > MAX_CANDIDATE_JSON_LENGTH) {
    if (!findings.some((f) => f.code === "candidate_json_exceeds_limit")) {
      findings.push(
        finding("warning", "candidate_json_exceeds_limit", "JSON size exceeds limit"),
      );
    }
  }

  const blockingCount = findings.filter((f) => f.severity === "blocking").length;
  const onlySizeIssue = isOnlyJsonSizeIssue(candidateValid, validation.warnings, blockingCount);
  const decision = resolvePersistenceDecision({
    blockingCount,
    candidateValid,
    onlySizeIssue,
    kind: candidate.kind,
  });

  appendDecisionInfoFindings(findings, decision, candidate.kind, onlySizeIssue);

  const recommendedTargets = buildRecommendedTargets(candidate);

  if (candidate.kind === "replay_snapshot" && !recommendedTargets.includes("replay_snapshot")) {
    findings.push(
      finding(
        "info",
        "replay_snapshot_target",
        "replay_snapshot is a future target; not recommended for immediate apply",
      ),
    );
  }

  return {
    mode: "read_only_decision",
    decision,
    recommendedTargets,
    requiresSchemaChange: true,
    requiresMigration: true,
    findings,
    candidateValid,
  };
}

/**
 * Evaluate Timeline/Replay persist apply design from persistence candidate (read-only).
 */

import type { AgentRuntimePersistenceCandidate } from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  AGENT_RUNTIME_REGISTRY_VERSION,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import type {
  TimelineReplayPersistDesignDecision,
  TimelineReplayPersistDesignFinding,
  TimelineReplayPersistDesignReport,
  TimelineReplayPersistFieldDecision,
  TimelineReplayPersistFieldSensitivity,
  TimelineReplayPersistTarget,
} from "@/lib/agents/timelineReplayPersistDesignTypes";
import {
  isForbiddenPersistenceKey,
  validateAgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

const PERSIST_FIELD_SPECS: readonly {
  readonly field: string;
  readonly sensitivity: TimelineReplayPersistFieldSensitivity;
  readonly reason: string;
}[] = [
  { field: "schemaVersion", sensitivity: "safe", reason: "schema version for migration tracking" },
  { field: "registryVersion", sensitivity: "safe", reason: "agent registry version for replay compatibility" },
  { field: "kind", sensitivity: "safe", reason: "persistence candidate kind" },
  { field: "source", sensitivity: "internal", reason: "dry-run source trace" },
  { field: "projectId", sensitivity: "internal", reason: "project scope key" },
  { field: "conversationId", sensitivity: "internal", reason: "conversation scope key" },
  { field: "runId", sensitivity: "internal", reason: "run scope key" },
  { field: "taskId", sensitivity: "internal", reason: "task scope key" },
  { field: "agentId", sensitivity: "internal", reason: "dispatch agent identity" },
  { field: "agentType", sensitivity: "internal", reason: "agent type for diagnostics" },
  { field: "capabilityId", sensitivity: "internal", reason: "capability binding trace" },
  { field: "harnessStatus", sensitivity: "internal", reason: "harness dry-run status" },
  { field: "executable", sensitivity: "internal", reason: "harness executable flag" },
  { field: "reason", sensitivity: "internal", reason: "truncated harness reason" },
  { field: "connectorPlanSummary", sensitivity: "internal", reason: "connector plan summary only" },
  { field: "governanceSummary", sensitivity: "internal", reason: "governance dry-run summary only" },
  { field: "passThroughRecordSummary", sensitivity: "internal", reason: "pass-through record summary only" },
  { field: "warnings", sensitivity: "internal", reason: "bounded warning list" },
  { field: "blockingReasons", sensitivity: "internal", reason: "bounded blocking reason list" },
  { field: "createdAt", sensitivity: "safe", reason: "candidate creation timestamp" },
] as const;

const POLICY_EXCLUDED_FIELDS: readonly TimelineReplayPersistFieldDecision[] = [
  { field: "rawPrompt", persist: false, reason: "policy: raw prompt excluded", sensitivity: "forbidden" },
  { field: "promptText", persist: false, reason: "policy: prompt text excluded", sensitivity: "forbidden" },
  { field: "codeDiff", persist: false, reason: "policy: code diff excluded", sensitivity: "forbidden" },
  { field: "fileContent", persist: false, reason: "policy: file content excluded", sensitivity: "forbidden" },
  { field: "token", persist: false, reason: "policy: token excluded", sensitivity: "forbidden" },
  { field: "secret", persist: false, reason: "policy: secret excluded", sensitivity: "forbidden" },
  { field: "password", persist: false, reason: "policy: password excluded", sensitivity: "forbidden" },
  { field: "authorization", persist: false, reason: "policy: authorization excluded", sensitivity: "forbidden" },
  { field: "apiKey", persist: false, reason: "policy: api key excluded", sensitivity: "forbidden" },
  { field: "privateKey", persist: false, reason: "policy: private key excluded", sensitivity: "forbidden" },
  { field: "env", persist: false, reason: "policy: env vars excluded", sensitivity: "forbidden" },
];

function finding(
  severity: TimelineReplayPersistDesignFinding["severity"],
  code: string,
  message: string,
): TimelineReplayPersistDesignFinding {
  return { severity, code, message };
}

function inferPersistTarget(
  candidate: AgentRuntimePersistenceCandidate,
  explicit?: TimelineReplayPersistTarget,
): TimelineReplayPersistTarget {
  if (explicit) return explicit;
  switch (candidate.kind) {
    case "timeline_metadata":
      return "timeline_metadata";
    case "replay_snapshot":
      return "replay_snapshot";
    case "diagnostic_metadata":
      return "diagnostic_log";
    default:
      return "timeline_metadata";
  }
}

function candidateHasField(
  candidate: AgentRuntimePersistenceCandidate,
  field: string,
): boolean {
  const value = (candidate as Record<string, unknown>)[field];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function buildPersistFields(candidate: AgentRuntimePersistenceCandidate): TimelineReplayPersistFieldDecision[] {
  const out: TimelineReplayPersistFieldDecision[] = [];
  for (const spec of PERSIST_FIELD_SPECS) {
    const key = String(spec.field);
    if (!candidateHasField(candidate, key)) continue;
    out.push({
      field: key,
      persist: true,
      reason: spec.reason,
      sensitivity: spec.sensitivity,
    });
  }
  return out;
}

function collectCandidateForbiddenFields(
  candidate: AgentRuntimePersistenceCandidate,
): TimelineReplayPersistFieldDecision[] {
  const out: TimelineReplayPersistFieldDecision[] = [];
  const walk = (value: unknown, prefix: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${prefix}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (isForbiddenPersistenceKey(key)) {
          out.push({
            field: path,
            persist: false,
            reason: `detected forbidden key: ${key}`,
            sensitivity: "forbidden",
          });
        }
        walk(child, path);
      }
    }
  };
  walk(candidate, "");
  return out;
}

function resolveDesignDecision(input: {
  readonly candidateValid: boolean;
  readonly blockingCount: number;
  readonly target: TimelineReplayPersistTarget;
}): TimelineReplayPersistDesignDecision {
  if (input.blockingCount > 0 || !input.candidateValid) return "blocked";
  if (input.target === "replay_snapshot") return "defer";
  if (input.target === "timeline_metadata" || input.target === "diagnostic_log") {
    return "ready_for_schema_design";
  }
  return "defer";
}

/** Read-only persist design — does not call Timeline/Replay storage or DB APIs. */
export function evaluateTimelineReplayPersistDesign(input: {
  readonly candidate: AgentRuntimePersistenceCandidate;
  readonly target?: TimelineReplayPersistTarget;
}): TimelineReplayPersistDesignReport {
  const findings: TimelineReplayPersistDesignFinding[] = [];
  const candidate = input.candidate;
  const target = inferPersistTarget(candidate, input.target);

  if (candidate.schemaVersion !== AGENT_RUNTIME_METADATA_SCHEMA_VERSION) {
    findings.push(finding("blocking", "invalid_schema_version", "schemaVersion is missing or invalid"));
  }
  if (candidate.registryVersion !== AGENT_RUNTIME_REGISTRY_VERSION) {
    findings.push(finding("blocking", "invalid_registry_version", "registryVersion is missing or invalid"));
  }

  const validation = validateAgentRuntimePersistenceCandidate(candidate);
  const candidateValid = validation.valid;

  if (!candidateValid) {
    for (const w of validation.warnings) {
      findings.push(
        finding(
          w.startsWith("forbidden_key_detected:") ? "blocking" : "warning",
          w,
          `validation: ${w}`,
        ),
      );
    }
  }

  const persistFields = buildPersistFields(candidate);
  const detectedForbidden = collectCandidateForbiddenFields(candidate);
  const excludedFields = [...POLICY_EXCLUDED_FIELDS, ...detectedForbidden];

  const blockingCount = findings.filter((f) => f.severity === "blocking").length;
  const decision = resolveDesignDecision({ candidateValid, blockingCount, target });

  if (target === "replay_snapshot") {
    findings.push(
      finding(
        "info",
        "defer_replay_snapshot",
        "replay snapshot has volume/sensitivity risk; defer until schema split",
      ),
    );
  } else if (decision === "ready_for_schema_design") {
    findings.push(
      finding(
        "info",
        "ready_for_schema_design",
        `${target} candidate is valid for schema design review`,
      ),
    );
  }

  return {
    mode: "read_only_persist_design",
    decision,
    target,
    requiresSchemaChange: true,
    requiresMigration: true,
    requiresRollbackPlan: true,
    persistFields,
    excludedFields,
    findings,
  };
}

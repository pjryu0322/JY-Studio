/**
 * Sanitize and validate persistence candidates (no storage).
 */

import type { AgentRuntimePersistenceCandidate } from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";

export const MAX_REASON_LENGTH = 240;

const FORBIDDEN_KEYS = [
  "token",
  "secret",
  "password",
  "authorization",
  "apiKey",
  "privateKey",
  "rawPrompt",
  "promptText",
  "codeDiff",
  "fileContent",
  "env",
] as const;

function isForbiddenKey(key: string): boolean {
  const norm = key.trim().toLowerCase();
  return FORBIDDEN_KEYS.some((f) => f.toLowerCase() === norm);
}

const ALLOWED_KINDS = new Set(["timeline_metadata", "replay_snapshot", "diagnostic_metadata"]);

const MAX_WARNINGS = 20;
const MAX_BLOCKING_REASONS = 20;
const MAX_CONNECTOR_PLANS = 10;
const MAX_GOVERNANCE_CHECKS = 20;
const MAX_POLICY_IDS = 20;

export function truncateReason(value: string): string {
  const t = String(value ?? "").trim();
  if (t.length <= MAX_REASON_LENGTH) return t;
  return `${t.slice(0, MAX_REASON_LENGTH - 3)}...`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectObjectKeys(value: unknown, keys: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, keys);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectObjectKeys(child, keys);
  }
}

function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenKey(key)) continue;
    out[key] = stripForbiddenKeys(child);
  }
  return out;
}

export function sanitizeAgentRuntimePersistenceCandidate(
  candidate: AgentRuntimePersistenceCandidate,
): AgentRuntimePersistenceCandidate {
  try {
    const stripped = stripForbiddenKeys(candidate) as AgentRuntimePersistenceCandidate;
    return {
      ...stripped,
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      ...(stripped.reason ? { reason: truncateReason(stripped.reason) } : {}),
      ...(stripped.connectorPlanSummary ?
        {
          connectorPlanSummary: stripped.connectorPlanSummary
            .slice(0, MAX_CONNECTOR_PLANS)
            .map((p) => ({ ...p, reason: truncateReason(p.reason) })),
        }
      : {}),
      ...(stripped.warnings ?
        { warnings: stripped.warnings.slice(0, MAX_WARNINGS).map(truncateReason) }
      : {}),
      ...(stripped.blockingReasons ?
        {
          blockingReasons: stripped.blockingReasons
            .slice(0, MAX_BLOCKING_REASONS)
            .map(truncateReason),
        }
      : {}),
      ...(stripped.governanceSummary ?
        {
          governanceSummary: {
            ...stripped.governanceSummary,
            requiredChecks: stripped.governanceSummary.requiredChecks.slice(
              0,
              MAX_GOVERNANCE_CHECKS,
            ),
            evaluatedPolicyIds: stripped.governanceSummary.evaluatedPolicyIds.slice(
              0,
              MAX_POLICY_IDS,
            ),
          },
        }
      : {}),
    };
  } catch {
    return {
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      registryVersion: candidate.registryVersion,
      kind: candidate.kind,
      harnessStatus: "blocked",
      executable: false,
      reason: "sanitize_failed",
    };
  }
}

export function validateAgentRuntimePersistenceCandidate(
  candidate: AgentRuntimePersistenceCandidate,
): { readonly valid: boolean; readonly warnings: readonly string[] } {
  const warnings: string[] = [];

  try {
    if (candidate.schemaVersion !== AGENT_RUNTIME_METADATA_SCHEMA_VERSION) {
      return { valid: false, warnings: ["invalid_schema_version"] };
    }

    if (!ALLOWED_KINDS.has(candidate.kind)) {
      return { valid: false, warnings: ["invalid_kind"] };
    }

    if (candidate.agentId !== undefined && typeof candidate.agentId !== "string") {
      warnings.push("invalid_agent_id_type");
    }
    if (candidate.capabilityId !== undefined && typeof candidate.capabilityId !== "string") {
      warnings.push("invalid_capability_id_type");
    }

    if ((candidate.warnings?.length ?? 0) > MAX_WARNINGS) {
      warnings.push("warnings_exceed_limit");
    }
    if ((candidate.blockingReasons?.length ?? 0) > MAX_BLOCKING_REASONS) {
      warnings.push("blocking_reasons_exceed_limit");
    }
    if ((candidate.connectorPlanSummary?.length ?? 0) > MAX_CONNECTOR_PLANS) {
      warnings.push("connector_plans_exceed_limit");
    }

    JSON.stringify(candidate);

    const keys: string[] = [];
    collectObjectKeys(candidate, keys);
    for (const key of keys) {
      if (isForbiddenKey(key)) warnings.push(`forbidden_key_detected:${key}`);
    }

    if (candidate.reason && candidate.reason.length > MAX_REASON_LENGTH) {
      warnings.push("reason_exceeds_limit");
    }

    return { valid: warnings.length === 0, warnings };
  } catch {
    return { valid: false, warnings: ["validation_failed"] };
  }
}

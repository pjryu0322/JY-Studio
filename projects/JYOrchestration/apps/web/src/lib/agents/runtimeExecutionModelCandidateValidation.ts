/**
 * Stage 6-B runtime execution model candidate validation (read-only).
 */

import {
  REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS,
  RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS,
} from "@/lib/agents/runtimeExecutionModelCandidateConstants";
import type {
  RuntimeExecutionModelCandidate,
  RuntimeExecutionModelCandidateValidationResult,
} from "@/lib/agents/runtimeExecutionModelCandidateTypes";

const REQUIRED_KIND_SET = new Set<string>(REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS);
const FORBIDDEN_FIELD_SET = new Set<string>(RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS);

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateRuntimeExecutionModelCandidates(
  candidates: readonly RuntimeExecutionModelCandidate[],
): RuntimeExecutionModelCandidateValidationResult {
  const presentKinds = candidates.map((c) => c.kind);
  const kindCounts = new Map<string, number>();
  for (const kind of presentKinds) {
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
  }

  const missingKinds = REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS.filter((k) => !kindCounts.has(k));
  const unknownKinds = [...new Set(presentKinds.filter((k) => !REQUIRED_KIND_SET.has(k)))].sort((a, b) =>
    a.localeCompare(b),
  );
  const duplicateKinds = [...kindCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([kind]) => kind)
    .sort((a, b) => a.localeCompare(b));

  const emptyPurposeKinds = candidates.filter((c) => isBlank(c.purpose)).map((c) => c.kind);
  const emptyModelNameKinds = candidates.filter((c) => isBlank(c.modelName)).map((c) => c.kind);
  const emptyProposedFieldKinds = candidates.filter((c) => c.proposedFields.length === 0).map((c) => c.kind);
  const forbiddenFieldKinds = candidates
    .filter((c) => c.proposedFields.some((field) => FORBIDDEN_FIELD_SET.has(field)))
    .map((c) => c.kind);

  const invalidPersistenceKinds = candidates.filter((c) => c.persistenceCandidateOnly !== true).map((c) => c.kind);

  const candidatePostureValid =
    missingKinds.length === 0 &&
    unknownKinds.length === 0 &&
    duplicateKinds.length === 0 &&
    emptyPurposeKinds.length === 0 &&
    emptyModelNameKinds.length === 0 &&
    emptyProposedFieldKinds.length === 0 &&
    forbiddenFieldKinds.length === 0 &&
    invalidPersistenceKinds.length === 0;

  return {
    hasRequiredModelKinds: missingKinds.length === 0,
    candidatePostureValid,
    missingKinds,
    unknownKinds,
    duplicateKinds,
    emptyPurposeKinds,
    emptyModelNameKinds,
    emptyProposedFieldKinds,
    forbiddenFieldKinds,
  };
}

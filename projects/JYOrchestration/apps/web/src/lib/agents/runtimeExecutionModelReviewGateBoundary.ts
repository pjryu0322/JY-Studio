/**
 * Stage 6-C review gate boundary and model trace helpers (read-only).
 */

import {
  REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS,
  RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS,
} from "@/lib/agents/runtimeExecutionModelCandidateConstants";
import type { RuntimeExecutionModelCandidateReport } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";

const FORBIDDEN_FIELD_SET = new Set<string>(RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS);

export function collectForbiddenFieldTraceInModelCandidates(
  source: Pick<RuntimeExecutionModelCandidateReport, "modelCandidates">,
): {
  readonly detected: boolean;
  readonly modelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly fieldNames: readonly string[];
} {
  const modelKinds = new Set<RuntimeExecutionModelCandidateKind>();
  const fieldNames = new Set<string>();

  for (const candidate of source.modelCandidates) {
    for (const field of candidate.proposedFields) {
      if (FORBIDDEN_FIELD_SET.has(field)) {
        modelKinds.add(candidate.kind);
        fieldNames.add(field);
      }
    }
  }

  return {
    detected: modelKinds.size > 0,
    modelKinds: [...modelKinds].sort((a, b) => a.localeCompare(b)),
    fieldNames: [...fieldNames].sort((a, b) => a.localeCompare(b)),
  };
}

export function detectForbiddenFieldsInModelCandidates(
  source: Pick<RuntimeExecutionModelCandidateReport, "modelCandidates">,
): boolean {
  return collectForbiddenFieldTraceInModelCandidates(source).detected;
}

export function computeNoRunBoundarySatisfied(
  source: Pick<
    RuntimeExecutionModelCandidateReport,
    "actualExecutionWireAllowedInThisStep" | "actualExternalSideEffectAllowedInThisStep" | "candidateOnly"
  >,
): boolean {
  return (
    source.candidateOnly === true &&
    source.actualExecutionWireAllowedInThisStep === false &&
    source.actualExternalSideEffectAllowedInThisStep === false
  );
}

export function computePersistenceBoundarySatisfied(
  source: Pick<RuntimeExecutionModelCandidateReport, "actualPersistenceAllowedInThisStep" | "modelCandidates">,
): boolean {
  return (
    source.actualPersistenceAllowedInThisStep === false &&
    source.modelCandidates.every((c) => c.persistenceCandidateOnly === true)
  );
}

export function computeReviewedModelTrace(source: Pick<RuntimeExecutionModelCandidateReport, "modelCandidates">): {
  readonly reviewedModelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly reviewedModelCount: number;
  readonly reviewedFieldCount: number;
} {
  const present = new Set(source.modelCandidates.map((c) => c.kind));
  const reviewedModelKinds = REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS.filter((kind) => present.has(kind));
  const reviewedFieldCount = source.modelCandidates.reduce((sum, c) => sum + c.proposedFields.length, 0);
  return {
    reviewedModelKinds,
    reviewedModelCount: reviewedModelKinds.length,
    reviewedFieldCount,
  };
}

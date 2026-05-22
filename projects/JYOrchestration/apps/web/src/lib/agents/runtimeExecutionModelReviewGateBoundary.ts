/**
 * Stage 6-C review gate boundary and model trace helpers (read-only).
 */

import { RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS } from "@/lib/agents/runtimeExecutionModelCandidateConstants";
import type { RuntimeExecutionModelCandidateReport } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";

const FORBIDDEN_FIELD_SET = new Set<string>(RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS);

export function detectForbiddenFieldsInModelCandidates(
  source: Pick<RuntimeExecutionModelCandidateReport, "modelCandidates">,
): boolean {
  return source.modelCandidates.some((candidate) =>
    candidate.proposedFields.some((field) => FORBIDDEN_FIELD_SET.has(field)),
  );
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
  const reviewedModelKinds = source.modelCandidates.map((c) => c.kind);
  const reviewedFieldCount = source.modelCandidates.reduce((sum, c) => sum + c.proposedFields.length, 0);
  return {
    reviewedModelKinds,
    reviewedModelCount: reviewedModelKinds.length,
    reviewedFieldCount,
  };
}

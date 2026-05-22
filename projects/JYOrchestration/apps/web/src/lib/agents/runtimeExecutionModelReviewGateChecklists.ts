/**
 * Stage 6-C review gate checklist builders (read-only).
 */

import { REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS } from "@/lib/agents/runtimeExecutionModelCandidateConstants";
import type { RuntimeExecutionModelCandidateReport } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import { RUNTIME_EXECUTION_MODEL_KIND_TO_REVIEW_AREA } from "@/lib/agents/runtimeExecutionModelReviewGateConstants";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type {
  ParsedRuntimeExecutionModelReviewGateInput,
  RuntimeExecutionModelReviewArea,
  RuntimeExecutionModelReviewGateChecklistItem,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionModelReviewArea;
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionModelReviewGateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeExecutionModelReviewGateChecklists(input: {
  readonly source: RuntimeExecutionModelCandidateReport;
  readonly parsed: ParsedRuntimeExecutionModelReviewGateInput;
  readonly reviewedModelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly forbiddenFieldDetected: boolean;
  readonly noRunBoundarySatisfied: boolean;
  readonly persistenceBoundarySatisfied: boolean;
}): {
  readonly reviewChecklist: readonly RuntimeExecutionModelReviewGateChecklistItem[];
  readonly noRunChecklist: readonly RuntimeExecutionModelReviewGateChecklistItem[];
  readonly persistenceChecklist: readonly RuntimeExecutionModelReviewGateChecklistItem[];
} {
  const sevenKindsPresent = REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS.every((k) =>
    input.reviewedModelKinds.includes(k),
  );

  const modelReviewEntries: ChecklistEntry[] = REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS.map((kind) => {
    const reviewed = input.source.modelCandidates.some((c) => c.kind === kind);
    return {
      item: `${kind} reviewed`,
      area: RUNTIME_EXECUTION_MODEL_KIND_TO_REVIEW_AREA[kind],
      satisfied: reviewed,
      detail: `${kind} present=${reviewed}`,
    };
  });

  const reviewChecklist = mapChecklist([
    {
      item: "model candidate decision ready",
      area: "execution_boundary",
      satisfied: input.source.decision === "ready_for_runtime_execution_model_review",
      detail: `sourceModelCandidateDecision=${input.source.decision}`,
    },
    {
      item: "7 model kinds reviewed",
      area: "execution_boundary",
      satisfied: sevenKindsPresent && input.reviewedModelKinds.length === 7,
      detail: `reviewedModelCount=${input.reviewedModelKinds.length}`,
    },
    ...modelReviewEntries,
    {
      item: "field contract reviewed",
      area: "request_model",
      satisfied: input.parsed.runtimeModelFieldContractReviewed,
      detail: `runtimeModelFieldContractReviewed=${input.parsed.runtimeModelFieldContractReviewed}`,
    },
    {
      item: "approval boundary reviewed",
      area: "approval_state_model",
      satisfied: input.parsed.runtimeModelApprovalBoundaryReviewed,
      detail: `runtimeModelApprovalBoundaryReviewed=${input.parsed.runtimeModelApprovalBoundaryReviewed}`,
    },
  ]);

  const noRunChecklist = mapChecklist([
    {
      item: "actualRuntimeExecutionAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "actualExecutionWireAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: input.source.actualExecutionWireAllowedInThisStep === false,
      detail: `actualExecutionWireAllowedInThisStep=${input.source.actualExecutionWireAllowedInThisStep}`,
    },
    {
      item: "actualExternalSideEffectAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: input.source.actualExternalSideEffectAllowedInThisStep === false,
      detail: `actualExternalSideEffectAllowedInThisStep=${input.source.actualExternalSideEffectAllowedInThisStep}`,
    },
    {
      item: "noRunBoundarySatisfied",
      area: "no_run_boundary",
      satisfied: input.noRunBoundarySatisfied,
      detail: `noRunBoundarySatisfied=${input.noRunBoundarySatisfied}`,
    },
  ]);

  const persistenceChecklist = mapChecklist([
    {
      item: "actualPersistenceAllowedInThisStep=false",
      area: "persistence_boundary",
      satisfied: input.source.actualPersistenceAllowedInThisStep === false,
      detail: `actualPersistenceAllowedInThisStep=${input.source.actualPersistenceAllowedInThisStep}`,
    },
    {
      item: "actualSchemaMigrationAllowedInThisStep=false",
      area: "persistence_boundary",
      satisfied: true,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "schema.prisma/migration is separated work",
      area: "persistence_boundary",
      satisfied: true,
      detail: "schemaMigrationBoundarySatisfied=true",
    },
    {
      item: "persistenceCandidateOnly=true maintained",
      area: "persistence_boundary",
      satisfied: input.persistenceBoundarySatisfied && !input.forbiddenFieldDetected,
      detail: `persistenceBoundarySatisfied=${input.persistenceBoundarySatisfied}`,
    },
  ]);

  return { reviewChecklist, noRunChecklist, persistenceChecklist };
}

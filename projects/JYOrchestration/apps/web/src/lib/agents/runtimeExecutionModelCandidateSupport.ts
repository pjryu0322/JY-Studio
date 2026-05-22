/**
 * Stage 6-B runtime execution model candidate support (read-only).
 */

import type {
  RuntimeExecutionModelCandidate,
  RuntimeExecutionModelCandidateChecklistItem,
  RuntimeExecutionModelCandidateDecision,
  RuntimeExecutionModelCandidateDecisionInput,
  RuntimeExecutionModelCandidateFinding,
  RuntimeExecutionModelCandidateInput,
  RuntimeExecutionModelCandidateKind,
} from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import { RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS } from "@/lib/agents/runtimeExecutionModelCandidateConstants";

export { validateRuntimeExecutionModelCandidates } from "@/lib/agents/runtimeExecutionModelCandidateValidation";

export {
  MODEL_CANDIDATE_TITLE,
  MODEL_CANDIDATE_VERSION,
  REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS,
  STAGE6_B_RECOMMENDED_NEXT_PHASES,
  STAGE6_B_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelCandidateConstants";

/** Default draft model candidates (report-only; not schema.prisma). */
export function buildDefaultRuntimeExecutionModelCandidates(): readonly RuntimeExecutionModelCandidate[] {
  return [
    {
      kind: "RuntimeExecutionRequest",
      modelName: "RuntimeExecutionRequest",
      purpose: "Capture who requested runtime execution and the execution goal",
      proposedFields: ["id", "projectId", "requestedBy", "executionGoal", "createdAt"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
    {
      kind: "RuntimeExecutionPlan",
      modelName: "RuntimeExecutionPlan",
      purpose: "Ordered plan of execution steps with approval and rollback references",
      proposedFields: ["id", "requestId", "steps", "approvalState", "rollbackPlan"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
    {
      kind: "RuntimeExecutionStep",
      modelName: "RuntimeExecutionStep",
      purpose: "Single step in a runtime execution plan with unit kind and status",
      proposedFields: ["id", "planId", "sequence", "unitKind", "status"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
    {
      kind: "RuntimeExecutionResult",
      modelName: "RuntimeExecutionResult",
      purpose: "Aggregate outcome of a runtime execution request",
      proposedFields: ["id", "requestId", "status", "summary", "findings"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
    {
      kind: "RuntimeExecutionFinding",
      modelName: "RuntimeExecutionFinding",
      purpose: "Structured finding emitted during runtime execution review",
      proposedFields: ["id", "requestId", "severity", "code", "message"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
    {
      kind: "RuntimeExecutionApprovalState",
      modelName: "RuntimeExecutionApprovalState",
      purpose: "Operator approval state for a runtime execution request",
      proposedFields: ["id", "requestId", "approvalStatus", "approvedBy", "approvedAt"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
    {
      kind: "RuntimeExecutionRollbackPlan",
      modelName: "RuntimeExecutionRollbackPlan",
      purpose: "Rollback plan candidate linked to a runtime execution request",
      proposedFields: ["id", "requestId", "rollbackSteps", "rollbackRequired"],
      forbiddenFields: [...RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS],
      persistenceCandidateOnly: true,
    },
  ];
}

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RuntimeExecutionModelCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionModelCandidateFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionModelCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseRuntimeExecutionModelCandidateInput(input?: RuntimeExecutionModelCandidateInput): {
  readonly runtimeModelReviewConfirmed: boolean;
  readonly runtimeModelNoExecutionWireConfirmed: boolean;
  readonly runtimeModelNoPersistenceConfirmed: boolean;
  readonly confirmationsSatisfied: boolean;
} {
  return {
    runtimeModelReviewConfirmed: input?.runtimeModelReviewConfirmed === true,
    runtimeModelNoExecutionWireConfirmed: input?.runtimeModelNoExecutionWireConfirmed === true,
    runtimeModelNoPersistenceConfirmed: input?.runtimeModelNoPersistenceConfirmed === true,
    confirmationsSatisfied:
      input?.runtimeModelReviewConfirmed === true &&
      input?.runtimeModelNoExecutionWireConfirmed === true &&
      input?.runtimeModelNoPersistenceConfirmed === true,
  };
}

export function resolveRuntimeExecutionModelCandidateDecision(
  input: RuntimeExecutionModelCandidateDecisionInput,
): RuntimeExecutionModelCandidateDecision {
  if (input.sourceBaselineDecision === "blocked" || !input.hasRequiredModelKinds || !input.candidatePostureValid) {
    return "blocked";
  }

  if (input.sourceBaselineDecision !== "ready_for_execution_model_candidate" || !input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_runtime_execution_model_review";
}

export function buildRuntimeExecutionModelCandidateFingerprint(input: {
  readonly sourceBaselineDecision: RuntimeExecutionModelCandidateDecisionInput["sourceBaselineDecision"];
  readonly modelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly confirmationsSatisfied: boolean;
}): string {
  return [
    "runtime-execution-model-candidate-v1",
    `baseline-${input.sourceBaselineDecision}`,
    `kinds-${[...input.modelKinds].sort((a, b) => a.localeCompare(b)).join("|")}`,
    `confirmations-${input.confirmationsSatisfied}`,
  ].join(":");
}

export function buildRuntimeExecutionModelCandidateSummary(
  decision: RuntimeExecutionModelCandidateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-B runtime execution model candidate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-B runtime execution model candidate defers; baseline or confirmations are incomplete.";
  }
  return "Stage 6-B runtime execution model candidates are ready for review. No execution wire or persistence in this step.";
}

export function buildRuntimeExecutionModelCandidateChecklists(input: {
  readonly parsed: ReturnType<typeof parseRuntimeExecutionModelCandidateInput>;
  readonly sourceBaselineDecision: RuntimeExecutionModelCandidateDecisionInput["sourceBaselineDecision"];
  readonly validation: ReturnType<typeof validateRuntimeExecutionModelCandidates>;
}): {
  readonly modelChecklist: readonly RuntimeExecutionModelCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionModelCandidateChecklistItem[];
} {
  return {
    modelChecklist: mapChecklist([
      {
        item: "source baseline ready",
        satisfied: input.sourceBaselineDecision === "ready_for_execution_model_candidate",
        detail: `sourceBaselineDecision=${input.sourceBaselineDecision}`,
      },
      {
        item: "all required model kinds present",
        satisfied: input.validation.hasRequiredModelKinds,
        detail: `missingKinds=${input.validation.missingKinds.join(",") || "none"}`,
      },
      {
        item: "runtime model review confirmed",
        satisfied: input.parsed.runtimeModelReviewConfirmed,
        detail: `runtimeModelReviewConfirmed=${input.parsed.runtimeModelReviewConfirmed}`,
      },
      {
        item: "no execution wire confirmed",
        satisfied: input.parsed.runtimeModelNoExecutionWireConfirmed,
        detail: `runtimeModelNoExecutionWireConfirmed=${input.parsed.runtimeModelNoExecutionWireConfirmed}`,
      },
      {
        item: "no persistence confirmed",
        satisfied: input.parsed.runtimeModelNoPersistenceConfirmed,
        detail: `runtimeModelNoPersistenceConfirmed=${input.parsed.runtimeModelNoPersistenceConfirmed}`,
      },
    ]),
    boundaryChecklist: mapChecklist([
      { item: "candidateOnly=true", satisfied: true, detail: "candidateOnly=true" },
      {
        item: "actualExecutionWireAllowedInThisStep=false",
        satisfied: true,
        detail: "actualExecutionWireAllowedInThisStep=false",
      },
      {
        item: "actualPersistenceAllowedInThisStep=false",
        satisfied: true,
        detail: "actualPersistenceAllowedInThisStep=false",
      },
      {
        item: "actualExternalSideEffectAllowedInThisStep=false",
        satisfied: true,
        detail: "actualExternalSideEffectAllowedInThisStep=false",
      },
    ]),
  };
}

export function appendRuntimeExecutionModelCandidateFindings(input: {
  readonly findings: RuntimeExecutionModelCandidateFinding[];
  readonly decision: RuntimeExecutionModelCandidateDecision;
  readonly sourceBaselineDecision: RuntimeExecutionModelCandidateDecisionInput["sourceBaselineDecision"];
  readonly parsed: ReturnType<typeof parseRuntimeExecutionModelCandidateInput>;
  readonly validation: ReturnType<typeof validateRuntimeExecutionModelCandidates>;
}): void {
  const { findings, decision, sourceBaselineDecision, parsed, validation } = input;

  findings.push(
    finding("info", "runtime_execution_model_candidate_created", "Stage 6-B runtime execution model candidate evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_model_candidate_only", "Runtime execution model remains candidate-only"),
  );

  if (sourceBaselineDecision === "blocked") {
    findings.push(finding("blocking", "source_baseline_blocked", "Source Stage 6-A baseline is blocked"));
    findings.push(finding("blocking", "stage6_b_candidate_blocked", "Stage 6-B candidate is blocked"));
    return;
  }

  if (!validation.candidatePostureValid) {
    if (validation.missingKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "required_model_kind_missing",
          `Required runtime execution model kind is missing: ${validation.missingKinds.join(", ")}`,
        ),
      );
    }
    if (validation.unknownKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "unknown_model_candidate_kind",
          `Unknown runtime execution model candidate kind: ${validation.unknownKinds.join(", ")}`,
        ),
      );
    }
    if (validation.duplicateKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "duplicate_model_candidate_kind",
          `Duplicate runtime execution model candidate kind: ${validation.duplicateKinds.join(", ")}`,
        ),
      );
    }
    if (validation.emptyPurposeKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "model_candidate_empty_purpose",
          `Model candidate purpose is empty: ${validation.emptyPurposeKinds.join(", ")}`,
        ),
      );
    }
    if (validation.emptyModelNameKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "model_candidate_empty_name",
          `Model candidate name is empty: ${validation.emptyModelNameKinds.join(", ")}`,
        ),
      );
    }
    if (validation.emptyProposedFieldKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "model_candidate_empty_proposed_fields",
          `Model candidate proposedFields is empty: ${validation.emptyProposedFieldKinds.join(", ")}`,
        ),
      );
    }
    if (validation.forbiddenFieldKinds.length > 0) {
      findings.push(
        finding(
          "blocking",
          "model_candidate_contains_forbidden_field",
          `Model candidate proposedFields contains forbidden field: ${validation.forbiddenFieldKinds.join(", ")}`,
        ),
      );
    }
    findings.push(finding("blocking", "stage6_b_candidate_blocked", "Stage 6-B candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sourceBaselineDecision === "defer") {
      findings.push(finding("warning", "source_baseline_deferred", "Source Stage 6-A baseline defers"));
    }
    if (!parsed.confirmationsSatisfied) {
      findings.push(finding("warning", "runtime_model_confirmation_missing", "Stage 6-B confirmation is missing"));
    }
    findings.push(finding("warning", "stage6_b_candidate_deferred", "Stage 6-B candidate defers"));
    return;
  }

  findings.push(finding("info", "stage6_b_candidate_ready", "Stage 6-B candidate is ready for model review"));
}

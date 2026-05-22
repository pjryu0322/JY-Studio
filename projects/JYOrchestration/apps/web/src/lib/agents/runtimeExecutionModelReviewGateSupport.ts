/**
 * Stage 6-C runtime execution model review gate support (read-only).
 */

import { evaluateRuntimeExecutionModelCandidate } from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import { REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS } from "@/lib/agents/runtimeExecutionModelCandidateConstants";
import type { RuntimeExecutionModelCandidateReport } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import {
  collectForbiddenFieldTraceInModelCandidates,
  computeNoRunBoundarySatisfied,
  computePersistenceBoundarySatisfied,
  computeReviewedModelTrace,
  detectForbiddenFieldsInModelCandidates,
} from "@/lib/agents/runtimeExecutionModelReviewGateBoundary";

export {
  collectForbiddenFieldTraceInModelCandidates,
  computeNoRunBoundarySatisfied,
  computePersistenceBoundarySatisfied,
  computeReviewedModelTrace,
  detectForbiddenFieldsInModelCandidates,
} from "@/lib/agents/runtimeExecutionModelReviewGateBoundary";
import {
  REQUIRED_STAGE6_C_MODEL_REVIEW_GATE_CONFIRMATIONS,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_TITLE,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_VERSION,
  STAGE6_C_RECOMMENDED_NEXT_PHASES,
  STAGE6_C_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelReviewGateConstants";
import type {
  RuntimeExecutionModelReviewArea,
  RuntimeExecutionModelReviewGateChecklistItem,
  RuntimeExecutionModelReviewGateDecision,
  RuntimeExecutionModelReviewGateDecisionInput,
  RuntimeExecutionModelReviewGateFinding,
  RuntimeExecutionModelReviewGateInput,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionModelReviewArea;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RuntimeExecutionModelReviewGateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionModelReviewGateFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionModelReviewGateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseRuntimeExecutionModelReviewGateInput(input?: RuntimeExecutionModelReviewGateInput): {
  readonly runtimeModelReviewGateConfirmed: boolean;
  readonly runtimeModelFieldContractReviewed: boolean;
  readonly runtimeModelNoRunBoundaryReviewed: boolean;
  readonly runtimeModelPersistenceBoundaryReviewed: boolean;
  readonly runtimeModelApprovalBoundaryReviewed: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly confirmationCount: number;
} {
  const flags = [
    input?.runtimeModelReviewGateConfirmed === true,
    input?.runtimeModelFieldContractReviewed === true,
    input?.runtimeModelNoRunBoundaryReviewed === true,
    input?.runtimeModelPersistenceBoundaryReviewed === true,
    input?.runtimeModelApprovalBoundaryReviewed === true,
  ];
  return {
    runtimeModelReviewGateConfirmed: flags[0],
    runtimeModelFieldContractReviewed: flags[1],
    runtimeModelNoRunBoundaryReviewed: flags[2],
    runtimeModelPersistenceBoundaryReviewed: flags[3],
    runtimeModelApprovalBoundaryReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeExecutionModelReviewGateDecision(
  input: RuntimeExecutionModelReviewGateDecisionInput,
): RuntimeExecutionModelReviewGateDecision {
  if (input.sourceModelCandidateDecision === "blocked") {
    return "blocked";
  }

  if (
    input.sourceCandidateOnly !== true ||
    input.forbiddenFieldDetected ||
    input.noRunBoundarySatisfied !== true ||
    input.persistenceBoundarySatisfied !== true ||
    input.schemaMigrationBoundarySatisfied !== true
  ) {
    return "blocked";
  }

  if (
    input.sourceModelCandidateDecision === "defer" ||
    input.sourceModelCandidateDecision !== "ready_for_runtime_execution_model_review" ||
    !input.confirmationsSatisfied
  ) {
    return "defer";
  }

  return "ready_for_runtime_execution_contract_candidate";
}

export function buildRuntimeExecutionModelReviewGateFingerprint(input: {
  readonly sourceModelCandidateFingerprint: string;
  readonly reviewedModelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly reviewedFieldCount: number;
  readonly confirmationCount: number;
  readonly sourceCandidateOnly: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly forbiddenFieldDetected: boolean;
}): string {
  return [
    "runtime-execution-model-review-gate-v1",
    input.sourceModelCandidateFingerprint,
    input.reviewedModelKinds.join("|"),
    `fields:${input.reviewedFieldCount}`,
    `confirmations:${input.confirmationCount}`,
    `candidateOnly:${input.sourceCandidateOnly}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `forbidden:${input.forbiddenFieldDetected}`,
  ].join("::");
}

export function buildRuntimeExecutionModelReviewGateSummary(
  decision: RuntimeExecutionModelReviewGateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-C runtime execution model review gate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-C runtime execution model review gate defers; source candidate or confirmations are incomplete.";
  }
  return "Stage 6-C review gate is ready for runtime execution contract candidate. This is not actual runtime execution permission.";
}

export function buildRuntimeExecutionModelReviewGateChecklists(input: {
  readonly source: RuntimeExecutionModelCandidateReport;
  readonly parsed: ReturnType<typeof parseRuntimeExecutionModelReviewGateInput>;
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

  const modelKindToArea: Record<RuntimeExecutionModelCandidateKind, RuntimeExecutionModelReviewArea> = {
    RuntimeExecutionRequest: "request_model",
    RuntimeExecutionPlan: "plan_model",
    RuntimeExecutionStep: "step_model",
    RuntimeExecutionResult: "result_model",
    RuntimeExecutionFinding: "finding_model",
    RuntimeExecutionApprovalState: "approval_state_model",
    RuntimeExecutionRollbackPlan: "rollback_plan_model",
  };

  const modelReviewEntries: ChecklistEntry[] = REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS.map((kind) => {
    const reviewed = input.source.modelCandidates.some((c) => c.kind === kind);
    return {
      item: `${kind} reviewed`,
      area: modelKindToArea[kind],
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
      satisfied:
        input.persistenceBoundarySatisfied && !input.forbiddenFieldDetected,
      detail: `persistenceBoundarySatisfied=${input.persistenceBoundarySatisfied}`,
    },
  ]);

  return { reviewChecklist, noRunChecklist, persistenceChecklist };
}

export function appendRuntimeExecutionModelReviewGateFindings(input: {
  readonly findings: RuntimeExecutionModelReviewGateFinding[];
  readonly decision: RuntimeExecutionModelReviewGateDecision;
  readonly source: RuntimeExecutionModelCandidateReport;
  readonly parsed: ReturnType<typeof parseRuntimeExecutionModelReviewGateInput>;
  readonly forbiddenFieldTrace: ReturnType<typeof collectForbiddenFieldTraceInModelCandidates>;
  readonly noRunBoundarySatisfied: boolean;
  readonly persistenceBoundarySatisfied: boolean;
  readonly schemaMigrationBoundarySatisfied: boolean;
}): void {
  const {
    findings,
    decision,
    source,
    parsed,
    forbiddenFieldTrace,
    noRunBoundarySatisfied,
    persistenceBoundarySatisfied,
    schemaMigrationBoundarySatisfied,
  } = input;
  const forbiddenFieldDetected = forbiddenFieldTrace.detected;

  findings.push(
    finding("info", "runtime_execution_model_review_gate_created", "Stage 6-C review gate evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_model_review_gate_only", "Runtime execution model review gate is read-only"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_model_candidate_blocked", "Source Stage 6-B model candidate is blocked"));
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (source.candidateOnly !== true) {
    findings.push(
      finding("blocking", "source_candidate_only_boundary_violation", "Source candidateOnly must remain true"),
    );
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (source.actualExecutionWireAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "runtime_execution_wire_boundary_violation", "Source execution wire must remain disallowed"),
    );
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (source.actualPersistenceAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "runtime_persistence_boundary_violation", "Source persistence must remain disallowed"),
    );
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (source.actualExternalSideEffectAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "runtime_external_side_effect_boundary_violation",
        "Source external side effects must remain disallowed",
      ),
    );
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (forbiddenFieldDetected) {
    findings.push(
      finding(
        "blocking",
        "runtime_model_forbidden_field_detected",
        `Forbidden field detected in model candidate proposedFields: kinds=${forbiddenFieldTrace.modelKinds.join(",")}, fields=${forbiddenFieldTrace.fieldNames.join(",")}`,
      ),
    );
    findings.push(
      finding(
        "blocking",
        "runtime_model_forbidden_field_trace_collected",
        `Forbidden field trace collected: ${forbiddenFieldTrace.fieldNames.join(", ")}`,
      ),
    );
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (schemaMigrationBoundarySatisfied !== true) {
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (noRunBoundarySatisfied !== true || persistenceBoundarySatisfied !== true) {
    findings.push(finding("blocking", "stage6_c_review_gate_blocked", "Stage 6-C review gate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (source.decision === "defer" || source.decision !== "ready_for_runtime_execution_model_review") {
      findings.push(
        finding("warning", "source_model_candidate_not_ready", "Source Stage 6-B model candidate is not ready for review"),
      );
    }
    if (!parsed.runtimeModelReviewGateConfirmed) {
      findings.push(
        finding("warning", "runtime_execution_model_review_confirmation_missing", "runtimeModelReviewGateConfirmed is missing"),
      );
    }
    if (!parsed.runtimeModelFieldContractReviewed) {
      findings.push(
        finding("warning", "runtime_execution_model_review_confirmation_missing", "runtimeModelFieldContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeModelNoRunBoundaryReviewed) {
      findings.push(
        finding("warning", "runtime_execution_model_review_confirmation_missing", "runtimeModelNoRunBoundaryReviewed is missing"),
      );
    }
    if (!parsed.runtimeModelPersistenceBoundaryReviewed) {
      findings.push(
        finding("warning", "runtime_execution_model_review_confirmation_missing", "runtimeModelPersistenceBoundaryReviewed is missing"),
      );
    }
    if (!parsed.runtimeModelApprovalBoundaryReviewed) {
      findings.push(
        finding("warning", "runtime_execution_model_review_confirmation_missing", "runtimeModelApprovalBoundaryReviewed is missing"),
      );
    }
    findings.push(finding("warning", "stage6_c_review_gate_deferred", "Stage 6-C review gate defers"));
    return;
  }

  findings.push(
    finding(
      "info",
      "runtime_schema_migration_boundary_disallowed",
      "Schema migration remains disallowed in Stage 6-C review gate",
    ),
  );
  findings.push(
    finding("info", "runtime_execution_contract_candidate_ready", "Ready for runtime execution contract candidate"),
  );
}

/** Evaluate source Stage 6-B report for review gate (used by evaluator). */
export function evaluateRuntimeExecutionModelReviewGateSource(
  input?: RuntimeExecutionModelReviewGateInput,
): RuntimeExecutionModelCandidateReport {
  return evaluateRuntimeExecutionModelCandidate(input?.modelCandidate);
}

export {
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_TITLE,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_VERSION,
  REQUIRED_STAGE6_C_MODEL_REVIEW_GATE_CONFIRMATIONS,
  STAGE6_C_RECOMMENDED_NEXT_PHASES,
  STAGE6_C_SEPARATED_WORK_ITEMS,
};

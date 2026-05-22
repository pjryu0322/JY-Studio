/**
 * Stage 6-C review gate findings builder (read-only).
 */

import type { RuntimeExecutionModelCandidateReport } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import { collectForbiddenFieldTraceInModelCandidates } from "@/lib/agents/runtimeExecutionModelReviewGateBoundary";
import type {
  ParsedRuntimeExecutionModelReviewGateInput,
  RuntimeExecutionModelReviewGateDecision,
  RuntimeExecutionModelReviewGateFinding,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

function finding(
  severity: RuntimeExecutionModelReviewGateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionModelReviewGateFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionModelReviewGateFindings(input: {
  readonly findings: RuntimeExecutionModelReviewGateFinding[];
  readonly decision: RuntimeExecutionModelReviewGateDecision;
  readonly source: RuntimeExecutionModelCandidateReport;
  readonly parsed: ParsedRuntimeExecutionModelReviewGateInput;
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

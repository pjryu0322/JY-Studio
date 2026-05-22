/**
 * Stage 6-D runtime execution contract candidate support (read-only).
 */

import { evaluateRuntimeExecutionModelReviewGate } from "@/lib/agents/evaluateRuntimeExecutionModelReviewGate";
import { buildDefaultRuntimeExecutionModelCandidates } from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionModelReviewGateReport } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
import {
  COMMON_CONTRACT_BOUNDARY_RULES,
  REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS,
  REQUIRED_STAGE6_D_CONTRACT_CANDIDATE_CONFIRMATIONS,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_VERSION,
  STAGE6_D_RECOMMENDED_NEXT_PHASES,
  STAGE6_D_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionContractCandidateConstants";
import type {
  ParsedRuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractArea,
  RuntimeExecutionContractCandidateChecklistItem,
  RuntimeExecutionContractCandidateDecision,
  RuntimeExecutionContractCandidateDecisionInput,
  RuntimeExecutionContractCandidateFinding,
  RuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractCandidateItem,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

const MODEL_KIND_TO_CONTRACT: Record<
  RuntimeExecutionModelCandidateKind,
  {
    readonly contractId: (typeof REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS)[number];
    readonly area: RuntimeExecutionContractArea;
    readonly contractName: string;
    readonly extraBoundaryRules: readonly string[];
  }
> = {
  RuntimeExecutionRequest: {
    contractId: "runtime-execution-request-contract",
    area: "request_contract",
    contractName: "Runtime Execution Request Contract",
    extraBoundaryRules: ["request_contract_candidate_only"],
  },
  RuntimeExecutionPlan: {
    contractId: "runtime-execution-plan-contract",
    area: "plan_contract",
    contractName: "Runtime Execution Plan Contract",
    extraBoundaryRules: ["plan_requires_approval_reference"],
  },
  RuntimeExecutionStep: {
    contractId: "runtime-execution-step-contract",
    area: "step_contract",
    contractName: "Runtime Execution Step Contract",
    extraBoundaryRules: ["step_unit_kind_required"],
  },
  RuntimeExecutionResult: {
    contractId: "runtime-execution-result-contract",
    area: "result_contract",
    contractName: "Runtime Execution Result Contract",
    extraBoundaryRules: ["result_findings_reference_only"],
  },
  RuntimeExecutionFinding: {
    contractId: "runtime-execution-finding-contract",
    area: "finding_contract",
    contractName: "Runtime Execution Finding Contract",
    extraBoundaryRules: ["finding_severity_code_required"],
  },
  RuntimeExecutionApprovalState: {
    contractId: "runtime-execution-approval-contract",
    area: "approval_contract",
    contractName: "Runtime Execution Approval Contract",
    extraBoundaryRules: ["operator_approval_required_before_execution"],
  },
  RuntimeExecutionRollbackPlan: {
    contractId: "runtime-execution-rollback-contract",
    area: "rollback_contract",
    contractName: "Runtime Execution Rollback Contract",
    extraBoundaryRules: ["rollback_plan_candidate_only"],
  },
};

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionContractArea;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RuntimeExecutionContractCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionContractCandidateFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionContractCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseRuntimeExecutionContractCandidateInput(
  input?: RuntimeExecutionContractCandidateInput,
): ParsedRuntimeExecutionContractCandidateInput {
  const flags = [
    input?.runtimeExecutionContractCandidateConfirmed === true,
    input?.runtimeExecutionBoundaryContractReviewed === true,
    input?.runtimeExecutionDryRunContractReviewed === true,
    input?.runtimeExecutionRollbackContractReviewed === true,
    input?.runtimeExecutionApprovalContractReviewed === true,
  ];
  return {
    runtimeExecutionContractCandidateConfirmed: flags[0],
    runtimeExecutionBoundaryContractReviewed: flags[1],
    runtimeExecutionDryRunContractReviewed: flags[2],
    runtimeExecutionRollbackContractReviewed: flags[3],
    runtimeExecutionApprovalContractReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function buildRuntimeExecutionContractCandidates(
  _source: RuntimeExecutionModelReviewGateReport,
): readonly RuntimeExecutionContractCandidateItem[] {
  const models = buildDefaultRuntimeExecutionModelCandidates();
  return models.map((model) => {
    const spec = MODEL_KIND_TO_CONTRACT[model.kind];
    return {
      contractId: spec.contractId,
      area: spec.area,
      modelKind: model.kind,
      contractName: spec.contractName,
      purpose: `Defines ${spec.area.replace(/_/g, " ")} candidate for future runtime execution.`,
      requiredFields: [...model.proposedFields],
      optionalFields: [],
      boundaryRules: [...COMMON_CONTRACT_BOUNDARY_RULES, ...spec.extraBoundaryRules],
      candidateOnly: true,
      implementedInThisStep: false,
    };
  });
}

export function validateRuntimeExecutionContractCandidates(
  candidates: readonly RuntimeExecutionContractCandidateItem[],
): boolean {
  if (candidates.length !== REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS.length) {
    return false;
  }
  const ids = new Set(candidates.map((c) => c.contractId));
  if (!REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS.every((id) => ids.has(id))) {
    return false;
  }
  return candidates.every(
    (c) =>
      c.candidateOnly === true &&
      c.implementedInThisStep === false &&
      c.requiredFields.length > 0 &&
      c.boundaryRules.length > 0,
  );
}

export function computeRuntimeExecutionContractCandidateTrace(
  candidates: readonly RuntimeExecutionContractCandidateItem[],
  source: RuntimeExecutionModelReviewGateReport,
): {
  readonly contractCandidateCount: number;
  readonly contractFieldCount: number;
  readonly contractBoundaryRuleCount: number;
  readonly reviewedModelCount: number;
} {
  return {
    contractCandidateCount: candidates.length,
    contractFieldCount: candidates.reduce(
      (sum, c) => sum + c.requiredFields.length + c.optionalFields.length,
      0,
    ),
    contractBoundaryRuleCount: candidates.reduce((sum, c) => sum + c.boundaryRules.length, 0),
    reviewedModelCount: source.reviewedModelCount,
  };
}

export function resolveRuntimeExecutionContractCandidateDecision(
  input: RuntimeExecutionContractCandidateDecisionInput,
): RuntimeExecutionContractCandidateDecision {
  if (input.sourceReviewGateDecision === "blocked") {
    return "blocked";
  }

  if (
    input.sourceReviewGateOnly !== true ||
    input.sourceCandidateOnly !== true ||
    input.sourceNoRunBoundarySatisfied !== true ||
    input.sourcePersistenceBoundarySatisfied !== true ||
    input.sourceSchemaMigrationBoundarySatisfied !== true ||
    !input.contractCandidatesValid
  ) {
    return "blocked";
  }

  if (
    input.sourceReviewGateDecision === "defer" ||
    input.sourceReviewGateDecision !== "ready_for_runtime_execution_contract_candidate" ||
    !input.confirmationsSatisfied
  ) {
    return "defer";
  }

  return "ready_for_runtime_execution_dry_run_contract";
}

export function buildRuntimeExecutionContractCandidateFingerprint(input: {
  readonly sourceReviewGateFingerprint: string;
  readonly contractCandidateCount: number;
  readonly contractFieldCount: number;
  readonly contractBoundaryRuleCount: number;
  readonly confirmationCount: number;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
}): string {
  return [
    "runtime-execution-contract-candidate-v1",
    input.sourceReviewGateFingerprint,
    `contracts:${input.contractCandidateCount}`,
    `fields:${input.contractFieldCount}`,
    `rules:${input.contractBoundaryRuleCount}`,
    `confirmations:${input.confirmationCount}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `schema:${input.sourceSchemaMigrationBoundarySatisfied}`,
  ].join("::");
}

export function buildRuntimeExecutionContractCandidateSummary(
  decision: RuntimeExecutionContractCandidateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-D runtime execution contract candidate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-D runtime execution contract candidate defers; review gate or confirmations are incomplete.";
  }
  return "Stage 6-D contract candidates are ready for dry-run contract design. This is not actual runtime execution.";
}

export function buildRuntimeExecutionContractCandidateChecklists(input: {
  readonly contractCandidates: readonly RuntimeExecutionContractCandidateItem[];
  readonly parsed: ParsedRuntimeExecutionContractCandidateInput;
}): {
  readonly contractChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly dryRunChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
} {
  const contractByArea = new Map(
    input.contractCandidates.map((c) => [c.area, c] as const),
  );

  const contractChecklist = mapChecklist([
    {
      item: "7 contract candidates generated",
      area: "boundary_contract",
      satisfied: input.contractCandidates.length === 7,
      detail: `contractCandidateCount=${input.contractCandidates.length}`,
    },
    {
      item: "request contract reviewed",
      area: "request_contract",
      satisfied: contractByArea.has("request_contract"),
      detail: "request_contract present",
    },
    {
      item: "plan contract reviewed",
      area: "plan_contract",
      satisfied: contractByArea.has("plan_contract"),
      detail: "plan_contract present",
    },
    {
      item: "step contract reviewed",
      area: "step_contract",
      satisfied: contractByArea.has("step_contract"),
      detail: "step_contract present",
    },
    {
      item: "result contract reviewed",
      area: "result_contract",
      satisfied: contractByArea.has("result_contract"),
      detail: "result_contract present",
    },
    {
      item: "finding contract reviewed",
      area: "finding_contract",
      satisfied: contractByArea.has("finding_contract"),
      detail: "finding_contract present",
    },
    {
      item: "approval contract reviewed",
      area: "approval_contract",
      satisfied: contractByArea.has("approval_contract"),
      detail: "approval_contract present",
    },
    {
      item: "rollback contract reviewed",
      area: "rollback_contract",
      satisfied: contractByArea.has("rollback_contract"),
      detail: "rollback_contract present",
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "actualRuntimeExecutionAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "actualExecutionRunnerAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "actualExecutionWireAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionWireAllowedInThisStep=false",
    },
    {
      item: "actualCursorGithubWireAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
    {
      item: "actualConnectorRoutingChangeAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "actualPersistenceAllowedInThisStep=false",
      area: "persistence_boundary",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "actualSchemaMigrationAllowedInThisStep=false",
      area: "schema_boundary",
      satisfied: true,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "actualExternalSideEffectAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExternalSideEffectAllowedInThisStep=false",
    },
  ]);

  const dryRunChecklist = mapChecklist([
    {
      item: "dry-run contract candidate only",
      area: "dry_run_contract",
      satisfied: input.parsed.runtimeExecutionDryRunContractReviewed,
      detail: `runtimeExecutionDryRunContractReviewed=${input.parsed.runtimeExecutionDryRunContractReviewed}`,
    },
    {
      item: "dry-run runner not implemented",
      area: "dry_run_contract",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "dry-run result persistence not implemented",
      area: "dry_run_contract",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "dry-run approval remains separated",
      area: "dry_run_contract",
      satisfied: input.parsed.runtimeExecutionApprovalContractReviewed,
      detail: `runtimeExecutionApprovalContractReviewed=${input.parsed.runtimeExecutionApprovalContractReviewed}`,
    },
  ]);

  return { contractChecklist, boundaryChecklist, dryRunChecklist };
}

export function appendRuntimeExecutionContractCandidateFindings(input: {
  readonly findings: RuntimeExecutionContractCandidateFinding[];
  readonly decision: RuntimeExecutionContractCandidateDecision;
  readonly source: RuntimeExecutionModelReviewGateReport;
  readonly parsed: ParsedRuntimeExecutionContractCandidateInput;
  readonly contractCandidatesValid: boolean;
}): void {
  const { findings, decision, source, parsed, contractCandidatesValid } = input;

  findings.push(
    finding("info", "runtime_execution_contract_candidate_created", "Stage 6-D contract candidate evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_contract_candidate_only", "Runtime execution contract remains candidate-only"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_review_gate_blocked", "Source Stage 6-C review gate is blocked"));
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.reviewGateOnly !== true || source.sourceCandidateOnly !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source review gate boundary violation"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.sourceNoRunBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source no-run boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.sourcePersistenceBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source persistence boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.schemaMigrationBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source schema migration boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (!contractCandidatesValid) {
    findings.push(finding("blocking", "runtime_contract_candidate_invalid", "Runtime contract candidates are invalid"));
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (source.decision === "defer" || source.decision !== "ready_for_runtime_execution_contract_candidate") {
      findings.push(
        finding("warning", "source_review_gate_not_ready", "Source Stage 6-C review gate is not ready for contract candidate"),
      );
    }
    if (!parsed.runtimeExecutionContractCandidateConfirmed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionContractCandidateConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionBoundaryContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionBoundaryContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionDryRunContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionRollbackContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionRollbackContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionApprovalContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionApprovalContractReviewed is missing"),
      );
    }
    findings.push(finding("warning", "stage6_d_contract_candidate_deferred", "Stage 6-D contract candidate defers"));
    return;
  }

  findings.push(
    finding("info", "runtime_contract_no_run_boundary_enforced", "No-run boundary enforced in contract candidate step"),
  );
  findings.push(
    finding("info", "runtime_contract_schema_boundary_enforced", "Schema migration boundary enforced in contract candidate step"),
  );
  findings.push(
    finding("info", "runtime_contract_persistence_boundary_enforced", "Persistence boundary enforced in contract candidate step"),
  );
  findings.push(
    finding("info", "runtime_execution_dry_run_contract_candidate_ready", "Ready for runtime execution dry-run contract"),
  );
}

/** Evaluate source Stage 6-C report for contract candidate. */
export function evaluateRuntimeExecutionContractCandidateSource(
  input?: RuntimeExecutionContractCandidateInput,
): RuntimeExecutionModelReviewGateReport {
  return evaluateRuntimeExecutionModelReviewGate(input?.reviewGate);
}

export {
  REQUIRED_STAGE6_D_CONTRACT_CANDIDATE_CONFIRMATIONS,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_VERSION,
  STAGE6_D_RECOMMENDED_NEXT_PHASES,
  STAGE6_D_SEPARATED_WORK_ITEMS,
};

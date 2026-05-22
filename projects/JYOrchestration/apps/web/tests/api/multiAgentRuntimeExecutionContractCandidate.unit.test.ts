import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeExecutionContractCandidate,
  resolveRuntimeExecutionContractCandidateDecision,
  validateRuntimeExecutionContractCandidateDetails,
  validateRuntimeExecutionContractCandidates,
} from "@/lib/agents/evaluateRuntimeExecutionContractCandidate";
import { buildRuntimeExecutionContractCandidates } from "@/lib/agents/runtimeExecutionContractCandidateSupport";
import { evaluateRuntimeExecutionModelReviewGate } from "@/lib/agents/evaluateRuntimeExecutionModelReviewGate";
import {
  buildStage6CReadyReviewGateInput,
  buildStage6DContractCandidateConfirmedInput,
  buildStage6DReadyContractCandidateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type {
  RuntimeExecutionContractArea,
  RuntimeExecutionContractCandidateDecisionInput,
  RuntimeExecutionContractCandidateItem,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

function readyDecisionInput(
  overrides: Partial<RuntimeExecutionContractCandidateDecisionInput> = {},
): RuntimeExecutionContractCandidateDecisionInput {
  return {
    sourceReviewGateDecision: "ready_for_runtime_execution_contract_candidate",
    sourceReviewGateOnly: true,
    sourceCandidateOnly: true,
    sourceNoRunBoundarySatisfied: true,
    sourcePersistenceBoundarySatisfied: true,
    sourceSchemaMigrationBoundarySatisfied: true,
    sourceForbiddenFieldDetected: false,
    sourceActualExecutionWireAllowedInThisStep: false,
    sourceActualPersistenceAllowedInThisStep: false,
    sourceActualExternalSideEffectAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceReviewedModelCount: 7,
    confirmationsSatisfied: true,
    contractCandidatesValid: true,
    ...overrides,
  };
}

function evaluateReadyContract(input: Parameters<typeof evaluateRuntimeExecutionContractCandidate>[0] = {}) {
  return evaluateRuntimeExecutionContractCandidate({ ...buildStage6DReadyContractCandidateInput(), ...input });
}

function readyReviewGate() {
  return evaluateRuntimeExecutionModelReviewGate(buildStage6CReadyReviewGateInput());
}

describe("multi-agent runtime execution contract candidate stage 6-D", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionContractCandidate().decision).toBe("defer");
  });

  it("source Stage 6-C blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionContractCandidate({
        reviewGate: { modelCandidate: { baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } } } },
        ...buildStage6DContractCandidateConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 6-C defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionContractCandidate({
        reviewGate: buildStage6CReadyReviewGateInput(),
        runtimeExecutionContractCandidateConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 6-C ready with five confirmations yields ready_for_runtime_execution_dry_run_contract", () => {
    expect(evaluateReadyContract().decision).toBe("ready_for_runtime_execution_dry_run_contract");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionContractCandidate({
        ...buildStage6DReadyContractCandidateInput(),
        runtimeExecutionDryRunContractReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionContractCandidateDecision blocks when sourceReviewGateOnly is false", () => {
    expect(resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ sourceReviewGateOnly: false }))).toBe(
      "blocked",
    );
  });

  it("resolveRuntimeExecutionContractCandidateDecision blocks when sourceCandidateOnly is false", () => {
    expect(resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ sourceCandidateOnly: false }))).toBe(
      "blocked",
    );
  });

  it("resolveRuntimeExecutionContractCandidateDecision blocks when sourceNoRunBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ sourceNoRunBoundarySatisfied: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractCandidateDecision blocks when sourcePersistenceBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ sourcePersistenceBoundarySatisfied: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractCandidateDecision blocks when sourceSchemaMigrationBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(
        readyDecisionInput({ sourceSchemaMigrationBoundarySatisfied: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractCandidateDecision blocks when contractCandidatesValid is false", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ contractCandidatesValid: false })),
    ).toBe("blocked");
  });

  it("contractCandidateOnly is true", () => {
    expect(evaluateReadyContract().contractCandidateOnly).toBe(true);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualExecutionRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualExecutionRunnerAllowedInThisStep).toBe(false);
  });

  it("actualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("actualCursorGithubWireAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualCursorGithubWireAllowedInThisStep).toBe(false);
  });

  it("actualConnectorRoutingChangeAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualConnectorRoutingChangeAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyContract().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("contractCandidateCount is 7", () => {
    expect(evaluateReadyContract().contractCandidateCount).toBe(7);
  });

  it("contractFieldCount is greater than zero", () => {
    expect(evaluateReadyContract().contractFieldCount).toBeGreaterThan(0);
  });

  it("contractBoundaryRuleCount is greater than zero", () => {
    expect(evaluateReadyContract().contractBoundaryRuleCount).toBeGreaterThan(0);
  });

  const CONTRACT_AREAS: RuntimeExecutionContractArea[] = [
    "request_contract",
    "plan_contract",
    "step_contract",
    "result_contract",
    "finding_contract",
    "approval_contract",
    "rollback_contract",
  ];

  for (const area of CONTRACT_AREAS) {
    it(`contractChecklist includes ${area}`, () => {
      expect(evaluateReadyContract().contractChecklist.some((item) => item.area === area)).toBe(true);
    });
  }

  it("boundaryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyContract().boundaryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("dryRunChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyContract().dryRunChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("recommendedNextPhases includes stage_6_e_runtime_execution_dry_run_contract", () => {
    expect(evaluateReadyContract().recommendedNextPhases).toContain(
      "stage_6_e_runtime_execution_dry_run_contract",
    );
  });

  it("separatedWorkItems includes actual_runtime_execution_api", () => {
    expect(evaluateReadyContract().separatedWorkItems).toContain("actual_runtime_execution_api");
  });

  it("findings include runtime_execution_contract_candidate_only", () => {
    expect(
      evaluateReadyContract().findings.some((f) => f.code === "runtime_execution_contract_candidate_only"),
    ).toBe(true);
  });

  it("ready findings include runtime_execution_dry_run_contract_candidate_ready", () => {
    expect(
      evaluateReadyContract().findings.some((f) => f.code === "runtime_execution_dry_run_contract_candidate_ready"),
    ).toBe(true);
  });

  it("contractCandidateFingerprint is deterministic", () => {
    const first = evaluateReadyContract();
    const second = evaluateReadyContract();
    expect(first.contractCandidateFingerprint).toBe(second.contractCandidateFingerprint);
  });

  it("contractCandidateFingerprint includes contracts fields rules noRun persistence schema segments", () => {
    const fingerprint = evaluateReadyContract().contractCandidateFingerprint;
    expect(fingerprint).toContain("contracts:7");
    expect(fingerprint).toContain("fields:");
    expect(fingerprint).toContain("rules:");
    expect(fingerprint).toContain("noRun:true");
    expect(fingerprint).toContain("persistence:true");
    expect(fingerprint).toContain("schema:true");
  });

  it("validateRuntimeExecutionContractCandidates rejects incomplete contracts", () => {
    const contracts = buildRuntimeExecutionContractCandidates(readyReviewGate()).slice(0, 6);
    expect(validateRuntimeExecutionContractCandidates(contracts)).toBe(false);
  });

  it("source boundary trace fields map from Stage 6-C review gate", () => {
    const report = evaluateReadyContract();
    expect(report.sourceReviewGateOnly).toBe(true);
    expect(report.sourceCandidateOnly).toBe(true);
    expect(report.sourceNoRunBoundarySatisfied).toBe(true);
    expect(report.sourcePersistenceBoundarySatisfied).toBe(true);
    expect(report.sourceSchemaMigrationBoundarySatisfied).toBe(true);
  });

  it("contract builder references source.reviewedModelKinds", () => {
    const source = readyReviewGate();
    const contracts = buildRuntimeExecutionContractCandidates(source);
    expect(contracts.length).toBe(source.reviewedModelKinds.length);
    expect(contracts.every((contract) => source.reviewedModelKinds.includes(contract.modelKind as never))).toBe(true);
  });

  it("sourceReviewedModelKinds is exposed on report", () => {
    const source = readyReviewGate();
    const report = evaluateReadyContract();
    expect(report.sourceReviewedModelKinds).toEqual(source.reviewedModelKinds);
  });

  it("sourceReviewedModelCount is exposed on report", () => {
    expect(evaluateReadyContract().sourceReviewedModelCount).toBe(7);
  });

  it("sourceReviewedFieldCount is exposed on report", () => {
    expect(evaluateReadyContract().sourceReviewedFieldCount).toBeGreaterThan(0);
  });

  it("sourceForbiddenFieldDetected true yields blocked", () => {
    expect(resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ sourceForbiddenFieldDetected: true }))).toBe(
      "blocked",
    );
  });

  it("sourceActualExecutionWireAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(
        readyDecisionInput({ sourceActualExecutionWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualPersistenceAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(
        readyDecisionInput({ sourceActualPersistenceAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualExternalSideEffectAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(
        readyDecisionInput({ sourceActualExternalSideEffectAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualSchemaMigrationAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionContractCandidateDecision(
        readyDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceReviewedModelCount less than 7 yields blocked", () => {
    expect(resolveRuntimeExecutionContractCandidateDecision(readyDecisionInput({ sourceReviewedModelCount: 6 }))).toBe(
      "blocked",
    );
  });

  it("contractCandidateValidation.valid is true on ready path", () => {
    expect(evaluateReadyContract().contractCandidateValidation.valid).toBe(true);
  });

  it("validation detects missing contract id", () => {
    const contracts = buildRuntimeExecutionContractCandidates(readyReviewGate()).slice(0, 6);
    const validation = validateRuntimeExecutionContractCandidateDetails(contracts);
    expect(validation.valid).toBe(false);
    expect(validation.missingContractIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate contract id", () => {
    const contracts = buildRuntimeExecutionContractCandidates(readyReviewGate());
    const validation = validateRuntimeExecutionContractCandidateDetails([
      contracts[0],
      { ...contracts[1], contractId: contracts[0].contractId },
      ...contracts.slice(2),
    ]);
    expect(validation.valid).toBe(false);
    expect(validation.duplicateContractIds).toContain(contracts[0].contractId);
  });

  it("validation detects empty required field contract id", () => {
    const contracts = buildRuntimeExecutionContractCandidates(readyReviewGate());
    const invalid = { ...contracts[0], requiredFields: [] };
    const validation = validateRuntimeExecutionContractCandidateDetails([invalid, ...contracts.slice(1)]);
    expect(validation.valid).toBe(false);
    expect(validation.emptyRequiredFieldContractIds).toContain(contracts[0].contractId);
  });

  it("validation detects implementedInThisStep true contract id", () => {
    const contracts = buildRuntimeExecutionContractCandidates(readyReviewGate());
    const invalid = {
      ...contracts[0],
      implementedInThisStep: true,
    } as RuntimeExecutionContractCandidateItem;
    const validation = validateRuntimeExecutionContractCandidateDetails([invalid, ...contracts.slice(1)]);
    expect(validation.valid).toBe(false);
    expect(validation.implementedInThisStepContractIds).toContain(contracts[0].contractId);
  });

  it("ready finding includes source_review_gate_trace_copied", () => {
    expect(evaluateReadyContract().findings.some((f) => f.code === "source_review_gate_trace_copied")).toBe(true);
  });

  it("ready finding includes runtime_contract_candidate_validation_passed", () => {
    expect(
      evaluateReadyContract().findings.some((f) => f.code === "runtime_contract_candidate_validation_passed"),
    ).toBe(true);
  });

  it("contractCandidateFingerprint includes sourceModels sourceFields sourceForbidden segments", () => {
    const fingerprint = evaluateReadyContract().contractCandidateFingerprint;
    expect(fingerprint).toContain("sourceModels:7");
    expect(fingerprint).toContain("sourceFields:");
    expect(fingerprint).toContain("sourceForbidden:false");
  });
});

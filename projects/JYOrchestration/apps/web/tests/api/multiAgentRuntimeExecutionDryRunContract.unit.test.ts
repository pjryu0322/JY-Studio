import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeExecutionDryRunContract,
  resolveRuntimeExecutionDryRunContractDecision,
  validateRuntimeExecutionDryRunContractItemDetails,
} from "@/lib/agents/evaluateRuntimeExecutionDryRunContract";
import { validateRuntimeExecutionDryRunContractItems } from "@/lib/agents/runtimeExecutionDryRunContractSupport";
import {
  buildStage6CReadyReviewGateInput,
  buildStage6DContractCandidateConfirmedInput,
  buildStage6DReadyContractCandidateInput,
  buildStage6EDryRunContractConfirmedInput,
  buildStage6EReadyDryRunContractInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type {
  RuntimeExecutionDryRunContractDecisionInput,
  RuntimeExecutionDryRunContractItem,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

function readyDryRunDecisionInput(
  overrides: Partial<RuntimeExecutionDryRunContractDecisionInput> = {},
): RuntimeExecutionDryRunContractDecisionInput {
  return {
    sourceContractCandidateDecision: "ready_for_runtime_execution_dry_run_contract",
    sourceReviewGateOnly: true,
    sourceCandidateOnly: true,
    sourceContractCandidateOnly: true,
    sourceContractCandidateValidationValid: true,
    sourceForbiddenFieldDetected: false,
    sourceActualRuntimeExecutionAllowedInThisStep: false,
    sourceActualExecutionRunnerAllowedInThisStep: false,
    sourceActualExecutionWireAllowedInThisStep: false,
    sourceActualPersistenceAllowedInThisStep: false,
    sourceActualExternalSideEffectAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualCursorGithubWireAllowedInThisStep: false,
    sourceActualConnectorRoutingChangeAllowedInThisStep: false,
    sourceNoRunBoundarySatisfied: true,
    sourcePersistenceBoundarySatisfied: true,
    sourceSchemaMigrationBoundarySatisfied: true,
    sourceContractCandidateCount: 7,
    confirmationsSatisfied: true,
    dryRunContractItemsValid: true,
    ...overrides,
  };
}

function evaluateReadyDryRun(input: Parameters<typeof evaluateRuntimeExecutionDryRunContract>[0] = {}) {
  return evaluateRuntimeExecutionDryRunContract({ ...buildStage6EReadyDryRunContractInput(), ...input });
}

describe("multi-agent runtime execution dry-run contract stage 6-E", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionDryRunContract().decision).toBe("defer");
  });

  it("source Stage 6-D blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionDryRunContract({
        contractCandidate: {
          reviewGate: { modelCandidate: { baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } } } },
          ...buildStage6DContractCandidateConfirmedInput(),
        },
        ...buildStage6EDryRunContractConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 6-D defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionDryRunContract({
        contractCandidate: buildStage6DReadyContractCandidateInput(),
        runtimeExecutionDryRunContractConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 6-D ready with five confirmations yields ready_for_runtime_execution_contract_closure", () => {
    expect(evaluateReadyDryRun().decision).toBe("ready_for_runtime_execution_contract_closure");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionDryRunContract({
        ...buildStage6EReadyDryRunContractInput(),
        runtimeExecutionDryRunNoRunnerConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionDryRunContractDecision blocks when sourceContractCandidateOnly is false", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(readyDryRunDecisionInput({ sourceContractCandidateOnly: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionDryRunContractDecision blocks when sourceNoRunBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(readyDryRunDecisionInput({ sourceNoRunBoundarySatisfied: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionDryRunContractDecision blocks when sourcePersistenceBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourcePersistenceBoundarySatisfied: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionDryRunContractDecision blocks when sourceSchemaMigrationBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceSchemaMigrationBoundarySatisfied: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionDryRunContractDecision blocks when sourceContractCandidateCount is less than 7", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(readyDryRunDecisionInput({ sourceContractCandidateCount: 6 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionDryRunContractDecision blocks when dryRunContractItemsValid is false", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(readyDryRunDecisionInput({ dryRunContractItemsValid: false })),
    ).toBe("blocked");
  });

  it("dryRunContractOnly is true", () => {
    expect(evaluateReadyDryRun().dryRunContractOnly).toBe(true);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualExecutionRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualExecutionRunnerAllowedInThisStep).toBe(false);
  });

  it("actualDryRunRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualDryRunRunnerAllowedInThisStep).toBe(false);
  });

  it("actualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("actualCursorGithubWireAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualCursorGithubWireAllowedInThisStep).toBe(false);
  });

  it("actualConnectorRoutingChangeAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualConnectorRoutingChangeAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("dryRunContractItemCount is 7", () => {
    expect(evaluateReadyDryRun().dryRunContractItemCount).toBe(7);
  });

  it("dryRunScenarioCount is at least 7", () => {
    expect(evaluateReadyDryRun().dryRunScenarioCount).toBeGreaterThanOrEqual(7);
  });

  it("dryRunAssertionCount is at least 14", () => {
    expect(evaluateReadyDryRun().dryRunAssertionCount).toBeGreaterThanOrEqual(14);
  });

  it("dryRunChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyDryRun().dryRunChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("boundaryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyDryRun().boundaryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("recommendedNextPhases includes stage_6_f_runtime_execution_contract_closure", () => {
    expect(evaluateReadyDryRun().recommendedNextPhases).toContain("stage_6_f_runtime_execution_contract_closure");
  });

  it("separatedWorkItems includes actual_dry_run_runner", () => {
    expect(evaluateReadyDryRun().separatedWorkItems).toContain("actual_dry_run_runner");
  });

  it("findings include runtime_execution_dry_run_contract_only", () => {
    expect(
      evaluateReadyDryRun().findings.some((f) => f.code === "runtime_execution_dry_run_contract_only"),
    ).toBe(true);
  });

  it("ready findings include runtime_execution_contract_closure_ready", () => {
    expect(
      evaluateReadyDryRun().findings.some((f) => f.code === "runtime_execution_contract_closure_ready"),
    ).toBe(true);
  });

  it("dryRunContractFingerprint is deterministic", () => {
    const first = evaluateReadyDryRun();
    const second = evaluateReadyDryRun();
    expect(first.dryRunContractFingerprint).toBe(second.dryRunContractFingerprint);
  });

  it("dryRunContractFingerprint includes items scenarios assertions noRun persistence schema segments", () => {
    const fingerprint = evaluateReadyDryRun().dryRunContractFingerprint;
    expect(fingerprint).toContain("items:7");
    expect(fingerprint).toContain("scenarios:7");
    expect(fingerprint).toContain("assertions:");
    expect(fingerprint).toContain("noRun:true");
    expect(fingerprint).toContain("persistence:true");
    expect(fingerprint).toContain("schema:true");
  });

  it("validateRuntimeExecutionDryRunContractItems rejects incomplete items", () => {
    const items = evaluateReadyDryRun().dryRunContractItems.slice(0, 6);
    expect(validateRuntimeExecutionDryRunContractItems(items)).toBe(false);
  });

  it("ready path chains Stage 6-C review gate through contract candidate", () => {
    const report = evaluateRuntimeExecutionDryRunContract({
      contractCandidate: {
        reviewGate: buildStage6CReadyReviewGateInput(),
        ...buildStage6DContractCandidateConfirmedInput(),
      },
      ...buildStage6EDryRunContractConfirmedInput(),
    });
    expect(report.decision).toBe("ready_for_runtime_execution_contract_closure");
    expect(report.sourceContractCandidateCount).toBe(7);
  });

  it("source trace fields are exposed on report", () => {
    const report = evaluateReadyDryRun();
    expect(report.sourceReviewGateDecision).toBe("ready_for_runtime_execution_contract_candidate");
    expect(report.sourceReviewGateOnly).toBe(true);
    expect(report.sourceCandidateOnly).toBe(true);
    expect(report.sourceReviewedModelCount).toBe(7);
    expect(report.sourceReviewedFieldCount).toBeGreaterThan(0);
    expect(report.sourceContractCandidateValidationValid).toBe(true);
  });

  it("sourceContractCandidateValidationValid false yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceContractCandidateValidationValid: false }),
      ),
    ).toBe("blocked");
  });

  it("sourceForbiddenFieldDetected true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(readyDryRunDecisionInput({ sourceForbiddenFieldDetected: true })),
    ).toBe("blocked");
  });

  it("sourceActualRuntimeExecutionAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualRuntimeExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualExecutionRunnerAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualExecutionRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualExecutionWireAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualExecutionWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualPersistenceAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualPersistenceAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualExternalSideEffectAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualExternalSideEffectAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualSchemaMigrationAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualCursorGithubWireAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualCursorGithubWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("sourceActualConnectorRoutingChangeAllowedInThisStep true yields blocked", () => {
    expect(
      resolveRuntimeExecutionDryRunContractDecision(
        readyDryRunDecisionInput({ sourceActualConnectorRoutingChangeAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("dryRunContractValidation.valid is true on ready path", () => {
    expect(evaluateReadyDryRun().dryRunContractValidation.valid).toBe(true);
  });

  it("validation detects missing dry-run contract id", () => {
    const items = evaluateReadyDryRun().dryRunContractItems.slice(0, 6);
    const validation = validateRuntimeExecutionDryRunContractItemDetails(items);
    expect(validation.valid).toBe(false);
    expect(validation.missingDryRunContractIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate dry-run contract id", () => {
    const items = evaluateReadyDryRun().dryRunContractItems;
    const validation = validateRuntimeExecutionDryRunContractItemDetails([
      items[0],
      { ...items[1], dryRunContractId: items[0].dryRunContractId },
      ...items.slice(2),
    ]);
    expect(validation.valid).toBe(false);
    expect(validation.duplicateDryRunContractIds).toContain(items[0].dryRunContractId);
  });

  it("validation detects insufficient assertions", () => {
    const items = evaluateReadyDryRun().dryRunContractItems;
    const invalid = { ...items[0], expectedAssertions: [items[0].expectedAssertions[0]] };
    const validation = validateRuntimeExecutionDryRunContractItemDetails([invalid, ...items.slice(1)]);
    expect(validation.valid).toBe(false);
    expect(validation.insufficientAssertionContractIds).toContain(items[0].dryRunContractId);
  });

  it("validation detects implementedInThisStep true", () => {
    const items = evaluateReadyDryRun().dryRunContractItems;
    const invalid = { ...items[0], implementedInThisStep: true } as RuntimeExecutionDryRunContractItem;
    const validation = validateRuntimeExecutionDryRunContractItemDetails([invalid, ...items.slice(1)]);
    expect(validation.valid).toBe(false);
    expect(validation.implementedInThisStepContractIds).toContain(items[0].dryRunContractId);
  });

  it("ready finding includes source_contract_candidate_trace_copied", () => {
    expect(
      evaluateReadyDryRun().findings.some((f) => f.code === "source_contract_candidate_trace_copied"),
    ).toBe(true);
  });

  it("ready finding includes source_contract_candidate_validation_passed", () => {
    expect(
      evaluateReadyDryRun().findings.some((f) => f.code === "source_contract_candidate_validation_passed"),
    ).toBe(true);
  });

  it("ready finding includes dry_run_contract_validation_passed", () => {
    expect(
      evaluateReadyDryRun().findings.some((f) => f.code === "dry_run_contract_validation_passed"),
    ).toBe(true);
  });

  it("dryRunContractFingerprint includes sourceCandidateOnly sourceValidation sourceForbidden actualRuntime actualWire actualPersistence", () => {
    const fingerprint = evaluateReadyDryRun().dryRunContractFingerprint;
    expect(fingerprint).toContain("sourceCandidateOnly:true");
    expect(fingerprint).toContain("sourceValidation:true");
    expect(fingerprint).toContain("sourceForbidden:false");
    expect(fingerprint).toContain("actualRuntime:false");
    expect(fingerprint).toContain("actualDryRunRunner:false");
    expect(fingerprint).toContain("actualWire:false");
    expect(fingerprint).toContain("actualPersistence:false");
  });
});

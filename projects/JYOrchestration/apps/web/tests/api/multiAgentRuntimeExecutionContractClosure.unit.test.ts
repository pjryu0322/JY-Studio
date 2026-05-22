import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeExecutionContractClosure,
  resolveRuntimeExecutionContractClosureDecision,
} from "@/lib/agents/evaluateRuntimeExecutionContractClosure";
import {
  buildStage6EDryRunContractConfirmedInput,
  buildStage6EReadyDryRunContractInput,
  buildStage6FReadyContractClosureInput,
  buildStage6FRuntimeExecutionContractClosureConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { RuntimeExecutionContractClosureDecisionInput } from "@/lib/agents/runtimeExecutionContractClosureTypes";

function readyClosureDecisionInput(
  overrides: Partial<RuntimeExecutionContractClosureDecisionInput> = {},
): RuntimeExecutionContractClosureDecisionInput {
  return {
    sourceDryRunContractDecision: "ready_for_runtime_execution_contract_closure",
    sourceDryRunContractOnly: true,
    sourceDryRunContractValidationValid: true,
    sourceNoRunBoundarySatisfied: true,
    sourcePersistenceBoundarySatisfied: true,
    sourceSchemaMigrationBoundarySatisfied: true,
    sourceActualRuntimeExecutionAllowedInThisStep: false,
    sourceActualExecutionRunnerAllowedInThisStep: false,
    sourceActualDryRunRunnerAllowedInThisStep: false,
    sourceActualExecutionWireAllowedInThisStep: false,
    sourceActualPersistenceAllowedInThisStep: false,
    sourceActualExternalSideEffectAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualCursorGithubWireAllowedInThisStep: false,
    sourceActualConnectorRoutingChangeAllowedInThisStep: false,
    sourceDryRunContractItemCount: 7,
    sourceDryRunScenarioCount: 7,
    sourceDryRunAssertionCount: 14,
    confirmationsSatisfied: true,
    ...overrides,
  };
}

function evaluateReadyClosure(input: Parameters<typeof evaluateRuntimeExecutionContractClosure>[0] = {}) {
  return evaluateRuntimeExecutionContractClosure({ ...buildStage6FReadyContractClosureInput(), ...input });
}

describe("multi-agent runtime execution contract closure stage 6-F", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionContractClosure().decision).toBe("defer");
  });

  it("source Stage 6-E blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionContractClosure({
        dryRunContract: {
          contractCandidate: {
            reviewGate: { modelCandidate: { baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } } } },
          },
          ...buildStage6EDryRunContractConfirmedInput(),
        },
        ...buildStage6FRuntimeExecutionContractClosureConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 6-E defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionContractClosure({
        dryRunContract: buildStage6EReadyDryRunContractInput(),
        runtimeExecutionContractClosureConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source Stage 6-E ready with five confirmations yields stage6_runtime_execution_contract_closed", () => {
    expect(evaluateReadyClosure().decision).toBe("stage6_runtime_execution_contract_closed");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionContractClosure({
        ...buildStage6FReadyContractClosureInput(),
        runtimeExecutionStage7HandoffReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceDryRunContractOnly is false", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(readyClosureDecisionInput({ sourceDryRunContractOnly: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceDryRunContractValidationValid is false", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceDryRunContractValidationValid: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceNoRunBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(readyClosureDecisionInput({ sourceNoRunBoundarySatisfied: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourcePersistenceBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourcePersistenceBoundarySatisfied: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceSchemaMigrationBoundarySatisfied is false", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceSchemaMigrationBoundarySatisfied: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceDryRunContractItemCount is less than 7", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(readyClosureDecisionInput({ sourceDryRunContractItemCount: 6 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceDryRunScenarioCount is less than 7", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(readyClosureDecisionInput({ sourceDryRunScenarioCount: 6 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceDryRunAssertionCount is less than 14", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(readyClosureDecisionInput({ sourceDryRunAssertionCount: 13 })),
    ).toBe("blocked");
  });

  it("stage6ClosureOnly is true", () => {
    expect(evaluateReadyClosure().stage6ClosureOnly).toBe(true);
  });

  it("actualRuntimeExecutionAllowedAfterStage6 is false", () => {
    expect(evaluateReadyClosure().actualRuntimeExecutionAllowedAfterStage6).toBe(false);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualExecutionRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualExecutionRunnerAllowedInThisStep).toBe(false);
  });

  it("actualDryRunRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualDryRunRunnerAllowedInThisStep).toBe(false);
  });

  it("actualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("actualCursorGithubWireAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualCursorGithubWireAllowedInThisStep).toBe(false);
  });

  it("actualConnectorRoutingChangeAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualConnectorRoutingChangeAllowedInThisStep).toBe(false);
  });

  it("closedStages includes Stage 6-A through 6-E", () => {
    const closedStages = evaluateReadyClosure().closedStages;
    expect(closedStages).toContain("stage_6_a_runtime_execution_model_baseline");
    expect(closedStages).toContain("stage_6_b_runtime_execution_model_candidate");
    expect(closedStages).toContain("stage_6_c_runtime_execution_model_review_gate");
    expect(closedStages).toContain("stage_6_d_runtime_execution_contract_candidate");
    expect(closedStages).toContain("stage_6_e_runtime_execution_dry_run_contract");
  });

  it("separatedWorkItems includes actual_runtime_execution_api", () => {
    expect(evaluateReadyClosure().separatedWorkItems).toContain("actual_runtime_execution_api");
  });

  it("separatedWorkItems includes actual_dry_run_runner", () => {
    expect(evaluateReadyClosure().separatedWorkItems).toContain("actual_dry_run_runner");
  });

  it("recommendedNextPhases includes stage_7_runtime_execution_implementation_pr_planning", () => {
    expect(evaluateReadyClosure().recommendedNextPhases).toContain(
      "stage_7_runtime_execution_implementation_pr_planning",
    );
  });

  it("closureChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyClosure().closureChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("boundaryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyClosure().boundaryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("handoffChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyClosure().handoffChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("ready findings include stage6_chain_closed", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage6_chain_closed")).toBe(true);
  });

  it("ready findings include stage7_requires_separate_approval", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage7_requires_separate_approval")).toBe(true);
  });

  it("closureFingerprint is deterministic", () => {
    const first = evaluateReadyClosure();
    const second = evaluateReadyClosure();
    expect(first.closureFingerprint).toBe(second.closureFingerprint);
  });

  it("closureFingerprint includes closedStages confirmations noRun persistence schema segments", () => {
    const fingerprint = evaluateReadyClosure().closureFingerprint;
    expect(fingerprint).toContain("closedStages:5");
    expect(fingerprint).toContain("confirmations:");
    expect(fingerprint).toContain("noRun:true");
    expect(fingerprint).toContain("persistence:true");
    expect(fingerprint).toContain("schema:true");
  });

  it("stage6ContractClosed is true on ready path", () => {
    expect(evaluateReadyClosure().stage6ContractClosed).toBe(true);
  });

  it("report exposes source boundary trace fields", () => {
    const report = evaluateReadyClosure();
    expect(report.sourceNoRunBoundarySatisfied).toBe(true);
    expect(report.sourcePersistenceBoundarySatisfied).toBe(true);
    expect(report.sourceSchemaMigrationBoundarySatisfied).toBe(true);
    expect(report.sourceActualRuntimeExecutionAllowedInThisStep).toBe(false);
    expect(report.sourceActualExecutionRunnerAllowedInThisStep).toBe(false);
    expect(report.sourceActualDryRunRunnerAllowedInThisStep).toBe(false);
    expect(report.sourceActualExecutionWireAllowedInThisStep).toBe(false);
    expect(report.sourceActualPersistenceAllowedInThisStep).toBe(false);
    expect(report.sourceActualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceActualRuntimeExecutionAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceActualRuntimeExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceActualExecutionRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceActualExecutionRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceActualDryRunRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceActualDryRunRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceActualExecutionWireAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceActualExecutionWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceActualPersistenceAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceActualPersistenceAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionContractClosureDecision blocks when sourceActualSchemaMigrationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionContractClosureDecision(
        readyClosureDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("closureFingerprint includes source actual boundary segments", () => {
    const fingerprint = evaluateReadyClosure().closureFingerprint;
    expect(fingerprint).toContain("sourceActualRuntime:false");
    expect(fingerprint).toContain("sourceActualRunner:false");
    expect(fingerprint).toContain("sourceActualDryRunRunner:false");
    expect(fingerprint).toContain("sourceActualWire:false");
    expect(fingerprint).toContain("sourceActualPersistence:false");
    expect(fingerprint).toContain("sourceActualSchema:false");
    expect(fingerprint).toContain("sourceActualConnectorRouting:false");
  });

  it("ready findings include source_dry_run_contract_trace_copied", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "source_dry_run_contract_trace_copied")).toBe(true);
  });

  it("ready findings include stage6_contract_closure_fingerprint_created", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage6_contract_closure_fingerprint_created")).toBe(
      true,
    );
  });
});

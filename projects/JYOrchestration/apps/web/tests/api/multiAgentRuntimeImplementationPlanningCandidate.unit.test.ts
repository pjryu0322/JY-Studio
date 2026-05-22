import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeImplementationPlanningCandidate,
  resolveRuntimeImplementationPlanningCandidateDecision,
  validateRuntimeImplementationPlanningItems,
} from "@/lib/agents/evaluateRuntimeImplementationPlanningCandidate";
import { buildRuntimeImplementationPlanningItems } from "@/lib/agents/runtimeImplementationPlanningCandidateSupport";
import {
  buildStage6FReadyContractClosureInput,
  buildStage6FRuntimeExecutionContractClosureConfirmedInput,
  buildStage7AImplementationPlanningConfirmedInput,
  buildStage7AReadyImplementationPlanningInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { RuntimeImplementationPlanningCandidateDecisionInput } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import type { RuntimeImplementationPlanningItem } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import { evaluateRuntimeExecutionContractClosure } from "@/lib/agents/evaluateRuntimeExecutionContractClosure";

function readyPlanningDecisionInput(
  overrides: Partial<RuntimeImplementationPlanningCandidateDecisionInput> = {},
): RuntimeImplementationPlanningCandidateDecisionInput {
  return {
    sourceContractClosureDecision: "stage6_runtime_execution_contract_closed",
    sourceStage6ContractClosed: true,
    sourceStage6ClosureOnly: true,
    sourceActualRuntimeExecutionAllowedAfterStage6: false,
    sourceActualRuntimeExecutionAllowedInThisStep: false,
    sourceActualExecutionRunnerAllowedInThisStep: false,
    sourceActualDryRunRunnerAllowedInThisStep: false,
    sourceActualExecutionWireAllowedInThisStep: false,
    sourceActualPersistenceAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualExternalSideEffectAllowedInThisStep: false,
    sourceActualCursorGithubWireAllowedInThisStep: false,
    sourceActualConnectorRoutingChangeAllowedInThisStep: false,
    planningItemsValid: true,
    confirmationsSatisfied: true,
    ...overrides,
  };
}

function evaluateReadyPlanning(
  input: Parameters<typeof evaluateRuntimeImplementationPlanningCandidate>[0] = {},
) {
  return evaluateRuntimeImplementationPlanningCandidate({
    ...buildStage7AReadyImplementationPlanningInput(),
    ...input,
  });
}

describe("multi-agent runtime implementation planning candidate stage 7-A", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeImplementationPlanningCandidate().decision).toBe("defer");
  });

  it("source Stage 6-F blocked propagates blocked", () => {
    expect(
      evaluateRuntimeImplementationPlanningCandidate({
        contractClosure: {
          dryRunContract: {
            contractCandidate: {
              reviewGate: {
                modelCandidate: { baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } } },
              },
            },
          },
          ...buildStage6FRuntimeExecutionContractClosureConfirmedInput(),
        },
        ...buildStage7AImplementationPlanningConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 6-F defer propagates defer", () => {
    expect(
      evaluateRuntimeImplementationPlanningCandidate({
        contractClosure: buildStage6FReadyContractClosureInput(),
        runtimeImplementationPlanningReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source Stage 6-F closed with five confirmations yields ready_for_runtime_implementation_pr_planning", () => {
    expect(evaluateReadyPlanning().decision).toBe("ready_for_runtime_implementation_pr_planning");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeImplementationPlanningCandidate({
        ...buildStage7AReadyImplementationPlanningInput(),
        runtimeImplementationOperatorApprovalRequiredConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceStage6ContractClosed is false", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceStage6ContractClosed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceStage6ClosureOnly is false", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(readyPlanningDecisionInput({ sourceStage6ClosureOnly: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualRuntimeExecutionAllowedAfterStage6 is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualRuntimeExecutionAllowedAfterStage6: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualRuntimeExecutionAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualRuntimeExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualExecutionRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualExecutionRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualDryRunRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualDryRunRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualExecutionWireAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualExecutionWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualPersistenceAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualPersistenceAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualSchemaMigrationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("planningItems has 10 entries on ready path", () => {
    expect(evaluateReadyPlanning().planningItems).toHaveLength(10);
  });

  it("planningItems are all candidateOnly true", () => {
    expect(evaluateReadyPlanning().planningItems.every((item) => item.candidateOnly === true)).toBe(true);
  });

  it("planningItems are all implementedInThisStep false", () => {
    expect(evaluateReadyPlanning().planningItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("planning items validation is valid on ready path", () => {
    const items = evaluateReadyPlanning().planningItems;
    expect(validateRuntimeImplementationPlanningItems(items).valid).toBe(true);
  });

  it("validation detects missing planning item id", () => {
    const items = evaluateReadyPlanning().planningItems.slice(1);
    expect(validateRuntimeImplementationPlanningItems(items).missingPlanningItemIds.length).toBeGreaterThan(0);
    expect(validateRuntimeImplementationPlanningItems(items).valid).toBe(false);
  });

  it("validation detects duplicate planning item id", () => {
    const items = evaluateReadyPlanning().planningItems;
    const duplicate: RuntimeImplementationPlanningItem = { ...items[0] };
    expect(validateRuntimeImplementationPlanningItems([...items, duplicate]).duplicatePlanningItemIds.length).toBe(1);
  });

  it("validation detects empty approvals", () => {
    const items = evaluateReadyPlanning().planningItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateRuntimeImplementationPlanningItems([invalid]).emptyApprovalItemIds).toContain(items[0].planningItemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyPlanning().planningItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateRuntimeImplementationPlanningItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].planningItemId,
    );
  });

  it("planningChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyPlanning().planningChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("boundaryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyPlanning().boundaryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("approvalChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyPlanning().approvalChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyPlanning().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualExecutionRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyPlanning().actualExecutionRunnerAllowedInThisStep).toBe(false);
  });

  it("actualDryRunRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyPlanning().actualDryRunRunnerAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyPlanning().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyPlanning().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("recommendedNextPhases includes stage_7_b_runtime_api_contract_design", () => {
    expect(evaluateReadyPlanning().recommendedNextPhases).toContain("stage_7_b_runtime_api_contract_design");
  });

  it("separatedWorkItems includes actual_runtime_execution_api", () => {
    expect(evaluateReadyPlanning().separatedWorkItems).toContain("actual_runtime_execution_api");
  });

  it("separatedWorkItems includes actual_execution_runner", () => {
    expect(evaluateReadyPlanning().separatedWorkItems).toContain("actual_execution_runner");
  });

  it("separatedWorkItems includes actual_dry_run_runner", () => {
    expect(evaluateReadyPlanning().separatedWorkItems).toContain("actual_dry_run_runner");
  });

  it("ready findings include stage7_a_planning_candidate_ready", () => {
    expect(evaluateReadyPlanning().findings.some((f) => f.code === "stage7_a_planning_candidate_ready")).toBe(true);
  });

  it("planningFingerprint is deterministic", () => {
    const first = evaluateReadyPlanning();
    const second = evaluateReadyPlanning();
    expect(first.planningFingerprint).toBe(second.planningFingerprint);
  });

  it("planningFingerprint includes source closure fingerprint planning item count and confirmation count", () => {
    const report = evaluateReadyPlanning();
    expect(report.planningFingerprint).toContain(report.sourceContractClosureFingerprint);
    expect(report.planningFingerprint).toContain("planningItems:10");
    expect(report.planningFingerprint).toContain("confirmations:5");
  });

  it("buildRuntimeImplementationPlanningItems returns empty when source not closed", () => {
    const source = evaluateRuntimeExecutionContractClosure();
    expect(buildRuntimeImplementationPlanningItems(source)).toEqual([]);
  });

  it("report exposes source actual boundary trace fields", () => {
    const report = evaluateReadyPlanning();
    expect(report.sourceActualRuntimeExecutionAllowedInThisStep).toBe(false);
    expect(report.sourceActualExecutionRunnerAllowedInThisStep).toBe(false);
    expect(report.sourceActualDryRunRunnerAllowedInThisStep).toBe(false);
    expect(report.sourceActualExecutionWireAllowedInThisStep).toBe(false);
    expect(report.sourceActualPersistenceAllowedInThisStep).toBe(false);
    expect(report.sourceActualExternalSideEffectAllowedInThisStep).toBe(false);
    expect(report.sourceActualSchemaMigrationAllowedInThisStep).toBe(false);
    expect(report.sourceActualCursorGithubWireAllowedInThisStep).toBe(false);
    expect(report.sourceActualConnectorRoutingChangeAllowedInThisStep).toBe(false);
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualExternalSideEffectAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualExternalSideEffectAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualCursorGithubWireAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualCursorGithubWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeImplementationPlanningCandidateDecision blocks when sourceActualConnectorRoutingChangeAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeImplementationPlanningCandidateDecision(
        readyPlanningDecisionInput({ sourceActualConnectorRoutingChangeAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("broken source actual boundary yields empty planningItems", () => {
    const closed = evaluateRuntimeExecutionContractClosure(buildStage6FReadyContractClosureInput());
    const broken = { ...closed, actualRuntimeExecutionAllowedInThisStep: true };
    expect(buildRuntimeImplementationPlanningItems(broken)).toEqual([]);
  });

  it("validation detects unknown dependency", () => {
    const items = evaluateReadyPlanning().planningItems;
    const invalid = { ...items[1], dependsOn: ["unknown-planning-item"] };
    expect(validateRuntimeImplementationPlanningItems([invalid]).unknownDependencyItemIds).toContain(
      items[1].planningItemId,
    );
  });

  it("validation detects self dependency", () => {
    const items = evaluateReadyPlanning().planningItems;
    const invalid = { ...items[0], dependsOn: [items[0].planningItemId] };
    expect(validateRuntimeImplementationPlanningItems([invalid]).selfDependencyItemIds).toContain(items[0].planningItemId);
  });

  it("validation detects missing dependency", () => {
    const items = evaluateReadyPlanning().planningItems;
    const invalid = { ...items[1], dependsOn: [] as string[] };
    expect(validateRuntimeImplementationPlanningItems([invalid]).missingDependencyItemIds).toContain(items[1].planningItemId);
  });

  it("validation detects forbidden boundary coverage missing", () => {
    const items = evaluateReadyPlanning().planningItems;
    const invalid = { ...items[0], forbiddenInThisStep: ["other_forbidden"] };
    expect(validateRuntimeImplementationPlanningItems([invalid]).forbiddenBoundaryCoverageMissingItemIds).toContain(
      items[0].planningItemId,
    );
  });

  it("planningFingerprint includes source actual boundary and planningValid segments", () => {
    const fingerprint = evaluateReadyPlanning().planningFingerprint;
    expect(fingerprint).toContain("sourceActualRuntime:false");
    expect(fingerprint).toContain("sourceActualRunner:false");
    expect(fingerprint).toContain("sourceActualDryRunRunner:false");
    expect(fingerprint).toContain("sourceActualWire:false");
    expect(fingerprint).toContain("sourceActualPersistence:false");
    expect(fingerprint).toContain("sourceActualSchema:false");
    expect(fingerprint).toContain("sourceActualCursorGithub:false");
    expect(fingerprint).toContain("sourceActualConnectorRouting:false");
    expect(fingerprint).toContain("planningValid:true");
  });

  it("ready findings include source_contract_closure_trace_copied", () => {
    expect(evaluateReadyPlanning().findings.some((f) => f.code === "source_contract_closure_trace_copied")).toBe(true);
  });

  it("ready findings include planning_dependency_validation_passed", () => {
    expect(evaluateReadyPlanning().findings.some((f) => f.code === "planning_dependency_validation_passed")).toBe(true);
  });

  it("ready findings include planning_forbidden_boundary_validation_passed", () => {
    expect(evaluateReadyPlanning().findings.some((f) => f.code === "planning_forbidden_boundary_validation_passed")).toBe(
      true,
    );
  });
});

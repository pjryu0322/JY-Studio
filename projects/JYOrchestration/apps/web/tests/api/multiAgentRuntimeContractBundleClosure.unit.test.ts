import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeContractBundleClosure,
  resolveRuntimeContractBundleClosureDecision,
  validateRuntimeContractBundleItems,
  buildRuntimeContractBundleItems,
} from "@/lib/agents/evaluateRuntimeContractBundleClosure";
import {
  buildStage7BReadyRuntimeApiContractInput,
  buildStage7CContractBundleClosureConfirmedInput,
  buildStage7CReadyContractBundleClosureInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { RuntimeContractBundleClosureDecisionInput } from "@/lib/agents/runtimeContractBundleClosureTypes";
import type { RuntimeContractBundleItem } from "@/lib/agents/runtimeContractBundleClosureTypes";
import { evaluateRuntimeApiContractDesign } from "@/lib/agents/evaluateRuntimeApiContractDesign";

function readyBundleDecisionInput(
  overrides: Partial<RuntimeContractBundleClosureDecisionInput> = {},
): RuntimeContractBundleClosureDecisionInput {
  return {
    sourceApiContractDecision: "ready_for_execution_runner_contract_design",
    sourceEndpointContractCount: 6,
    sourceEndpointDesignOnlyCount: 6,
    sourceImplementedEndpointCount: 0,
    sourceActualRuntimeExecutionAllowedInThisStep: false,
    sourceActualExecutionRunnerAllowedInThisStep: false,
    sourceActualDryRunRunnerAllowedInThisStep: false,
    sourceActualExecutionWireAllowedInThisStep: false,
    sourceActualPersistenceAllowedInThisStep: false,
    sourceActualExternalSideEffectAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualCursorGithubWireAllowedInThisStep: false,
    sourceActualConnectorRoutingChangeAllowedInThisStep: false,
    sourceActualUiImplementationAllowedInThisStep: false,
    bundleItemsValid: true,
    stage8EntryReady: true,
    confirmationsSatisfied: true,
    ...overrides,
  };
}

function evaluateReadyBundle(
  input: Parameters<typeof evaluateRuntimeContractBundleClosure>[0] = {},
) {
  return evaluateRuntimeContractBundleClosure({ ...buildStage7CReadyContractBundleClosureInput(), ...input });
}

describe("multi-agent runtime contract bundle closure stage 7-C", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeContractBundleClosure().decision).toBe("defer");
  });

  it("source Stage 7-B blocked propagates blocked", () => {
    expect(
      evaluateRuntimeContractBundleClosure({
        apiContractDesign: {
          implementationPlanning: {
            contractClosure: {
              dryRunContract: {
                contractCandidate: {
                  reviewGate: {
                    modelCandidate: { baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } } },
                  },
                },
              },
            },
          },
        },
        ...buildStage7CContractBundleClosureConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 7-B defer propagates defer", () => {
    expect(
      evaluateRuntimeContractBundleClosure({
        apiContractDesign: buildStage7BReadyRuntimeApiContractInput(),
        runtimeContractBundleReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source Stage 7-B ready with five confirmations yields stage7_runtime_contract_bundle_closed", () => {
    expect(evaluateReadyBundle().decision).toBe("stage7_runtime_contract_bundle_closed");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeContractBundleClosure({
        ...buildStage7CReadyContractBundleClosureInput(),
        runtimeContractBundleRollbackReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceEndpointContractCount is less than 6", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(readyBundleDecisionInput({ sourceEndpointContractCount: 5 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceEndpointDesignOnlyCount mismatches", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceEndpointDesignOnlyCount: 5, sourceEndpointContractCount: 6 }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceImplementedEndpointCount is not zero", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(readyBundleDecisionInput({ sourceImplementedEndpointCount: 1 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualRuntimeExecutionAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualRuntimeExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualExecutionRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualExecutionRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualDryRunRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualDryRunRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualExecutionWireAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualExecutionWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualPersistenceAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualPersistenceAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualSchemaMigrationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualCursorGithubWireAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualCursorGithubWireAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualConnectorRoutingChangeAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualConnectorRoutingChangeAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeContractBundleClosureDecision blocks when sourceActualUiImplementationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeContractBundleClosureDecision(
        readyBundleDecisionInput({ sourceActualUiImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("bundleItems has 12 entries on ready path", () => {
    expect(evaluateReadyBundle().bundleItems).toHaveLength(12);
  });

  it("bundleItems are all designOnly true", () => {
    expect(evaluateReadyBundle().bundleItems.every((item) => item.designOnly === true)).toBe(true);
  });

  it("bundleItems are all implementedInThisStep false", () => {
    expect(evaluateReadyBundle().bundleItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("validation detects missing bundle item id", () => {
    const items = evaluateReadyBundle().bundleItems.slice(1);
    expect(validateRuntimeContractBundleItems(items).missingBundleItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate bundle item id", () => {
    const items = evaluateReadyBundle().bundleItems;
    const duplicate: RuntimeContractBundleItem = { ...items[0] };
    expect(validateRuntimeContractBundleItems([...items, duplicate]).duplicateBundleItemIds.length).toBe(1);
  });

  it("validation detects implemented item", () => {
    const items = evaluateReadyBundle().bundleItems;
    const invalid = { ...items[0], implementedInThisStep: true as false };
    expect(validateRuntimeContractBundleItems([invalid]).implementedInThisStepItemIds).toContain(items[0].bundleItemId);
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyBundle().bundleItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateRuntimeContractBundleItems([invalid]).emptyApprovalItemIds).toContain(items[0].bundleItemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyBundle().bundleItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateRuntimeContractBundleItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].bundleItemId,
    );
  });

  it("stage8 entry candidate exists", () => {
    expect(
      evaluateReadyBundle().bundleItems.some((item) => item.bundleItemId === "stage8-minimal-vertical-slice-entry"),
    ).toBe(true);
  });

  it("stage8 entry candidate has requiredBeforeStage8 true", () => {
    const stage8Item = evaluateReadyBundle().bundleItems.find(
      (item) => item.bundleItemId === "stage8-minimal-vertical-slice-entry",
    );
    expect(stage8Item?.requiredBeforeStage8).toBe(true);
  });

  it("resolveRuntimeContractBundleClosureDecision defers when stage8EntryReady is false", () => {
    expect(resolveRuntimeContractBundleClosureDecision(readyBundleDecisionInput({ stage8EntryReady: false }))).toBe(
      "defer",
    );
  });

  it("closureChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyBundle().closureChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("boundaryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyBundle().boundaryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("stage8EntryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyBundle().stage8EntryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("stage8EntryCandidate is minimal_runtime_execution_vertical_slice", () => {
    expect(evaluateReadyBundle().stage8EntryCandidate).toBe("minimal_runtime_execution_vertical_slice");
  });

  it("recommendedNextPhases includes stage_8_a_minimal_runtime_execution_vertical_slice", () => {
    expect(evaluateReadyBundle().recommendedNextPhases).toContain("stage_8_a_minimal_runtime_execution_vertical_slice");
  });

  it("separatedWorkItems includes actual_runtime_execution_api", () => {
    expect(evaluateReadyBundle().separatedWorkItems).toContain("actual_runtime_execution_api");
  });

  it("separatedWorkItems includes actual_execution_runner", () => {
    expect(evaluateReadyBundle().separatedWorkItems).toContain("actual_execution_runner");
  });

  it("separatedWorkItems includes actual_dry_run_runner", () => {
    expect(evaluateReadyBundle().separatedWorkItems).toContain("actual_dry_run_runner");
  });

  it("separatedWorkItems includes actual_db_write", () => {
    expect(evaluateReadyBundle().separatedWorkItems).toContain("actual_db_write");
  });

  it("ready findings include stage7_contract_bundle_closed", () => {
    expect(evaluateReadyBundle().findings.some((f) => f.code === "stage7_contract_bundle_closed")).toBe(true);
  });

  it("ready findings include stage8_entry_candidate_defined", () => {
    expect(evaluateReadyBundle().findings.some((f) => f.code === "stage8_entry_candidate_defined")).toBe(true);
  });

  it("bundleFingerprint is deterministic", () => {
    const first = evaluateReadyBundle();
    const second = evaluateReadyBundle();
    expect(first.bundleFingerprint).toBe(second.bundleFingerprint);
  });

  it("bundleFingerprint includes source api fingerprint bundle item count and stage8 candidate count", () => {
    const report = evaluateReadyBundle();
    expect(report.bundleFingerprint).toContain(report.sourceApiContractFingerprint);
    expect(report.bundleFingerprint).toContain("bundleItems:12");
    expect(report.bundleFingerprint).toContain("stage8Candidates:");
  });

  it("buildRuntimeContractBundleItems returns empty when source api not ready", () => {
    const source = evaluateRuntimeApiContractDesign();
    expect(buildRuntimeContractBundleItems(source)).toEqual([]);
  });
});

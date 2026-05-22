import { describe, expect, it } from "vitest";
import {
  evaluateExternalExecutionManualDryRunGate,
  resolveExternalExecutionManualDryRunGateDecision,
  validateExternalExecutionManualDryRunGateItems,
  buildExternalExecutionManualDryRunGateItems,
} from "@/lib/agents/evaluateExternalExecutionManualDryRunGate";
import { evaluateExternalExecutionDryRunPackage } from "@/lib/agents/evaluateExternalExecutionDryRunPackage";
import {
  buildStage10AReadyExternalExecutionAdapterBoundaryInput,
  buildStage11AConfirmedExternalExecutionDryRunPackageInput,
  buildStage11AReadyExternalExecutionDryRunPackageInput,
  buildStage12AConfirmedExternalExecutionManualDryRunGateInput,
  buildStage12AReadyExternalExecutionManualDryRunGateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { ExternalExecutionManualDryRunGateDecisionInput } from "@/lib/agents/externalExecutionManualDryRunGateTypes";
import type { ExternalExecutionManualDryRunGateItem } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

function readyGateDecisionInput(
  overrides: Partial<ExternalExecutionManualDryRunGateDecisionInput> = {},
): ExternalExecutionManualDryRunGateDecisionInput {
  return {
    sourceStage11Decision: "stage11_external_execution_dry_run_package_ready",
    sourceStage12EntryReady: true,
    sourceManualDryRunGateDesignAllowed: true,
    sourceOperatorApprovedDryRunInvocationAllowed: true,
    sourceMockExternalAdapterResultPackageAllowed: true,
    sourceDryRunAuditEventPackageAllowed: true,
    sourceRollbackPlanReviewBeforeActualExecutionAllowed: true,
    sourceStage12ManualGateRequiredBeforeActualExecution: true,
    sourceActualManualExternalInvocationAllowedInThisStep: false,
    sourceActualAdapterSideEffectAllowedInThisStep: false,
    sourceActualAgentRegistryMutationAllowedInThisStep: false,
    validationValid: true,
    stage13EntryReady: true,
    confirmationsSatisfied: true,
    stage13RequiresSeparateApproval: true,
    stage13ImplementationAllowedInThisStep: false,
    ...overrides,
  };
}

function evaluateReadyGate(
  input: Parameters<typeof evaluateExternalExecutionManualDryRunGate>[0] = {},
) {
  return evaluateExternalExecutionManualDryRunGate({
    ...buildStage12AReadyExternalExecutionManualDryRunGateInput(),
    ...input,
  });
}

describe("multi-agent external execution manual dry-run gate stage 12-A", () => {
  it("default input defers", () => {
    expect(evaluateExternalExecutionManualDryRunGate().decision).toBe("defer");
  });

  it("Stage 11-A source defer propagates defer", () => {
    expect(
      evaluateExternalExecutionManualDryRunGate({
        dryRunPackage: {
          ...buildStage11AReadyExternalExecutionDryRunPackageInput(),
          adapterDryRunReviewed: false,
        },
        ...buildStage12AConfirmedExternalExecutionManualDryRunGateInput(),
      }).decision,
    ).toBe("defer");
  });

  it("Stage 11-A source blocked propagates blocked", () => {
    expect(
      evaluateExternalExecutionManualDryRunGate({
        dryRunPackage: {
          adapterBoundary: {
            ...buildStage10AReadyExternalExecutionAdapterBoundaryInput(),
            runtimeMvpClosure: {
              ...buildStage10AReadyExternalExecutionAdapterBoundaryInput().runtimeMvpClosure!,
              apiMvp: {
                ...buildStage10AReadyExternalExecutionAdapterBoundaryInput().runtimeMvpClosure!.apiMvp!,
                runtimeControlBundle: {
                  verticalSlice: {
                    ...buildStage10AReadyExternalExecutionAdapterBoundaryInput().runtimeMvpClosure!.apiMvp!
                      .runtimeControlBundle!.verticalSlice!,
                    request: {
                      ...buildStage10AReadyExternalExecutionAdapterBoundaryInput().runtimeMvpClosure!.apiMvp!
                        .runtimeControlBundle!.verticalSlice!.request!,
                      actualExecutionRequested: true as false,
                    },
                  },
                },
              },
            },
          },
          ...buildStage11AConfirmedExternalExecutionDryRunPackageInput(),
        },
        ...buildStage12AConfirmedExternalExecutionManualDryRunGateInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 11-A ready with eight confirmations yields stage12_external_execution_manual_dry_run_gate_ready", () => {
    expect(evaluateReadyGate().decision).toBe("stage12_external_execution_manual_dry_run_gate_ready");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateExternalExecutionManualDryRunGate({
        ...buildStage12AReadyExternalExecutionManualDryRunGateInput(),
        stage13EntryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveExternalExecutionManualDryRunGateDecision defers when sourceStage12EntryReady is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(readyGateDecisionInput({ sourceStage12EntryReady: false })),
    ).toBe("defer");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceManualDryRunGateDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceManualDryRunGateDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceOperatorApprovedDryRunInvocationAllowed is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceOperatorApprovedDryRunInvocationAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceMockExternalAdapterResultPackageAllowed is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceMockExternalAdapterResultPackageAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceDryRunAuditEventPackageAllowed is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceDryRunAuditEventPackageAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceRollbackPlanReviewBeforeActualExecutionAllowed is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceRollbackPlanReviewBeforeActualExecutionAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceStage12ManualGateRequiredBeforeActualExecution is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceStage12ManualGateRequiredBeforeActualExecution: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceActualManualExternalInvocationAllowedInThisStep is true", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceActualManualExternalInvocationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceActualAdapterSideEffectAllowedInThisStep is true", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceActualAdapterSideEffectAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when sourceActualAgentRegistryMutationAllowedInThisStep is true", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ sourceActualAgentRegistryMutationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("builds eight gate items on ready path", () => {
    expect(evaluateReadyGate().gateItems).toHaveLength(8);
  });

  it("gate items are all manualGateOnly true", () => {
    expect(evaluateReadyGate().gateItems.every((item) => item.manualGateOnly === true)).toBe(true);
  });

  it("gate items are all implementedInThisStep false", () => {
    expect(evaluateReadyGate().gateItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("gate items are all actualExternalInvocationAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.actualExternalInvocationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("gate items are all actualAdapterSideEffectAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.actualAdapterSideEffectAllowedInThisStep === false),
    ).toBe(true);
  });

  it("gate items are all actualCursorExecutionAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.actualCursorExecutionAllowedInThisStep === false),
    ).toBe(true);
  });

  it("gate items are all actualGithubWriteAllowedInThisStep false", () => {
    expect(evaluateReadyGate().gateItems.every((item) => item.actualGithubWriteAllowedInThisStep === false)).toBe(true);
  });

  it("gate items are all actualConnectorGatewayCallAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.actualConnectorGatewayCallAllowedInThisStep === false),
    ).toBe(true);
  });

  it("gate items are all actualDbPersistenceAllowedInThisStep false", () => {
    expect(evaluateReadyGate().gateItems.every((item) => item.actualDbPersistenceAllowedInThisStep === false)).toBe(
      true,
    );
  });

  it("gate items are all actualProductionRunnerAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.actualProductionRunnerAllowedInThisStep === false),
    ).toBe(true);
  });

  it("gate items are all actualUiImplementationAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.actualUiImplementationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("gate items are all agentRegistryMutationAllowedInThisStep false", () => {
    expect(
      evaluateReadyGate().gateItems.every((item) => item.agentRegistryMutationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("validation detects missing gate item id", () => {
    const items = evaluateReadyGate().gateItems.slice(1);
    expect(validateExternalExecutionManualDryRunGateItems(items).missingItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate gate item id", () => {
    const items = evaluateReadyGate().gateItems;
    const duplicate: ExternalExecutionManualDryRunGateItem = { ...items[0] };
    expect(validateExternalExecutionManualDryRunGateItems([...items, duplicate]).duplicateItemIds.length).toBe(1);
  });

  it("validation detects implementedInThisStep on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], implementedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).implementedItemIds).toContain(items[0].itemId);
  });

  it("validation detects non manualGateOnly item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], manualGateOnly: false as true };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).nonManualGateOnlyItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects external invocation allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualExternalInvocationAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).externalInvocationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects adapter side effect allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualAdapterSideEffectAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).adapterSideEffectAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects cursor execution allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualCursorExecutionAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).cursorExecutionAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects github write allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualGithubWriteAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).githubWriteAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects connector gateway call allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualConnectorGatewayCallAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).connectorGatewayCallAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects db persistence allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualDbPersistenceAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).dbPersistenceAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects production runner allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualProductionRunnerAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).productionRunnerAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects ui implementation allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], actualUiImplementationAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).uiImplementationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects agent registry mutation allowed on item", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], agentRegistryMutationAllowedInThisStep: true as false };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).agentRegistryMutationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).emptyApprovalItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyGate().gateItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateExternalExecutionManualDryRunGateItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].itemId,
    );
  });

  it("stage13 entry item exists", () => {
    expect(
      evaluateReadyGate().gateItems.some((item) => item.itemId === "stage13-actual-external-adapter-candidate-entry"),
    ).toBe(true);
  });

  it("stage13 entry item has requiredBeforeStage13 true", () => {
    const stage13Item = evaluateReadyGate().gateItems.find(
      (item) => item.itemId === "stage13-actual-external-adapter-candidate-entry",
    );
    expect(stage13Item?.requiredBeforeStage13).toBe(true);
  });

  it("stage13EntryScope includes actual_external_execution_adapter_candidate", () => {
    expect(evaluateReadyGate().stage13EntryScope).toContain("actual_external_execution_adapter_candidate");
  });

  it("stage13EntryOutOfScope includes unapproved_cursor_execution", () => {
    expect(evaluateReadyGate().stage13EntryOutOfScope).toContain("unapproved_cursor_execution");
  });

  it("stage13RequiresSeparateApproval is true", () => {
    expect(evaluateReadyGate().stage13RequiresSeparateApproval).toBe(true);
  });

  it("stage13ImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyGate().stage13ImplementationAllowedInThisStep).toBe(false);
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when stage13RequiresSeparateApproval is false", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(readyGateDecisionInput({ stage13RequiresSeparateApproval: false })),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionManualDryRunGateDecision blocks when stage13ImplementationAllowedInThisStep is true", () => {
    expect(
      resolveExternalExecutionManualDryRunGateDecision(
        readyGateDecisionInput({ stage13ImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("gateFingerprint is deterministic", () => {
    const first = evaluateReadyGate();
    const second = evaluateReadyGate();
    expect(first.gateFingerprint).toBe(second.gateFingerprint);
  });

  it("ready findings include stage12_external_execution_manual_dry_run_gate_ready", () => {
    expect(
      evaluateReadyGate().findings.some((f) => f.code === "stage12_external_execution_manual_dry_run_gate_ready"),
    ).toBe(true);
  });

  it("ready findings include agent_registry_change_boundary_separated", () => {
    expect(evaluateReadyGate().findings.some((f) => f.code === "agent_registry_change_boundary_separated")).toBe(true);
  });

  it("separatedWorkItems includes agent_registry_change_management", () => {
    expect(evaluateReadyGate().separatedWorkItems).toContain("agent_registry_change_management");
  });

  it("recommendedNextPhases includes stage_13_a_actual_external_execution_adapter_candidate", () => {
    expect(evaluateReadyGate().recommendedNextPhases).toContain(
      "stage_13_a_actual_external_execution_adapter_candidate",
    );
  });

  it("buildExternalExecutionManualDryRunGateItems returns empty when source is not ready", () => {
    const source = evaluateExternalExecutionDryRunPackage();
    expect(buildExternalExecutionManualDryRunGateItems(source)).toHaveLength(0);
  });
});

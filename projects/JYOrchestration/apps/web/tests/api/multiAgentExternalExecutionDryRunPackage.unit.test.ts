import { describe, expect, it } from "vitest";
import {
  evaluateExternalExecutionDryRunPackage,
  resolveExternalExecutionDryRunPackageDecision,
  validateExternalExecutionDryRunPackageItems,
  buildExternalExecutionDryRunPackageItems,
} from "@/lib/agents/evaluateExternalExecutionDryRunPackage";
import { evaluateExternalExecutionAdapterBoundary } from "@/lib/agents/evaluateExternalExecutionAdapterBoundary";
import {
  buildStage10AConfirmedExternalExecutionAdapterBoundaryInput,
  buildStage10AReadyExternalExecutionAdapterBoundaryInput,
  buildStage11AConfirmedExternalExecutionDryRunPackageInput,
  buildStage11AReadyExternalExecutionDryRunPackageInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionDryRunPackageDecisionInput } from "@/lib/agents/externalExecutionDryRunPackageTypes";
import type { ExternalExecutionDryRunPackageItem } from "@/lib/agents/externalExecutionDryRunPackageTypes";

function readyDryRunDecisionInput(
  overrides: Partial<ExternalExecutionDryRunPackageDecisionInput> = {},
): ExternalExecutionDryRunPackageDecisionInput {
  return {
    sourceStage10Decision: "stage10_external_execution_adapter_boundary_ready",
    sourceStage11EntryReady: true,
    sourceDryRunPackageDesignAllowed: true,
    sourceDryRunSimulationOnly: true,
    sourceStage11DryRunPackageRequiredBeforeActualExecution: true,
    sourceActualExternalExecutionImplementedInThisStep: false,
    sourceActualCursorExecutionImplementedInThisStep: false,
    sourceActualGithubWriteImplementedInThisStep: false,
    sourceActualConnectorGatewayCallImplementedInThisStep: false,
    sourceActualDbPersistenceImplementedInThisStep: false,
    sourceActualProductionRunnerImplementedInThisStep: false,
    sourceActualUiImplementationImplementedInThisStep: false,
    sourceAgentRegistryChangeManagementOutOfScope: true,
    sourceAgentAddRemoveDeactivateOutOfScope: true,
    sourceAgentRoleSlotImpactAnalysisRequired: true,
    sourceMandatoryGateAgentDeactivationRequiresApproval: true,
    sourceAgentKnowledgeBindingChangeRequiresApproval: true,
    validationValid: true,
    stage12EntryReady: true,
    confirmationsSatisfied: true,
    stage12RequiresSeparateApproval: true,
    stage12ImplementationAllowedInThisStep: false,
    ...overrides,
  };
}

function evaluateReadyDryRun(
  input: Parameters<typeof evaluateExternalExecutionDryRunPackage>[0] = {},
) {
  return evaluateExternalExecutionDryRunPackage({
    ...buildStage11AReadyExternalExecutionDryRunPackageInput(),
    ...input,
  });
}

describe("multi-agent external execution dry-run package stage 11-A", () => {
  it("default input defers", () => {
    expect(evaluateExternalExecutionDryRunPackage().decision).toBe("defer");
  });

  it("Stage 10-A source defer propagates defer", () => {
    expect(
      evaluateExternalExecutionDryRunPackage({
        adapterBoundary: buildStage10AReadyExternalExecutionAdapterBoundaryInput(),
        adapterDryRunReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 10-A source blocked propagates blocked", () => {
    expect(
      evaluateExternalExecutionDryRunPackage({
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
          ...buildStage11AConfirmedExternalExecutionDryRunPackageInput(),
        },
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 10-A ready with ten confirmations yields stage11_external_execution_dry_run_package_ready", () => {
    expect(evaluateReadyDryRun().decision).toBe("stage11_external_execution_dry_run_package_ready");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateExternalExecutionDryRunPackage({
        ...buildStage11AReadyExternalExecutionDryRunPackageInput(),
        stage12EntryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveExternalExecutionDryRunPackageDecision defers when sourceStage11EntryReady is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(readyDryRunDecisionInput({ sourceStage11EntryReady: false })),
    ).toBe("defer");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceDryRunPackageDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(readyDryRunDecisionInput({ sourceDryRunPackageDesignAllowed: false })),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceDryRunSimulationOnly is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(readyDryRunDecisionInput({ sourceDryRunSimulationOnly: false })),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceStage11DryRunPackageRequiredBeforeActualExecution is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceStage11DryRunPackageRequiredBeforeActualExecution: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualExternalExecutionImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualExternalExecutionImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualCursorExecutionImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualCursorExecutionImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualGithubWriteImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualGithubWriteImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualConnectorGatewayCallImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualConnectorGatewayCallImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualDbPersistenceImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualDbPersistenceImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualProductionRunnerImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualProductionRunnerImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceActualUiImplementationImplementedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceActualUiImplementationImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceAgentRegistryChangeManagementOutOfScope is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceAgentRegistryChangeManagementOutOfScope: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceAgentAddRemoveDeactivateOutOfScope is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceAgentAddRemoveDeactivateOutOfScope: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceAgentRoleSlotImpactAnalysisRequired is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceAgentRoleSlotImpactAnalysisRequired: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceMandatoryGateAgentDeactivationRequiresApproval is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceMandatoryGateAgentDeactivationRequiresApproval: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when sourceAgentKnowledgeBindingChangeRequiresApproval is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ sourceAgentKnowledgeBindingChangeRequiresApproval: false }),
      ),
    ).toBe("blocked");
  });

  it("builds ten dry-run items on ready path", () => {
    expect(evaluateReadyDryRun().dryRunItems).toHaveLength(10);
  });

  it("dry-run items are all dryRunOnly true", () => {
    expect(evaluateReadyDryRun().dryRunItems.every((item) => item.dryRunOnly === true)).toBe(true);
  });

  it("dry-run items are all implementedInThisStep false", () => {
    expect(evaluateReadyDryRun().dryRunItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("dry-run items are all actualExternalExecutionAllowedInThisStep false", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.every((item) => item.actualExternalExecutionAllowedInThisStep === false),
    ).toBe(true);
  });

  it("dry-run items are all actualCursorExecutionAllowedInThisStep false", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.every((item) => item.actualCursorExecutionAllowedInThisStep === false),
    ).toBe(true);
  });

  it("dry-run items are all actualGithubWriteAllowedInThisStep false", () => {
    expect(evaluateReadyDryRun().dryRunItems.every((item) => item.actualGithubWriteAllowedInThisStep === false)).toBe(
      true,
    );
  });

  it("dry-run items are all actualConnectorGatewayCallAllowedInThisStep false", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.every((item) => item.actualConnectorGatewayCallAllowedInThisStep === false),
    ).toBe(true);
  });

  it("dry-run items are all actualDbPersistenceAllowedInThisStep false", () => {
    expect(evaluateReadyDryRun().dryRunItems.every((item) => item.actualDbPersistenceAllowedInThisStep === false)).toBe(
      true,
    );
  });

  it("dry-run items are all actualProductionRunnerAllowedInThisStep false", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.every((item) => item.actualProductionRunnerAllowedInThisStep === false),
    ).toBe(true);
  });

  it("dry-run items are all actualUiImplementationAllowedInThisStep false", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.every((item) => item.actualUiImplementationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("dry-run items are all agentRegistryMutationAllowedInThisStep false", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.every((item) => item.agentRegistryMutationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("validation detects missing dry-run item id", () => {
    const items = evaluateReadyDryRun().dryRunItems.slice(1);
    expect(validateExternalExecutionDryRunPackageItems(items).missingItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate dry-run item id", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const duplicate: ExternalExecutionDryRunPackageItem = { ...items[0] };
    expect(validateExternalExecutionDryRunPackageItems([...items, duplicate]).duplicateItemIds.length).toBe(1);
  });

  it("validation detects implementedInThisStep on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], implementedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).implementedItemIds).toContain(items[0].itemId);
  });

  it("validation detects non dryRunOnly item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], dryRunOnly: false as true };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).nonDryRunOnlyItemIds).toContain(items[0].itemId);
  });

  it("validation detects external execution allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualExternalExecutionAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).externalExecutionAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects cursor execution allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualCursorExecutionAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).cursorExecutionAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects github write allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualGithubWriteAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).githubWriteAllowedItemIds).toContain(items[0].itemId);
  });

  it("validation detects connector gateway call allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualConnectorGatewayCallAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).connectorGatewayCallAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects db persistence allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualDbPersistenceAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).dbPersistenceAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects production runner allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualProductionRunnerAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).productionRunnerAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects ui implementation allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], actualUiImplementationAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).uiImplementationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects agent registry mutation allowed on item", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], agentRegistryMutationAllowedInThisStep: true as false };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).agentRegistryMutationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).emptyApprovalItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyDryRun().dryRunItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateExternalExecutionDryRunPackageItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].itemId,
    );
  });

  it("stage12 entry item exists", () => {
    expect(
      evaluateReadyDryRun().dryRunItems.some((item) => item.itemId === "stage12-manual-dry-run-gate-entry"),
    ).toBe(true);
  });

  it("stage12 entry item has requiredBeforeStage12 true", () => {
    const stage12Item = evaluateReadyDryRun().dryRunItems.find(
      (item) => item.itemId === "stage12-manual-dry-run-gate-entry",
    );
    expect(stage12Item?.requiredBeforeStage12).toBe(true);
  });

  it("stage12EntryScope includes external_execution_adapter_manual_dry_run_gate", () => {
    expect(evaluateReadyDryRun().stage12EntryScope).toContain("external_execution_adapter_manual_dry_run_gate");
  });

  it("stage12EntryOutOfScope includes actual_cursor_execution", () => {
    expect(evaluateReadyDryRun().stage12EntryOutOfScope).toContain("actual_cursor_execution");
  });

  it("stage12EntryOutOfScope includes agent_registry_crud", () => {
    expect(evaluateReadyDryRun().stage12EntryOutOfScope).toContain("agent_registry_crud");
  });

  it("stage12RequiresSeparateApproval is true", () => {
    expect(evaluateReadyDryRun().stage12RequiresSeparateApproval).toBe(true);
  });

  it("stage12ImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().stage12ImplementationAllowedInThisStep).toBe(false);
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when stage12RequiresSeparateApproval is false", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(readyDryRunDecisionInput({ stage12RequiresSeparateApproval: false })),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionDryRunPackageDecision blocks when stage12ImplementationAllowedInThisStep is true", () => {
    expect(
      resolveExternalExecutionDryRunPackageDecision(
        readyDryRunDecisionInput({ stage12ImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("packageFingerprint is deterministic", () => {
    const first = evaluateReadyDryRun();
    const second = evaluateReadyDryRun();
    expect(first.packageFingerprint).toBe(second.packageFingerprint);
  });

  it("ready findings include stage11_external_execution_dry_run_package_ready", () => {
    expect(
      evaluateReadyDryRun().findings.some((f) => f.code === "stage11_external_execution_dry_run_package_ready"),
    ).toBe(true);
  });

  it("ready findings include agent_registry_change_boundary_separated", () => {
    expect(evaluateReadyDryRun().findings.some((f) => f.code === "agent_registry_change_boundary_separated")).toBe(
      true,
    );
  });

  it("separatedWorkItems includes agent_registry_change_management", () => {
    expect(evaluateReadyDryRun().separatedWorkItems).toContain("agent_registry_change_management");
  });

  it("recommendedNextPhases includes stage_12_a_external_execution_adapter_manual_dry_run_gate", () => {
    expect(evaluateReadyDryRun().recommendedNextPhases).toContain(
      "stage_12_a_external_execution_adapter_manual_dry_run_gate",
    );
  });

  it("buildExternalExecutionDryRunPackageItems returns empty when source is not ready", () => {
    const source = evaluateExternalExecutionAdapterBoundary();
    expect(buildExternalExecutionDryRunPackageItems(source)).toHaveLength(0);
  });

  it("ready report sourceAgentRegistryChangeManagementOutOfScope is true", () => {
    expect(evaluateReadyDryRun().sourceAgentRegistryChangeManagementOutOfScope).toBe(true);
  });

  it("ready report sourceAgentAddRemoveDeactivateOutOfScope is true", () => {
    expect(evaluateReadyDryRun().sourceAgentAddRemoveDeactivateOutOfScope).toBe(true);
  });

  it("ready report sourceAgentRoleSlotImpactAnalysisRequired is true", () => {
    expect(evaluateReadyDryRun().sourceAgentRoleSlotImpactAnalysisRequired).toBe(true);
  });

  it("ready report sourceMandatoryGateAgentDeactivationRequiresApproval is true", () => {
    expect(evaluateReadyDryRun().sourceMandatoryGateAgentDeactivationRequiresApproval).toBe(true);
  });

  it("ready report sourceAgentKnowledgeBindingChangeRequiresApproval is true", () => {
    expect(evaluateReadyDryRun().sourceAgentKnowledgeBindingChangeRequiresApproval).toBe(true);
  });

  it("ready report manualDryRunGateDesignAllowed is true", () => {
    expect(evaluateReadyDryRun().manualDryRunGateDesignAllowed).toBe(true);
  });

  it("ready report operatorApprovedDryRunInvocationAllowed is true", () => {
    expect(evaluateReadyDryRun().operatorApprovedDryRunInvocationAllowed).toBe(true);
  });

  it("ready report mockExternalAdapterResultPackageAllowed is true", () => {
    expect(evaluateReadyDryRun().mockExternalAdapterResultPackageAllowed).toBe(true);
  });

  it("ready report dryRunAuditEventPackageAllowed is true", () => {
    expect(evaluateReadyDryRun().dryRunAuditEventPackageAllowed).toBe(true);
  });

  it("ready report rollbackPlanReviewBeforeActualExecutionAllowed is true", () => {
    expect(evaluateReadyDryRun().rollbackPlanReviewBeforeActualExecutionAllowed).toBe(true);
  });

  it("ready report stage12ManualGateRequiredBeforeActualExecution is true", () => {
    expect(evaluateReadyDryRun().stage12ManualGateRequiredBeforeActualExecution).toBe(true);
  });

  it("ready report actualManualExternalInvocationAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualManualExternalInvocationAllowedInThisStep).toBe(false);
  });

  it("ready report actualAdapterSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualAdapterSideEffectAllowedInThisStep).toBe(false);
  });

  it("ready report actualAgentRegistryMutationAllowedInThisStep is false", () => {
    expect(evaluateReadyDryRun().actualAgentRegistryMutationAllowedInThisStep).toBe(false);
  });

  it("buildExternalExecutionDryRunPackageItems returns empty when agent registry impact analysis is false", () => {
    const readyBoundary = evaluateExternalExecutionAdapterBoundary(buildStage10AReadyExternalExecutionAdapterBoundaryInput());
    const source: ExternalExecutionAdapterBoundaryReport = {
      ...readyBoundary,
      agentRoleSlotImpactAnalysisRequired: false,
    };
    expect(buildExternalExecutionDryRunPackageItems(source)).toHaveLength(0);
  });

  it("stage12EntryScope includes manual_dry_run_gate_boundary", () => {
    expect(evaluateReadyDryRun().stage12EntryScope).toContain("manual_dry_run_gate_boundary");
  });

  it("stage12EntryOutOfScope includes actual_manual_external_invocation", () => {
    expect(evaluateReadyDryRun().stage12EntryOutOfScope).toContain("actual_manual_external_invocation");
  });

  it("separatedWorkItems includes actual_adapter_side_effect", () => {
    expect(evaluateReadyDryRun().separatedWorkItems).toContain("actual_adapter_side_effect");
  });

  it("ready findings include manual_dry_run_gate_design_allowed", () => {
    expect(evaluateReadyDryRun().findings.some((f) => f.code === "manual_dry_run_gate_design_allowed")).toBe(true);
  });

  it("ready findings include actual_agent_registry_mutation_disallowed", () => {
    expect(evaluateReadyDryRun().findings.some((f) => f.code === "actual_agent_registry_mutation_disallowed")).toBe(
      true,
    );
  });
});

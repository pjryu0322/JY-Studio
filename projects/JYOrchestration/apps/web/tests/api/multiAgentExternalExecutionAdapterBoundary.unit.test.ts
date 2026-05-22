import { describe, expect, it } from "vitest";
import {
  evaluateExternalExecutionAdapterBoundary,
  resolveExternalExecutionAdapterBoundaryDecision,
  validateExternalExecutionAdapterBoundaryItems,
  buildExternalExecutionAdapterBoundaryItems,
} from "@/lib/agents/evaluateExternalExecutionAdapterBoundary";
import { evaluateRuntimeExecutionMvpClosure } from "@/lib/agents/evaluateRuntimeExecutionMvpClosure";
import {
  buildStage10AConfirmedExternalExecutionAdapterBoundaryInput,
  buildStage10AReadyExternalExecutionAdapterBoundaryInput,
  buildStage9BReadyRuntimeExecutionMvpClosureInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { ExternalExecutionAdapterBoundaryDecisionInput } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionAdapterBoundaryItem } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

function readyBoundaryDecisionInput(
  overrides: Partial<ExternalExecutionAdapterBoundaryDecisionInput> = {},
): ExternalExecutionAdapterBoundaryDecisionInput {
  return {
    sourceStage9Decision: "stage9_runtime_api_mvp_closed",
    sourceStage10EntryReady: true,
    sourceStage10EntryMode: "external_execution_adapter_boundary_design",
    sourceStage10AdapterBoundaryDesignAllowed: true,
    sourceStage10CursorGithubBoundaryDesignAllowed: true,
    sourceStage10ConnectorBoundaryDesignAllowed: true,
    sourceStage10RunnerBoundaryDesignAllowed: true,
    sourceStage10DryRunSimulationDesignAllowed: true,
    sourceStage10RollbackBoundaryDesignAllowed: true,
    sourceStage10ActualCursorExecutionAllowed: false,
    sourceStage10ActualGithubWriteAllowed: false,
    sourceStage10ActualConnectorGatewayCallAllowed: false,
    sourceStage10ActualDbPersistenceAllowed: false,
    sourceStage10ActualProductionRunnerAllowed: false,
    sourceStage10ActualUiImplementationAllowed: false,
    validationValid: true,
    stage11EntryReady: true,
    confirmationsSatisfied: true,
    stage11RequiresSeparateApproval: true,
    stage11ImplementationAllowedInThisStep: false,
    ...overrides,
  };
}

function evaluateReadyBoundary(
  input: Parameters<typeof evaluateExternalExecutionAdapterBoundary>[0] = {},
) {
  return evaluateExternalExecutionAdapterBoundary({
    ...buildStage10AReadyExternalExecutionAdapterBoundaryInput(),
    ...input,
  });
}

describe("multi-agent external execution adapter boundary stage 10-A", () => {
  it("default input defers", () => {
    expect(evaluateExternalExecutionAdapterBoundary().decision).toBe("defer");
  });

  it("Stage 9-B source defer propagates defer", () => {
    expect(
      evaluateExternalExecutionAdapterBoundary({
        runtimeMvpClosure: buildStage9BReadyRuntimeExecutionMvpClosureInput(),
        externalAdapterBoundaryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 9-B source blocked propagates blocked", () => {
    expect(
      evaluateExternalExecutionAdapterBoundary({
        runtimeMvpClosure: {
          ...buildStage9BReadyRuntimeExecutionMvpClosureInput(),
          apiMvp: {
            ...buildStage9BReadyRuntimeExecutionMvpClosureInput().apiMvp!,
            runtimeControlBundle: {
              verticalSlice: {
                ...buildStage9BReadyRuntimeExecutionMvpClosureInput().apiMvp!.runtimeControlBundle!.verticalSlice!,
                request: {
                  ...buildStage9BReadyRuntimeExecutionMvpClosureInput().apiMvp!.runtimeControlBundle!.verticalSlice!
                    .request!,
                  actualExecutionRequested: true as false,
                },
              },
            },
          },
          ...buildStage10AConfirmedExternalExecutionAdapterBoundaryInput(),
        },
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 9-B ready with nine confirmations yields stage10_external_execution_adapter_boundary_ready", () => {
    expect(evaluateReadyBoundary().decision).toBe("stage10_external_execution_adapter_boundary_ready");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateExternalExecutionAdapterBoundary({
        ...buildStage10AReadyExternalExecutionAdapterBoundaryInput(),
        stage11EntryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision defers when sourceStage10EntryReady is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(readyBoundaryDecisionInput({ sourceStage10EntryReady: false })),
    ).toBe("defer");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10EntryMode differs", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10EntryMode: "other_mode" }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10AdapterBoundaryDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10AdapterBoundaryDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10CursorGithubBoundaryDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10CursorGithubBoundaryDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ConnectorBoundaryDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ConnectorBoundaryDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10RunnerBoundaryDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10RunnerBoundaryDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10DryRunSimulationDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10DryRunSimulationDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10RollbackBoundaryDesignAllowed is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10RollbackBoundaryDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ActualCursorExecutionAllowed is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ActualCursorExecutionAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ActualGithubWriteAllowed is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ActualGithubWriteAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ActualConnectorGatewayCallAllowed is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ActualConnectorGatewayCallAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ActualDbPersistenceAllowed is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ActualDbPersistenceAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ActualProductionRunnerAllowed is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ActualProductionRunnerAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when sourceStage10ActualUiImplementationAllowed is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ sourceStage10ActualUiImplementationAllowed: true }),
      ),
    ).toBe("blocked");
  });

  it("builds nine boundary items on ready path", () => {
    expect(evaluateReadyBoundary().boundaryItems).toHaveLength(9);
  });

  it("boundary items are all designOnly true", () => {
    expect(evaluateReadyBoundary().boundaryItems.every((item) => item.designOnly === true)).toBe(true);
  });

  it("boundary items are all implementedInThisStep false", () => {
    expect(evaluateReadyBoundary().boundaryItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("boundary items are all externalExecutionAllowedInThisStep false", () => {
    expect(
      evaluateReadyBoundary().boundaryItems.every((item) => item.externalExecutionAllowedInThisStep === false),
    ).toBe(true);
  });

  it("boundary items are all cursorExecutionAllowedInThisStep false", () => {
    expect(
      evaluateReadyBoundary().boundaryItems.every((item) => item.cursorExecutionAllowedInThisStep === false),
    ).toBe(true);
  });

  it("boundary items are all githubWriteAllowedInThisStep false", () => {
    expect(evaluateReadyBoundary().boundaryItems.every((item) => item.githubWriteAllowedInThisStep === false)).toBe(
      true,
    );
  });

  it("boundary items are all connectorGatewayCallAllowedInThisStep false", () => {
    expect(
      evaluateReadyBoundary().boundaryItems.every((item) => item.connectorGatewayCallAllowedInThisStep === false),
    ).toBe(true);
  });

  it("boundary items are all dbPersistenceAllowedInThisStep false", () => {
    expect(evaluateReadyBoundary().boundaryItems.every((item) => item.dbPersistenceAllowedInThisStep === false)).toBe(
      true,
    );
  });

  it("boundary items are all productionRunnerAllowedInThisStep false", () => {
    expect(
      evaluateReadyBoundary().boundaryItems.every((item) => item.productionRunnerAllowedInThisStep === false),
    ).toBe(true);
  });

  it("validation detects missing boundary item id", () => {
    const items = evaluateReadyBoundary().boundaryItems.slice(1);
    expect(validateExternalExecutionAdapterBoundaryItems(items).missingItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate boundary item id", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const duplicate: ExternalExecutionAdapterBoundaryItem = { ...items[0] };
    expect(validateExternalExecutionAdapterBoundaryItems([...items, duplicate]).duplicateItemIds.length).toBe(1);
  });

  it("validation detects implementedInThisStep on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], implementedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).implementedItemIds).toContain(items[0].itemId);
  });

  it("validation detects non designOnly item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], designOnly: false as true };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).nonDesignOnlyItemIds).toContain(items[0].itemId);
  });

  it("validation detects external execution allowed on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], externalExecutionAllowedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).externalExecutionAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects cursor execution allowed on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], cursorExecutionAllowedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).cursorExecutionAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects github write allowed on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], githubWriteAllowedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).githubWriteAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects connector gateway call allowed on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], connectorGatewayCallAllowedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).connectorGatewayCallAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects db persistence allowed on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], dbPersistenceAllowedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).dbPersistenceAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects production runner allowed on item", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], productionRunnerAllowedInThisStep: true as false };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).productionRunnerAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).emptyApprovalItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyBoundary().boundaryItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateExternalExecutionAdapterBoundaryItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].itemId,
    );
  });

  it("stage11 entry item exists", () => {
    expect(
      evaluateReadyBoundary().boundaryItems.some((item) => item.itemId === "stage11-dry-run-package-entry"),
    ).toBe(true);
  });

  it("stage11 entry item has requiredBeforeStage11 true", () => {
    const stage11Item = evaluateReadyBoundary().boundaryItems.find(
      (item) => item.itemId === "stage11-dry-run-package-entry",
    );
    expect(stage11Item?.requiredBeforeStage11).toBe(true);
  });

  it("stage11EntryScope includes external_execution_adapter_dry_run_package", () => {
    expect(evaluateReadyBoundary().stage11EntryScope).toContain("external_execution_adapter_dry_run_package");
  });

  it("stage11EntryOutOfScope includes actual_cursor_execution", () => {
    expect(evaluateReadyBoundary().stage11EntryOutOfScope).toContain("actual_cursor_execution");
  });

  it("stage11EntryOutOfScope includes actual_db_schema_migration", () => {
    expect(evaluateReadyBoundary().stage11EntryOutOfScope).toContain("actual_db_schema_migration");
  });

  it("stage11RequiresSeparateApproval is true", () => {
    expect(evaluateReadyBoundary().stage11RequiresSeparateApproval).toBe(true);
  });

  it("stage11ImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyBoundary().stage11ImplementationAllowedInThisStep).toBe(false);
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when stage11RequiresSeparateApproval is false", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ stage11RequiresSeparateApproval: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveExternalExecutionAdapterBoundaryDecision blocks when stage11ImplementationAllowedInThisStep is true", () => {
    expect(
      resolveExternalExecutionAdapterBoundaryDecision(
        readyBoundaryDecisionInput({ stage11ImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("boundaryFingerprint is deterministic", () => {
    const first = evaluateReadyBoundary();
    const second = evaluateReadyBoundary();
    expect(first.boundaryFingerprint).toBe(second.boundaryFingerprint);
  });

  it("ready findings include stage10_external_execution_adapter_boundary_ready", () => {
    expect(
      evaluateReadyBoundary().findings.some((f) => f.code === "stage10_external_execution_adapter_boundary_ready"),
    ).toBe(true);
  });

  it("ready findings include stage11_entry_candidate_defined", () => {
    expect(evaluateReadyBoundary().findings.some((f) => f.code === "stage11_entry_candidate_defined")).toBe(true);
  });

  it("separatedWorkItems includes actual_cursor_execution", () => {
    expect(evaluateReadyBoundary().separatedWorkItems).toContain("actual_cursor_execution");
  });

  it("recommendedNextPhases includes stage_11_a_external_execution_adapter_dry_run_package", () => {
    expect(evaluateReadyBoundary().recommendedNextPhases).toContain(
      "stage_11_a_external_execution_adapter_dry_run_package",
    );
  });

  it("buildExternalExecutionAdapterBoundaryItems returns empty when source is not ready", () => {
    const source = evaluateRuntimeExecutionMvpClosure();
    expect(buildExternalExecutionAdapterBoundaryItems(source)).toHaveLength(0);
  });

  it("ready report dryRunPackageDesignAllowed is true", () => {
    expect(evaluateReadyBoundary().dryRunPackageDesignAllowed).toBe(true);
  });

  it("ready report dryRunSimulationOnly is true", () => {
    expect(evaluateReadyBoundary().dryRunSimulationOnly).toBe(true);
  });

  it("ready report externalAdapterContractCount is at least 4", () => {
    expect(evaluateReadyBoundary().externalAdapterContractCount).toBeGreaterThanOrEqual(4);
  });

  it("ready report stage11DryRunPackageRequiredBeforeActualExecution is true", () => {
    expect(evaluateReadyBoundary().stage11DryRunPackageRequiredBeforeActualExecution).toBe(true);
  });

  it("ready report agentRegistryChangeManagementOutOfScope is true", () => {
    expect(evaluateReadyBoundary().agentRegistryChangeManagementOutOfScope).toBe(true);
  });

  it("ready report agentAddRemoveDeactivateOutOfScope is true", () => {
    expect(evaluateReadyBoundary().agentAddRemoveDeactivateOutOfScope).toBe(true);
  });

  it("ready report agentRoleSlotImpactAnalysisRequired is true", () => {
    expect(evaluateReadyBoundary().agentRoleSlotImpactAnalysisRequired).toBe(true);
  });

  it("ready report mandatoryGateAgentDeactivationRequiresApproval is true", () => {
    expect(evaluateReadyBoundary().mandatoryGateAgentDeactivationRequiresApproval).toBe(true);
  });

  it("ready report agentKnowledgeBindingChangeRequiresApproval is true", () => {
    expect(evaluateReadyBoundary().agentKnowledgeBindingChangeRequiresApproval).toBe(true);
  });

  it("separatedWorkItems includes agent_registry_change_management", () => {
    expect(evaluateReadyBoundary().separatedWorkItems).toContain("agent_registry_change_management");
  });

  it("separatedWorkItems includes agent_add_remove_deactivate_flow", () => {
    expect(evaluateReadyBoundary().separatedWorkItems).toContain("agent_add_remove_deactivate_flow");
  });

  it("stage11EntryOutOfScope includes agent_registry_crud", () => {
    expect(evaluateReadyBoundary().stage11EntryOutOfScope).toContain("agent_registry_crud");
  });

  it("stage11EntryOutOfScope includes agent_management_ui", () => {
    expect(evaluateReadyBoundary().stage11EntryOutOfScope).toContain("agent_management_ui");
  });

  it("ready findings include agent_registry_change_management_separated", () => {
    expect(
      evaluateReadyBoundary().findings.some((f) => f.code === "agent_registry_change_management_separated"),
    ).toBe(true);
  });

  it("ready findings include mandatory_gate_agent_deactivation_requires_approval", () => {
    expect(
      evaluateReadyBoundary().findings.some((f) => f.code === "mandatory_gate_agent_deactivation_requires_approval"),
    ).toBe(true);
  });
});

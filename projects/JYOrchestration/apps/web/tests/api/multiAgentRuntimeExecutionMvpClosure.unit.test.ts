import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeExecutionMvpClosure,
  resolveRuntimeExecutionMvpClosureDecision,
  validateRuntimeExecutionMvpClosureItems,
  buildRuntimeExecutionMvpClosureItems,
} from "@/lib/agents/evaluateRuntimeExecutionMvpClosure";
import { evaluateRuntimeExecutionApiMvp } from "@/lib/agents/evaluateRuntimeExecutionApiMvp";
import {
  buildStage9AReadyRuntimeExecutionApiMvpInput,
  buildStage9BConfirmedRuntimeExecutionMvpClosureInput,
  buildStage9BReadyRuntimeExecutionMvpClosureInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { RuntimeExecutionMvpClosureDecisionInput } from "@/lib/agents/runtimeExecutionMvpClosureTypes";
import type { RuntimeExecutionMvpClosureItem } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

function readyClosureDecisionInput(
  overrides: Partial<RuntimeExecutionMvpClosureDecisionInput> = {},
): RuntimeExecutionMvpClosureDecisionInput {
  return {
    sourceStage9Decision: "stage9_runtime_execution_api_mvp_ready",
    sourceStage9AClosureReady: true,
    sourceRouteHandlerCount: 5,
    sourceServiceActionCount: 6,
    sourceBoundaryReportIncludedInEveryResponse: true,
    sourceApprovalActionImplemented: true,
    sourceMockRunnerAdapterImplemented: true,
    sourceAuditQueryImplemented: true,
    sourceStatusQueryImplemented: true,
    sourceActualApiRouteImplementedInThisStep: true,
    sourceInMemoryStoreImplementedInThisStep: true,
    sourceMockRunnerAdapterImplementedInThisStep: true,
    sourceActualExternalExecutionAllowedInThisStep: false,
    sourceActualCursorGithubCallAllowedInThisStep: false,
    sourceActualConnectorGatewayCallAllowedInThisStep: false,
    sourceActualDbWriteAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualUiImplementationAllowedInThisStep: false,
    validationValid: true,
    stage10EntryReady: true,
    confirmationsSatisfied: true,
    stage10RequiresSeparateApproval: true,
    stage10ImplementationAllowedInThisStep: false,
    ...overrides,
  };
}

function evaluateReadyClosure(input: Parameters<typeof evaluateRuntimeExecutionMvpClosure>[0] = {}) {
  return evaluateRuntimeExecutionMvpClosure({ ...buildStage9BReadyRuntimeExecutionMvpClosureInput(), ...input });
}

describe("multi-agent runtime execution MVP closure stage 9-B", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionMvpClosure().decision).toBe("defer");
  });

  it("Stage 9-A source defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionMvpClosure({
        apiMvp: buildStage9AReadyRuntimeExecutionApiMvpInput(),
        runtimeMvpClosureReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 9-A source blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionMvpClosure({
        apiMvp: {
          ...buildStage9AReadyRuntimeExecutionApiMvpInput(),
          runtimeControlBundle: {
            verticalSlice: {
              ...buildStage9AReadyRuntimeExecutionApiMvpInput().runtimeControlBundle!.verticalSlice!,
              request: {
                ...buildStage9AReadyRuntimeExecutionApiMvpInput().runtimeControlBundle!.verticalSlice!.request!,
                actualExecutionRequested: true as false,
              },
            },
          },
          ...buildStage9BConfirmedRuntimeExecutionMvpClosureInput(),
        },
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 9-A ready with six confirmations yields stage9_runtime_api_mvp_closed", () => {
    expect(evaluateReadyClosure().decision).toBe("stage9_runtime_api_mvp_closed");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeExecutionMvpClosure({
        ...buildStage9BReadyRuntimeExecutionMvpClosureInput(),
        stage10EntryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionMvpClosureDecision defers when sourceStage9AClosureReady is false", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(readyClosureDecisionInput({ sourceStage9AClosureReady: false })),
    ).toBe("defer");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualApiRouteImplementedInThisStep is false", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceActualApiRouteImplementedInThisStep: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceInMemoryStoreImplementedInThisStep is false", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceInMemoryStoreImplementedInThisStep: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceMockRunnerAdapterImplementedInThisStep is false", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceMockRunnerAdapterImplementedInThisStep: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualExternalExecutionAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceActualExternalExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualCursorGithubCallAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceActualCursorGithubCallAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualConnectorGatewayCallAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceActualConnectorGatewayCallAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualDbWriteAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(readyClosureDecisionInput({ sourceActualDbWriteAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualSchemaMigrationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceActualUiImplementationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(readyClosureDecisionInput({ sourceActualUiImplementationAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("builds eight closure items on ready path", () => {
    expect(evaluateReadyClosure().closureItems).toHaveLength(8);
  });

  it("closure items have actualExternalExecution false", () => {
    expect(evaluateReadyClosure().closureItems.every((item) => item.actualExternalExecution === false)).toBe(true);
  });

  it("closure items have dbPersistence false", () => {
    expect(evaluateReadyClosure().closureItems.every((item) => item.dbPersistence === false)).toBe(true);
  });

  it("closure items have productionRunner false", () => {
    expect(evaluateReadyClosure().closureItems.every((item) => item.productionRunner === false)).toBe(true);
  });

  it("validation detects missing closure item id", () => {
    const items = evaluateReadyClosure().closureItems.slice(1);
    expect(validateRuntimeExecutionMvpClosureItems(items).missingItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate closure item id", () => {
    const items = evaluateReadyClosure().closureItems;
    const duplicate: RuntimeExecutionMvpClosureItem = { ...items[0] };
    expect(validateRuntimeExecutionMvpClosureItems([...items, duplicate]).duplicateItemIds.length).toBe(1);
  });

  it("validation detects external execution flag on item", () => {
    const items = evaluateReadyClosure().closureItems;
    const invalid = { ...items[0], actualExternalExecution: true as false };
    expect(validateRuntimeExecutionMvpClosureItems([invalid]).externalExecutionItemIds).toContain(items[0].itemId);
  });

  it("validation detects db persistence flag on item", () => {
    const items = evaluateReadyClosure().closureItems;
    const invalid = { ...items[0], dbPersistence: true as false };
    expect(validateRuntimeExecutionMvpClosureItems([invalid]).dbPersistenceItemIds).toContain(items[0].itemId);
  });

  it("validation detects production runner flag on item", () => {
    const items = evaluateReadyClosure().closureItems;
    const invalid = { ...items[0], productionRunner: true as false };
    expect(validateRuntimeExecutionMvpClosureItems([invalid]).productionRunnerItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyClosure().closureItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateRuntimeExecutionMvpClosureItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyClosure().closureItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateRuntimeExecutionMvpClosureItems([invalid]).emptyApprovalItemIds).toContain(items[0].itemId);
  });

  it("stage10 entry item exists", () => {
    expect(
      evaluateReadyClosure().closureItems.some((item) => item.itemId === "stage10-external-execution-entry"),
    ).toBe(true);
  });

  it("stage10 entry item has requiredBeforeStage10 true", () => {
    const stage10Item = evaluateReadyClosure().closureItems.find(
      (item) => item.itemId === "stage10-external-execution-entry",
    );
    expect(stage10Item?.requiredBeforeStage10).toBe(true);
  });

  it("stage10EntryScope includes external_execution_adapter_design", () => {
    expect(evaluateReadyClosure().stage10EntryScope).toContain("external_execution_adapter_design");
  });

  it("stage10EntryOutOfScope includes actual_cursor_execution", () => {
    expect(evaluateReadyClosure().stage10EntryOutOfScope).toContain("actual_cursor_execution");
  });

  it("stage10EntryOutOfScope includes actual_db_schema_migration", () => {
    expect(evaluateReadyClosure().stage10EntryOutOfScope).toContain("actual_db_schema_migration");
  });

  it("stage10RequiresSeparateApproval is true", () => {
    expect(evaluateReadyClosure().stage10RequiresSeparateApproval).toBe(true);
  });

  it("stage10ImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().stage10ImplementationAllowedInThisStep).toBe(false);
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when stage10RequiresSeparateApproval is false", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(readyClosureDecisionInput({ stage10RequiresSeparateApproval: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when stage10ImplementationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ stage10ImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("closureFingerprint is deterministic", () => {
    const first = evaluateReadyClosure();
    const second = evaluateReadyClosure();
    expect(first.closureFingerprint).toBe(second.closureFingerprint);
  });

  it("ready findings include stage9_runtime_api_mvp_closed", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage9_runtime_api_mvp_closed")).toBe(true);
  });

  it("ready findings include stage10_entry_candidate_defined", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage10_entry_candidate_defined")).toBe(true);
  });

  it("separatedWorkItems includes actual_cursor_execution", () => {
    expect(evaluateReadyClosure().separatedWorkItems).toContain("actual_cursor_execution");
  });

  it("recommendedNextPhases includes stage_10_a_external_execution_adapter_design", () => {
    expect(evaluateReadyClosure().recommendedNextPhases).toContain("stage_10_a_external_execution_adapter_design");
  });

  it("buildRuntimeExecutionMvpClosureItems returns empty when source is not ready", () => {
    const source = evaluateRuntimeExecutionApiMvp();
    expect(buildRuntimeExecutionMvpClosureItems(source)).toHaveLength(0);
  });

  it("ready report sourceRouteHandlerCount is at least 5", () => {
    expect(evaluateReadyClosure().sourceRouteHandlerCount).toBeGreaterThanOrEqual(5);
  });

  it("ready report sourceServiceActionCount is at least 6", () => {
    expect(evaluateReadyClosure().sourceServiceActionCount).toBeGreaterThanOrEqual(6);
  });

  it("ready report sourceBoundaryReportIncludedInEveryResponse is true", () => {
    expect(evaluateReadyClosure().sourceBoundaryReportIncludedInEveryResponse).toBe(true);
  });

  it("ready report sourceApprovalActionImplemented is true", () => {
    expect(evaluateReadyClosure().sourceApprovalActionImplemented).toBe(true);
  });

  it("ready report sourceMockRunnerAdapterImplemented is true", () => {
    expect(evaluateReadyClosure().sourceMockRunnerAdapterImplemented).toBe(true);
  });

  it("ready report sourceAuditQueryImplemented is true", () => {
    expect(evaluateReadyClosure().sourceAuditQueryImplemented).toBe(true);
  });

  it("ready report sourceStatusQueryImplemented is true", () => {
    expect(evaluateReadyClosure().sourceStatusQueryImplemented).toBe(true);
  });

  it("ready report stage10EntryMode is external_execution_adapter_boundary_design", () => {
    expect(evaluateReadyClosure().stage10EntryMode).toBe("external_execution_adapter_boundary_design");
  });

  it("ready report stage10AdapterBoundaryDesignAllowed is true", () => {
    expect(evaluateReadyClosure().stage10AdapterBoundaryDesignAllowed).toBe(true);
  });

  it("ready report stage10CursorGithubBoundaryDesignAllowed is true", () => {
    expect(evaluateReadyClosure().stage10CursorGithubBoundaryDesignAllowed).toBe(true);
  });

  it("ready report stage10ConnectorBoundaryDesignAllowed is true", () => {
    expect(evaluateReadyClosure().stage10ConnectorBoundaryDesignAllowed).toBe(true);
  });

  it("ready report stage10RunnerBoundaryDesignAllowed is true", () => {
    expect(evaluateReadyClosure().stage10RunnerBoundaryDesignAllowed).toBe(true);
  });

  it("ready report stage10DryRunSimulationDesignAllowed is true", () => {
    expect(evaluateReadyClosure().stage10DryRunSimulationDesignAllowed).toBe(true);
  });

  it("ready report stage10RollbackBoundaryDesignAllowed is true", () => {
    expect(evaluateReadyClosure().stage10RollbackBoundaryDesignAllowed).toBe(true);
  });

  it("ready report stage10ActualCursorExecutionAllowed is false", () => {
    expect(evaluateReadyClosure().stage10ActualCursorExecutionAllowed).toBe(false);
  });

  it("ready report stage10ActualGithubWriteAllowed is false", () => {
    expect(evaluateReadyClosure().stage10ActualGithubWriteAllowed).toBe(false);
  });

  it("ready report stage10ActualConnectorGatewayCallAllowed is false", () => {
    expect(evaluateReadyClosure().stage10ActualConnectorGatewayCallAllowed).toBe(false);
  });

  it("ready report stage10ActualDbPersistenceAllowed is false", () => {
    expect(evaluateReadyClosure().stage10ActualDbPersistenceAllowed).toBe(false);
  });

  it("ready report stage10ActualProductionRunnerAllowed is false", () => {
    expect(evaluateReadyClosure().stage10ActualProductionRunnerAllowed).toBe(false);
  });

  it("ready report stage10ActualUiImplementationAllowed is false", () => {
    expect(evaluateReadyClosure().stage10ActualUiImplementationAllowed).toBe(false);
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceRouteHandlerCount is insufficient", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(readyClosureDecisionInput({ sourceRouteHandlerCount: 4 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceServiceActionCount is insufficient", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(readyClosureDecisionInput({ sourceServiceActionCount: 5 })),
    ).toBe("blocked");
  });

  it("resolveRuntimeExecutionMvpClosureDecision blocks when sourceBoundaryReportIncludedInEveryResponse is false", () => {
    expect(
      resolveRuntimeExecutionMvpClosureDecision(
        readyClosureDecisionInput({ sourceBoundaryReportIncludedInEveryResponse: false }),
      ),
    ).toBe("blocked");
  });

  it("ready findings include stage10_adapter_boundary_design_allowed", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage10_adapter_boundary_design_allowed")).toBe(
      true,
    );
  });

  it("ready findings include stage10_actual_execution_disallowed", () => {
    expect(evaluateReadyClosure().findings.some((f) => f.code === "stage10_actual_execution_disallowed")).toBe(true);
  });
});

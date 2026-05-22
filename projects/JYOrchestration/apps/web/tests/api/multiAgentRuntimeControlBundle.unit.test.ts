import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeControlBundle,
  resolveRuntimeControlBundleDecision,
  validateRuntimeControlBundleItems,
  buildRuntimeControlBundleItems,
} from "@/lib/agents/evaluateRuntimeControlBundle";
import { evaluateRuntimeExecutionVerticalSlice } from "@/lib/agents/evaluateRuntimeExecutionVerticalSlice";
import {
  buildStage8AReadyVerticalSliceInput,
  buildStage8BConfirmedRuntimeControlBundleInput,
  buildStage8BReadyRuntimeControlBundleInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type {
  RuntimeControlBundleDecisionInput,
  RuntimeControlBundleItem,
} from "@/lib/agents/runtimeControlBundleTypes";

function readyControlDecisionInput(
  overrides: Partial<RuntimeControlBundleDecisionInput> = {},
): RuntimeControlBundleDecisionInput {
  return {
    sourceStage8Decision: "stage8_minimal_vertical_slice_ready",
    sourceChainExecuted: true,
    sourceFinalStatus: "mock_completed",
    sourceInMemoryOnly: true,
    sourceMockRunnerOnly: true,
    sourceActualRuntimeExecutionAllowedInThisStep: false,
    sourceActualApiRouteAllowedInThisStep: false,
    sourceActualExecutionRunnerAllowedInThisStep: false,
    sourceActualDryRunRunnerAllowedInThisStep: false,
    sourceActualCursorGithubCallAllowedInThisStep: false,
    sourceActualConnectorGatewayCallAllowedInThisStep: false,
    sourceActualDbWriteAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualUiAllowedInThisStep: false,
    validationValid: true,
    stage9EntryReady: true,
    confirmationsSatisfied: true,
    stage9RequiresSeparateApproval: true,
    stage9ImplementationAllowedInThisStep: false,
    ...overrides,
  };
}

function evaluateReadyControlBundle(
  input: Parameters<typeof evaluateRuntimeControlBundle>[0] = {},
) {
  return evaluateRuntimeControlBundle({ ...buildStage8BReadyRuntimeControlBundleInput(), ...input });
}

describe("multi-agent runtime control bundle stage 8-B", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeControlBundle().decision).toBe("defer");
  });

  it("Stage 8-A source defer propagates defer", () => {
    expect(
      evaluateRuntimeControlBundle({
        verticalSlice: buildStage8AReadyVerticalSliceInput(),
        runtimeControlBundleReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("Stage 8-A source blocked propagates blocked", () => {
    expect(
      evaluateRuntimeControlBundle({
        verticalSlice: {
          ...buildStage8AReadyVerticalSliceInput(),
          request: {
            ...buildStage8AReadyVerticalSliceInput().request!,
            actualExecutionRequested: true as false,
          },
        },
        ...buildStage8BConfirmedRuntimeControlBundleInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 8-A ready with six confirmations yields stage8_runtime_control_bundle_ready", () => {
    expect(evaluateReadyControlBundle().decision).toBe("stage8_runtime_control_bundle_ready");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeControlBundle({
        ...buildStage8BReadyRuntimeControlBundleInput(),
        stage9EntryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceChainExecuted is false", () => {
    expect(resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceChainExecuted: false }))).toBe(
      "blocked",
    );
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceFinalStatus is not mock_completed", () => {
    expect(
      resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceFinalStatus: "mock_failed" })),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceInMemoryOnly is false", () => {
    expect(resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceInMemoryOnly: false }))).toBe(
      "blocked",
    );
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceMockRunnerOnly is false", () => {
    expect(resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceMockRunnerOnly: false }))).toBe(
      "blocked",
    );
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualRuntimeExecutionAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(
        readyControlDecisionInput({ sourceActualRuntimeExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualApiRouteAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceActualApiRouteAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualExecutionRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(
        readyControlDecisionInput({ sourceActualExecutionRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualDryRunRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceActualDryRunRunnerAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualCursorGithubCallAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(
        readyControlDecisionInput({ sourceActualCursorGithubCallAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualConnectorGatewayCallAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(
        readyControlDecisionInput({ sourceActualConnectorGatewayCallAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualDbWriteAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceActualDbWriteAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualSchemaMigrationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(
        readyControlDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when sourceActualUiAllowedInThisStep is true", () => {
    expect(resolveRuntimeControlBundleDecision(readyControlDecisionInput({ sourceActualUiAllowedInThisStep: true }))).toBe(
      "blocked",
    );
  });

  it("builds eight control items on ready path", () => {
    expect(evaluateReadyControlBundle().controlItems).toHaveLength(8);
  });

  it("control items are all designOnly true", () => {
    expect(evaluateReadyControlBundle().controlItems.every((item) => item.designOnly === true)).toBe(true);
  });

  it("control items are all implementedInThisStep false", () => {
    expect(evaluateReadyControlBundle().controlItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("validation detects missing control item id", () => {
    const items = evaluateReadyControlBundle().controlItems.slice(1);
    expect(validateRuntimeControlBundleItems(items).missingItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate control item id", () => {
    const items = evaluateReadyControlBundle().controlItems;
    const duplicate: RuntimeControlBundleItem = { ...items[0] };
    expect(validateRuntimeControlBundleItems([...items, duplicate]).duplicateItemIds.length).toBe(1);
  });

  it("validation detects implemented item", () => {
    const items = evaluateReadyControlBundle().controlItems;
    const invalid = { ...items[0], implementedInThisStep: true as false };
    expect(validateRuntimeControlBundleItems([invalid]).implementedItemIds).toContain(items[0].itemId);
  });

  it("validation detects non designOnly item", () => {
    const items = evaluateReadyControlBundle().controlItems;
    const invalid = { ...items[0], designOnly: false as true };
    expect(validateRuntimeControlBundleItems([invalid]).nonDesignOnlyItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyControlBundle().controlItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateRuntimeControlBundleItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyControlBundle().controlItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateRuntimeControlBundleItems([invalid]).emptyApprovalItemIds).toContain(items[0].itemId);
  });

  it("stage9 entry item exists", () => {
    expect(
      evaluateReadyControlBundle().controlItems.some(
        (item) => item.itemId === "stage9-runtime-execution-orchestration-entry",
      ),
    ).toBe(true);
  });

  it("stage9 entry item has requiredBeforeStage9 true", () => {
    const stage9Item = evaluateReadyControlBundle().controlItems.find(
      (item) => item.itemId === "stage9-runtime-execution-orchestration-entry",
    );
    expect(stage9Item?.requiredBeforeStage9).toBe(true);
  });

  it("stage9EntryScope includes runtime_execution_api_route_handlers", () => {
    expect(evaluateReadyControlBundle().stage9EntryScope).toContain("runtime_execution_api_route_handlers");
  });

  it("stage9EntryScope includes runtime_execution_in_memory_store_service", () => {
    expect(evaluateReadyControlBundle().stage9EntryScope).toContain("runtime_execution_in_memory_store_service");
  });

  it("stage9EntryOutOfScope includes actual_cursor_github_execution", () => {
    expect(evaluateReadyControlBundle().stage9EntryOutOfScope).toContain("actual_cursor_github_execution");
  });

  it("stage9EntryOutOfScope includes actual_db_schema_migration", () => {
    expect(evaluateReadyControlBundle().stage9EntryOutOfScope).toContain("actual_db_schema_migration");
  });

  it("stage9RequiresSeparateApproval is true", () => {
    expect(evaluateReadyControlBundle().stage9RequiresSeparateApproval).toBe(true);
  });

  it("stage9ImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyControlBundle().stage9ImplementationAllowedInThisStep).toBe(false);
  });

  it("resolveRuntimeControlBundleDecision blocks when stage9RequiresSeparateApproval is false", () => {
    expect(
      resolveRuntimeControlBundleDecision(readyControlDecisionInput({ stage9RequiresSeparateApproval: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeControlBundleDecision blocks when stage9ImplementationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeControlBundleDecision(readyControlDecisionInput({ stage9ImplementationAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("controlBundleFingerprint is deterministic", () => {
    const first = evaluateReadyControlBundle();
    const second = evaluateReadyControlBundle();
    expect(first.controlBundleFingerprint).toBe(second.controlBundleFingerprint);
  });

  it("controlBundleFingerprint includes itemCount and stage9CandidateItemCount", () => {
    const report = evaluateReadyControlBundle();
    expect(report.controlBundleFingerprint).toContain("items:8");
    expect(report.controlBundleFingerprint).toContain("stage9Candidates:1");
  });

  it("ready findings include stage8_runtime_control_bundle_ready", () => {
    expect(evaluateReadyControlBundle().findings.some((f) => f.code === "stage8_runtime_control_bundle_ready")).toBe(
      true,
    );
  });

  it("ready findings include stage9_entry_candidate_defined", () => {
    expect(evaluateReadyControlBundle().findings.some((f) => f.code === "stage9_entry_candidate_defined")).toBe(true);
  });

  it("separatedWorkItems includes actual_cursor_github_execution", () => {
    expect(evaluateReadyControlBundle().separatedWorkItems).toContain("actual_cursor_github_execution");
  });

  it("recommendedNextPhases includes stage_9_a_runtime_execution_api_and_in_memory_store", () => {
    expect(evaluateReadyControlBundle().recommendedNextPhases).toContain(
      "stage_9_a_runtime_execution_api_and_in_memory_store",
    );
  });

  it("buildRuntimeControlBundleItems returns empty when source is not ready", () => {
    const source = evaluateRuntimeExecutionVerticalSlice();
    expect(buildRuntimeControlBundleItems(source)).toHaveLength(0);
  });

  it("ready report stage9EntryMode is in_memory_runtime_execution_api_mvp", () => {
    expect(evaluateReadyControlBundle().stage9EntryMode).toBe("in_memory_runtime_execution_api_mvp");
  });

  it("ready report stage9ApiRouteDesignAllowed is true", () => {
    expect(evaluateReadyControlBundle().stage9ApiRouteDesignAllowed).toBe(true);
  });

  it("ready report stage9InMemoryStoreAllowed is true", () => {
    expect(evaluateReadyControlBundle().stage9InMemoryStoreAllowed).toBe(true);
  });

  it("ready report stage9MockRunnerAdapterAllowed is true", () => {
    expect(evaluateReadyControlBundle().stage9MockRunnerAdapterAllowed).toBe(true);
  });

  it("ready report stage9ActualExternalExecutionAllowed is false", () => {
    expect(evaluateReadyControlBundle().stage9ActualExternalExecutionAllowed).toBe(false);
  });

  it("ready report stage9DbPersistenceAllowed is false", () => {
    expect(evaluateReadyControlBundle().stage9DbPersistenceAllowed).toBe(false);
  });

  it("ready report stage9UiImplementationAllowed is false", () => {
    expect(evaluateReadyControlBundle().stage9UiImplementationAllowed).toBe(false);
  });

  it("ready findings include stage9_api_route_design_allowed", () => {
    expect(evaluateReadyControlBundle().findings.some((f) => f.code === "stage9_api_route_design_allowed")).toBe(true);
  });

  it("ready findings include stage9_external_execution_disallowed", () => {
    expect(evaluateReadyControlBundle().findings.some((f) => f.code === "stage9_external_execution_disallowed")).toBe(
      true,
    );
  });
});

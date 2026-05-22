import { describe, expect, it } from "vitest";
import {
  evaluateActualExternalExecutionAdapterCandidate,
  resolveActualExternalExecutionAdapterCandidateDecision,
  validateActualExternalExecutionAdapterCandidateItems,
  buildActualExternalExecutionAdapterCandidateItems,
} from "@/lib/agents/evaluateActualExternalExecutionAdapterCandidate";
import { evaluateExternalExecutionManualDryRunGate } from "@/lib/agents/evaluateExternalExecutionManualDryRunGate";
import {
  buildStage10AReadyExternalExecutionAdapterBoundaryInput,
  buildStage11AConfirmedExternalExecutionDryRunPackageInput,
  buildStage12AConfirmedExternalExecutionManualDryRunGateInput,
  buildStage12AReadyExternalExecutionManualDryRunGateInput,
  buildStage13AConfirmedActualExternalExecutionAdapterCandidateInput,
  buildStage13AReadyActualExternalExecutionAdapterCandidateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { ActualExternalExecutionAdapterCandidateDecisionInput } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ActualExternalExecutionAdapterCandidateItem } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

function readyCandidateDecisionInput(
  overrides: Partial<ActualExternalExecutionAdapterCandidateDecisionInput> = {},
): ActualExternalExecutionAdapterCandidateDecisionInput {
  return {
    sourceStage12Decision: "stage12_external_execution_manual_dry_run_gate_ready",
    sourceStage13EntryReady: true,
    sourceActualAdapterCandidateDesignAllowed: true,
    sourceActualAdapterImplementationAllowedInThisStep: false,
    sourceCursorAdapterCandidateAllowed: true,
    sourceGithubAdapterCandidateAllowed: true,
    sourceConnectorAdapterCandidateAllowed: true,
    sourceRunnerAdapterCandidateAllowed: true,
    sourceStage13CandidateBoundaryRequiredBeforeActualImplementation: true,
    sourceActualCursorAdapterImplementedInThisStep: false,
    sourceActualGithubAdapterImplementedInThisStep: false,
    sourceActualConnectorAdapterImplementedInThisStep: false,
    sourceActualRunnerAdapterImplementedInThisStep: false,
    sourceActualAdapterCredentialUsageAllowedInThisStep: false,
    sourceActualNetworkSideEffectAllowedInThisStep: false,
    validationValid: true,
    stage14EntryReady: true,
    confirmationsSatisfied: true,
    stage14RequiresSeparateApproval: true,
    stage14ImplementationAllowedInThisStep: false,
    ...overrides,
  };
}

function evaluateReadyCandidate(
  input: Parameters<typeof evaluateActualExternalExecutionAdapterCandidate>[0] = {},
) {
  return evaluateActualExternalExecutionAdapterCandidate({
    ...buildStage13AReadyActualExternalExecutionAdapterCandidateInput(),
    ...input,
  });
}

describe("multi-agent actual external execution adapter candidate stage 13-A", () => {
  it("default input defers", () => {
    expect(evaluateActualExternalExecutionAdapterCandidate().decision).toBe("defer");
  });

  it("Stage 12-A source defer propagates defer", () => {
    expect(
      evaluateActualExternalExecutionAdapterCandidate({
        manualDryRunGate: {
          ...buildStage12AReadyExternalExecutionManualDryRunGateInput(),
          stage13EntryReviewed: false,
        },
        ...buildStage13AConfirmedActualExternalExecutionAdapterCandidateInput(),
      }).decision,
    ).toBe("defer");
  });

  it("Stage 12-A source blocked propagates blocked", () => {
    expect(
      evaluateActualExternalExecutionAdapterCandidate({
        manualDryRunGate: {
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
        },
        ...buildStage13AConfirmedActualExternalExecutionAdapterCandidateInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("Stage 12-A ready with eleven confirmations yields stage13_actual_external_execution_adapter_candidate_ready", () => {
    expect(evaluateReadyCandidate().decision).toBe("stage13_actual_external_execution_adapter_candidate_ready");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateActualExternalExecutionAdapterCandidate({
        ...buildStage13AReadyActualExternalExecutionAdapterCandidateInput(),
        stage14EntryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision defers when sourceStage13EntryReady is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(readyCandidateDecisionInput({ sourceStage13EntryReady: false })),
    ).toBe("defer");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualAdapterCandidateDesignAllowed is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualAdapterCandidateDesignAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualAdapterImplementationAllowedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualAdapterImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceCursorAdapterCandidateAllowed is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceCursorAdapterCandidateAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceGithubAdapterCandidateAllowed is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceGithubAdapterCandidateAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceConnectorAdapterCandidateAllowed is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceConnectorAdapterCandidateAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceRunnerAdapterCandidateAllowed is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceRunnerAdapterCandidateAllowed: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceStage13CandidateBoundaryRequiredBeforeActualImplementation is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceStage13CandidateBoundaryRequiredBeforeActualImplementation: false }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualCursorAdapterImplementedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualCursorAdapterImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualGithubAdapterImplementedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualGithubAdapterImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualConnectorAdapterImplementedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualConnectorAdapterImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualRunnerAdapterImplementedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualRunnerAdapterImplementedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualAdapterCredentialUsageAllowedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualAdapterCredentialUsageAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when sourceActualNetworkSideEffectAllowedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ sourceActualNetworkSideEffectAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when validationValid is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(readyCandidateDecisionInput({ validationValid: false })),
    ).toBe("blocked");
  });

  it("builds eleven candidate items on ready path", () => {
    expect(evaluateReadyCandidate().candidateItems).toHaveLength(11);
  });

  it("candidate items are all candidateOnly true", () => {
    expect(evaluateReadyCandidate().candidateItems.every((item) => item.candidateOnly === true)).toBe(true);
  });

  it("candidate items are all implementedInThisStep false", () => {
    expect(evaluateReadyCandidate().candidateItems.every((item) => item.implementedInThisStep === false)).toBe(true);
  });

  it("candidate items are all actualExternalExecutionAllowedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualExternalExecutionAllowedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all actualCursorAdapterImplementedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualCursorAdapterImplementedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all actualGithubAdapterImplementedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualGithubAdapterImplementedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all actualConnectorAdapterImplementedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualConnectorAdapterImplementedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all actualRunnerAdapterImplementedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualRunnerAdapterImplementedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all actualAdapterCredentialUsageAllowedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every(
        (item) => item.actualAdapterCredentialUsageAllowedInThisStep === false,
      ),
    ).toBe(true);
  });

  it("candidate items are all actualNetworkSideEffectAllowedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualNetworkSideEffectAllowedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all actualDbPersistenceAllowedInThisStep false", () => {
    expect(evaluateReadyCandidate().candidateItems.every((item) => item.actualDbPersistenceAllowedInThisStep === false)).toBe(
      true,
    );
  });

  it("candidate items are all actualUiImplementationAllowedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.actualUiImplementationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("candidate items are all agentRegistryMutationAllowedInThisStep false", () => {
    expect(
      evaluateReadyCandidate().candidateItems.every((item) => item.agentRegistryMutationAllowedInThisStep === false),
    ).toBe(true);
  });

  it("validation detects missing candidate item id", () => {
    const items = evaluateReadyCandidate().candidateItems.slice(1);
    expect(validateActualExternalExecutionAdapterCandidateItems(items).missingItemIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate candidate item id", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const duplicate: ActualExternalExecutionAdapterCandidateItem = { ...items[0] };
    expect(validateActualExternalExecutionAdapterCandidateItems([...items, duplicate]).duplicateItemIds.length).toBe(1);
  });

  it("validation detects implementedInThisStep on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], implementedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).implementedItemIds).toContain(items[0].itemId);
  });

  it("validation detects non candidateOnly item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], candidateOnly: false as true };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).nonCandidateOnlyItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects external execution allowed on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualExternalExecutionAllowedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).externalExecutionAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects cursor adapter implemented on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualCursorAdapterImplementedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).cursorAdapterImplementedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects github adapter implemented on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualGithubAdapterImplementedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).githubAdapterImplementedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects connector adapter implemented on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualConnectorAdapterImplementedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).connectorAdapterImplementedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects runner adapter implemented on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualRunnerAdapterImplementedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).runnerAdapterImplementedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects adapter credential usage allowed on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualAdapterCredentialUsageAllowedInThisStep: true as false };
    expect(
      validateActualExternalExecutionAdapterCandidateItems([invalid]).adapterCredentialUsageAllowedItemIds,
    ).toContain(items[0].itemId);
  });

  it("validation detects network side effect allowed on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualNetworkSideEffectAllowedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).networkSideEffectAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects db persistence allowed on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualDbPersistenceAllowedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).dbPersistenceAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects ui implementation allowed on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], actualUiImplementationAllowedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).uiImplementationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects agent registry mutation allowed on item", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], agentRegistryMutationAllowedInThisStep: true as false };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).agentRegistryMutationAllowedItemIds).toContain(
      items[0].itemId,
    );
  });

  it("validation detects empty approval", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], requiredApprovals: [] as string[] };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).emptyApprovalItemIds).toContain(items[0].itemId);
  });

  it("validation detects empty forbidden boundary", () => {
    const items = evaluateReadyCandidate().candidateItems;
    const invalid = { ...items[0], forbiddenInThisStep: [] as string[] };
    expect(validateActualExternalExecutionAdapterCandidateItems([invalid]).emptyForbiddenBoundaryItemIds).toContain(
      items[0].itemId,
    );
  });

  it("stage14 entry item exists", () => {
    expect(
      evaluateReadyCandidate().candidateItems.some(
        (item) => item.itemId === "stage14-operator-approved-actual-execution-entry",
      ),
    ).toBe(true);
  });

  it("stage14 entry item has requiredBeforeStage14 true", () => {
    const stage14Item = evaluateReadyCandidate().candidateItems.find(
      (item) => item.itemId === "stage14-operator-approved-actual-execution-entry",
    );
    expect(stage14Item?.requiredBeforeStage14).toBe(true);
  });

  it("stage14EntryScope includes operator_approved_actual_external_execution", () => {
    expect(evaluateReadyCandidate().stage14EntryScope).toContain("operator_approved_actual_external_execution");
  });

  it("stage14EntryOutOfScope includes unapproved_cursor_execution", () => {
    expect(evaluateReadyCandidate().stage14EntryOutOfScope).toContain("unapproved_cursor_execution");
  });

  it("stage14RequiresSeparateApproval is true", () => {
    expect(evaluateReadyCandidate().stage14RequiresSeparateApproval).toBe(true);
  });

  it("stage14ImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().stage14ImplementationAllowedInThisStep).toBe(false);
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when stage14RequiresSeparateApproval is false", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(readyCandidateDecisionInput({ stage14RequiresSeparateApproval: false })),
    ).toBe("blocked");
  });

  it("resolveActualExternalExecutionAdapterCandidateDecision blocks when stage14ImplementationAllowedInThisStep is true", () => {
    expect(
      resolveActualExternalExecutionAdapterCandidateDecision(
        readyCandidateDecisionInput({ stage14ImplementationAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("candidateFingerprint is deterministic", () => {
    const first = evaluateReadyCandidate();
    const second = evaluateReadyCandidate();
    expect(first.candidateFingerprint).toBe(second.candidateFingerprint);
  });

  it("ready findings include stage13_actual_external_execution_adapter_candidate_ready", () => {
    expect(
      evaluateReadyCandidate().findings.some((f) => f.code === "stage13_actual_external_execution_adapter_candidate_ready"),
    ).toBe(true);
  });

  it("ready findings include agent_registry_change_boundary_separated", () => {
    expect(evaluateReadyCandidate().findings.some((f) => f.code === "agent_registry_change_boundary_separated")).toBe(true);
  });

  it("separatedWorkItems includes actual_credential_store_integration", () => {
    expect(evaluateReadyCandidate().separatedWorkItems).toContain("actual_credential_store_integration");
  });

  it("recommendedNextPhases includes stage_14_a_operator_approved_actual_external_execution", () => {
    expect(evaluateReadyCandidate().recommendedNextPhases).toContain(
      "stage_14_a_operator_approved_actual_external_execution",
    );
  });

  it("buildActualExternalExecutionAdapterCandidateItems returns empty when source is not ready", () => {
    const source = evaluateExternalExecutionManualDryRunGate();
    expect(buildActualExternalExecutionAdapterCandidateItems(source)).toHaveLength(0);
  });
});

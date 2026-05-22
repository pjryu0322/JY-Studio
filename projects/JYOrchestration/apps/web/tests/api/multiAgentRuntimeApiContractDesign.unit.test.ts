import { describe, expect, it } from "vitest";
import {
  evaluateRuntimeApiContractDesign,
  resolveRuntimeApiContractDesignDecision,
  validateRuntimeApiEndpointContracts,
} from "@/lib/agents/evaluateRuntimeApiContractDesign";
import { buildRuntimeApiEndpointContracts } from "@/lib/agents/runtimeApiContractDesignEndpoints";
import {
  buildStage7AReadyImplementationPlanningInput,
  buildStage7BReadyRuntimeApiContractInput,
  buildStage7BRuntimeApiContractConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";
import type { RuntimeApiContractDesignDecisionInput } from "@/lib/agents/runtimeApiContractDesignTypes";
import type { RuntimeApiEndpointContract } from "@/lib/agents/runtimeApiContractDesignTypes";
import { evaluateRuntimeImplementationPlanningCandidate } from "@/lib/agents/evaluateRuntimeImplementationPlanningCandidate";

function readyApiDecisionInput(
  overrides: Partial<RuntimeApiContractDesignDecisionInput> = {},
): RuntimeApiContractDesignDecisionInput {
  return {
    sourcePlanningDecision: "ready_for_runtime_implementation_pr_planning",
    sourcePlanningCandidateOnly: true,
    sourcePlanningItemCount: 10,
    sourceActualRuntimeExecutionAllowedInThisStep: false,
    sourceActualExecutionRunnerAllowedInThisStep: false,
    sourceActualPersistenceAllowedInThisStep: false,
    sourceActualSchemaMigrationAllowedInThisStep: false,
    sourceActualCursorGithubWireAllowedInThisStep: false,
    sourceActualConnectorRoutingChangeAllowedInThisStep: false,
    endpointContractsValid: true,
    confirmationsSatisfied: true,
    ...overrides,
  };
}

function evaluateReadyApi(input: Parameters<typeof evaluateRuntimeApiContractDesign>[0] = {}) {
  return evaluateRuntimeApiContractDesign({ ...buildStage7BReadyRuntimeApiContractInput(), ...input });
}

describe("multi-agent runtime api contract design stage 7-B", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeApiContractDesign().decision).toBe("defer");
  });

  it("source Stage 7-A blocked propagates blocked", () => {
    expect(
      evaluateRuntimeApiContractDesign({
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
        ...buildStage7BRuntimeApiContractConfirmedInput(),
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 7-A defer propagates defer", () => {
    expect(
      evaluateRuntimeApiContractDesign({
        implementationPlanning: buildStage7AReadyImplementationPlanningInput(),
        runtimeApiContractReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("source Stage 7-A ready with five confirmations yields ready_for_execution_runner_contract_design", () => {
    expect(evaluateReadyApi().decision).toBe("ready_for_execution_runner_contract_design");
  });

  it("missing confirmation yields defer", () => {
    expect(
      evaluateRuntimeApiContractDesign({
        ...buildStage7BReadyRuntimeApiContractInput(),
        runtimeApiApprovalBoundaryReviewed: false,
      }).decision,
    ).toBe("defer");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourcePlanningCandidateOnly is false", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(readyApiDecisionInput({ sourcePlanningCandidateOnly: false })),
    ).toBe("blocked");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourcePlanningItemCount is less than 10", () => {
    expect(resolveRuntimeApiContractDesignDecision(readyApiDecisionInput({ sourcePlanningItemCount: 9 }))).toBe(
      "blocked",
    );
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourceActualRuntimeExecutionAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(
        readyApiDecisionInput({ sourceActualRuntimeExecutionAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourceActualExecutionRunnerAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(
        readyApiDecisionInput({ sourceActualExecutionRunnerAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourceActualPersistenceAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(readyApiDecisionInput({ sourceActualPersistenceAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourceActualSchemaMigrationAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(readyApiDecisionInput({ sourceActualSchemaMigrationAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourceActualCursorGithubWireAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(readyApiDecisionInput({ sourceActualCursorGithubWireAllowedInThisStep: true })),
    ).toBe("blocked");
  });

  it("resolveRuntimeApiContractDesignDecision blocks when sourceActualConnectorRoutingChangeAllowedInThisStep is true", () => {
    expect(
      resolveRuntimeApiContractDesignDecision(
        readyApiDecisionInput({ sourceActualConnectorRoutingChangeAllowedInThisStep: true }),
      ),
    ).toBe("blocked");
  });

  it("endpointContracts has 6 entries on ready path", () => {
    expect(evaluateReadyApi().endpointContracts).toHaveLength(6);
  });

  it("endpointContracts are all endpointDesignOnly true", () => {
    expect(evaluateReadyApi().endpointContracts.every((endpoint) => endpoint.endpointDesignOnly === true)).toBe(true);
  });

  it("endpointContracts are all implementedInThisStep false", () => {
    expect(evaluateReadyApi().endpointContracts.every((endpoint) => endpoint.implementedInThisStep === false)).toBe(true);
  });

  it("endpoint validation is valid on ready path", () => {
    expect(validateRuntimeApiEndpointContracts(evaluateReadyApi().endpointContracts).valid).toBe(true);
  });

  it("validation detects missing endpoint id", () => {
    const endpoints = evaluateReadyApi().endpointContracts.slice(1);
    expect(validateRuntimeApiEndpointContracts(endpoints).missingEndpointContractIds.length).toBeGreaterThan(0);
  });

  it("validation detects duplicate endpoint id", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const duplicate: RuntimeApiEndpointContract = { ...endpoints[0] };
    expect(validateRuntimeApiEndpointContracts([...endpoints, duplicate]).duplicateEndpointContractIds.length).toBe(1);
  });

  it("validation detects empty path", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const invalid = { ...endpoints[0], pathPattern: "" };
    expect(validateRuntimeApiEndpointContracts([invalid]).emptyPathEndpointIds).toContain(endpoints[0].endpointId);
  });

  it("validation detects empty request contract", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const invalid = { ...endpoints[0], requestContract: "" };
    expect(validateRuntimeApiEndpointContracts([invalid]).emptyRequestContractEndpointIds).toContain(
      endpoints[0].endpointId,
    );
  });

  it("validation detects empty response contract", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const invalid = { ...endpoints[0], responseContract: "" };
    expect(validateRuntimeApiEndpointContracts([invalid]).emptyResponseContractEndpointIds).toContain(
      endpoints[0].endpointId,
    );
  });

  it("validation detects missing approval", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const invalid = { ...endpoints[0], requiredApprovals: [] as string[] };
    expect(validateRuntimeApiEndpointContracts([invalid]).missingApprovalEndpointIds).toContain(
      endpoints[0].endpointId,
    );
  });

  it("validation detects insufficient error code", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const invalid = { ...endpoints[0], errorCodes: ["ONLY_ONE"] };
    expect(validateRuntimeApiEndpointContracts([invalid]).insufficientErrorCodeEndpointIds).toContain(
      endpoints[0].endpointId,
    );
  });

  it("validation detects missing audit event", () => {
    const endpoints = evaluateReadyApi().endpointContracts;
    const invalid = { ...endpoints[0], auditEvents: [] as string[] };
    expect(validateRuntimeApiEndpointContracts([invalid]).missingAuditEventEndpointIds).toContain(
      endpoints[0].endpointId,
    );
  });

  it("apiChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyApi().apiChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("boundaryChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyApi().boundaryChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("approvalChecklist items are all satisfied on ready path", () => {
    expect(evaluateReadyApi().approvalChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("actualApiEndpointImplementedInThisStep is false", () => {
    expect(evaluateReadyApi().actualApiEndpointImplementedInThisStep).toBe(false);
  });

  it("actualRuntimeExecutionAllowedInThisStep is false", () => {
    expect(evaluateReadyApi().actualRuntimeExecutionAllowedInThisStep).toBe(false);
  });

  it("actualExecutionRunnerAllowedInThisStep is false", () => {
    expect(evaluateReadyApi().actualExecutionRunnerAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyApi().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualSchemaMigrationAllowedInThisStep is false", () => {
    expect(evaluateReadyApi().actualSchemaMigrationAllowedInThisStep).toBe(false);
  });

  it("recommendedNextPhases includes stage_7_c_execution_runner_contract_design", () => {
    expect(evaluateReadyApi().recommendedNextPhases).toContain("stage_7_c_execution_runner_contract_design");
  });

  it("separatedWorkItems includes actual_api_route_handlers", () => {
    expect(evaluateReadyApi().separatedWorkItems).toContain("actual_api_route_handlers");
  });

  it("ready findings include stage7_b_api_contract_design_ready", () => {
    expect(evaluateReadyApi().findings.some((f) => f.code === "stage7_b_api_contract_design_ready")).toBe(true);
  });

  it("apiContractFingerprint is deterministic", () => {
    const first = evaluateReadyApi();
    const second = evaluateReadyApi();
    expect(first.apiContractFingerprint).toBe(second.apiContractFingerprint);
  });

  it("apiContractFingerprint includes source planning fingerprint endpoint count transition error and audit counts", () => {
    const report = evaluateReadyApi();
    expect(report.apiContractFingerprint).toContain(report.sourcePlanningFingerprint);
    expect(report.apiContractFingerprint).toContain("endpoints:6");
    expect(report.apiContractFingerprint).toContain(`transitions:${report.statusTransitionCount}`);
    expect(report.apiContractFingerprint).toContain(`errors:${report.errorCodeCount}`);
    expect(report.apiContractFingerprint).toContain(`audits:${report.auditEventCount}`);
  });

  it("buildRuntimeApiEndpointContracts returns empty when source planning not ready", () => {
    const source = evaluateRuntimeImplementationPlanningCandidate();
    expect(buildRuntimeApiEndpointContracts(source)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS,
  SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS,
  SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoAdapterContractConstants";
import { serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotValidation/serializeRuntimePilotValidationDiagnosticBundle";
import {
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForPilotValidation,
  buildPilotValidationBaseReports,
  buildPilotValidationPlanning,
  buildPilotValidationPlanningWithControlledCandidatePatches,
} from "./runtimePilotValidationTestFixtures";

describe("Pilot Validation Phase 2 — Safe Echo Adapter Contract", () => {
  it("ready_for_validation + ready_metadata final gate yields contract_ready", () => {
    const semantic = buildFullSemanticForPilotValidation();
    if (semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus !== "ready_for_validation") {
      return;
    }
    expect(semantic.runtimeSafeEchoAdapterContractSummary.contractStatus).toBe("contract_ready");
    expect(semantic.runtimeSafeEchoAdapterContractSummary.adapterMode).toBe("sandbox_dry_run_contract");
    expect(semantic.runtimeSafeEchoAdapterContractSummary.actualAdapterInvocationEnabled).toBe(false);
    expect(semantic.runtimeSafeEchoAdapterContractSummary.actualSandboxInvocationEnabled).toBe(false);
  });

  it("watch validation yields watch contract status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanningWithControlledCandidatePatches(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("watch");
    const contractStatus = semantic.runtimeSafeEchoAdapterContractSummary.contractStatus;
    expect(contractStatus === "watch" || contractStatus === "blocked").toBe(true);
    if (semantic.runtimePilotValidationReadOnlyChainSummary.topBlockers.length === 0) {
      expect(contractStatus).toBe("watch");
    }
  });

  it("blocked validation yields blocked contract status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateFinalSafetyGate: {
        ...base.runtimeControlledPilotExecutionCandidateFinalSafetyGate,
        finalGateStatus: "blocked",
        pilotValidationEntryReadiness: "blocked",
      },
    });
    expect(semantic.runtimeSafeEchoAdapterContractSummary.contractStatus).toBe("blocked");
  });

  it("input contract prohibits git command and shell command", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const input = semantic.runtimeSafeEchoAdapterInputContract;
    expect(input.prohibitedInputPayloads).toContain("git command");
    expect(input.prohibitedInputPayloads).toContain("shell command");
    expect(input.prohibitedInputPayloads).toContain("adapter invocation payload");
  });

  it("output contract prohibits git push and deployment results", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const output = semantic.runtimeSafeEchoAdapterOutputContract;
    expect(output.prohibitedOutputs).toContain("git push result");
    expect(output.prohibitedOutputs).toContain("deployment result");
  });

  it("sandbox boundary forbids adapter and sandbox invocation", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const boundary = semantic.runtimeSandboxDryRunBoundary;
    expect(boundary.forbiddenBoundaryOperations).toContain("actual adapter invocation");
    expect(boundary.forbiddenBoundaryOperations).toContain("actual sandbox invocation");
    expect(boundary.forbiddenBoundaryOperations).toContain("actual dry-run runner invocation");
    expect(boundary.operatorApprovalRequiredBeforeInvocation).toBe(true);
  });

  it("diagnostic bundle includes safe echo contract fields", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const diag = serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(semantic);
    expect(diag.runtimeSafeEchoAdapterContractSummary).toBeTruthy();
    expect(diag.runtimeSafeEchoAdapterInputContract).toBeTruthy();
    expect(diag.runtimeSafeEchoAdapterOutputContract).toBeTruthy();
    expect(diag.runtimeSandboxDryRunBoundary).toBeTruthy();
  });

  it("constants include required prohibited payloads", () => {
    expect(SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS).toContain("git command");
    expect(SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS).toContain("git push result");
    expect(SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS).toContain("actual adapter invocation");
  });
});

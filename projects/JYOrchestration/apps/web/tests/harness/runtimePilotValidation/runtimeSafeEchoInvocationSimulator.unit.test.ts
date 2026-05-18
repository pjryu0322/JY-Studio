import { describe, expect, it } from "vitest";

import { SAFE_ECHO_SIMULATOR_REJECTED_INPUT_ROWS } from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoInvocationSimulatorConstants";
import {
  resolveRuntimeSafeEchoInvocationSimulatorMode,
  resolveRuntimeSafeEchoInvocationSimulatorStatus,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoInvocationSimulatorCheckHelpers";
import { serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotValidation/serializeRuntimePilotValidationDiagnosticBundle";
import { buildPilotValidationUserSummaryVmFromReports } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import {
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForPilotValidation,
  buildPilotValidationBaseReports,
  buildPilotValidationPlanning,
  buildPilotValidationPlanningWithControlledCandidatePatches,
} from "./runtimePilotValidationTestFixtures";

describe("Pilot Validation Phase 4 — Safe Echo invocation simulator contract", () => {
  it("ready chain yields simulator_contract_ready with read_only_echo_simulation_contract mode", () => {
    const semantic = buildFullSemanticForPilotValidation();
    if (semantic.runtimeSafeEchoAdapterContractSummary.contractStatus !== "contract_ready") {
      return;
    }
    if (semantic.runtimePilotValidationRequestDraft.draftStatus !== "draft_ready") {
      return;
    }
    const simulator = semantic.runtimeSafeEchoInvocationSimulatorSummary;
    expect(simulator.simulatorStatus).toBe("simulator_contract_ready");
    expect(simulator.simulatorMode).toBe("read_only_echo_simulation_contract");
    expect(simulator.actualAdapterInvocationEnabled).toBe(false);
    expect(simulator.actualSandboxInvocationEnabled).toBe(false);
  });

  it("approval review_required yields watch simulator status", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const status = resolveRuntimeSafeEchoInvocationSimulatorStatus({
      draft: { ...semantic.runtimePilotValidationRequestDraft, draftStatus: "draft_ready", blockers: [] },
      approvalSnapshot: {
        ...semantic.runtimePilotValidationOperatorApprovalSnapshot,
        approvalSnapshotStatus: "review_required",
      },
      auditTrace: {
        ...semantic.runtimePilotValidationAuditTraceCandidate,
        auditTraceStatus: "audit_trace_candidate_ready",
      },
      rollbackPlan: {
        ...semantic.runtimePilotValidationRollbackPlanCandidate,
        rollbackPlanStatus: "rollback_plan_candidate_ready",
      },
      contract: {
        ...semantic.runtimeSafeEchoAdapterContractSummary,
        contractStatus: "contract_ready",
      },
    });
    expect(status).toBe("watch");
    expect(resolveRuntimeSafeEchoInvocationSimulatorMode(status)).toBe("simulator_contract_only");
  });

  it("draft watch yields watch simulator status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanningWithControlledCandidatePatches(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    const draftStatus = semantic.runtimePilotValidationRequestDraft.draftStatus;
    expect(draftStatus === "watch" || draftStatus === "blocked").toBe(true);
    if (draftStatus === "watch") {
      expect(semantic.runtimeSafeEchoInvocationSimulatorSummary.simulatorStatus).toBe("watch");
    }
  });

  it("draft blocked yields blocked simulator status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimePilotValidationRequestDraft: {
        ...base.runtimePilotValidationRequestDraft,
        draftStatus: "blocked",
        blockers: ["draft:blocked"],
      },
    });
    expect(semantic.runtimeSafeEchoInvocationSimulatorSummary.simulatorStatus).toBe("blocked");
    expect(semantic.runtimeSafeEchoInvocationSimulatorSummary.simulatorMode).toBe("blocked");
  });

  it("audit blocked yields blocked simulator status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimePilotValidationAuditTraceCandidate: {
        ...base.runtimePilotValidationAuditTraceCandidate,
        auditTraceStatus: "blocked",
      },
    });
    expect(semantic.runtimeSafeEchoInvocationSimulatorSummary.simulatorStatus).toBe("blocked");
  });

  it("rollback blocked yields blocked simulator status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimePilotValidationRollbackPlanCandidate: {
        ...base.runtimePilotValidationRollbackPlanCandidate,
        rollbackPlanStatus: "blocked",
      },
    });
    expect(semantic.runtimeSafeEchoInvocationSimulatorSummary.simulatorStatus).toBe("blocked");
  });

  it("simulator input rejects git command and adapter invocation payload", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const input = semantic.runtimeSafeEchoInvocationSimulatorInput;
    expect(input.rejectedInputRows).toEqual(expect.arrayContaining([...SAFE_ECHO_SIMULATOR_REJECTED_INPUT_ROWS]));
    expect(input.rejectedInputRows).toContain("git command");
    expect(input.rejectedInputRows).toContain("adapter invocation payload");
    expect(input.actualAdapterInvocationEnabled).toBe(false);
  });

  it("simulator output prohibits adapter invocation result", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const output = semantic.runtimeSafeEchoInvocationSimulatorOutput;
    expect(output.prohibitedSimulationOutputs).toContain("adapter invocation result");
    expect(output.actualExecutionEnabled).toBe(false);
  });

  it("simulator boundary forbids adapter, sandbox, and dry-run runner invocation", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const boundary = semantic.runtimeSafeEchoInvocationSimulatorBoundary;
    expect(boundary.forbiddenSimulatorOperations).toContain("actual adapter invocation");
    expect(boundary.forbiddenSimulatorOperations).toContain("actual sandbox invocation");
    expect(boundary.forbiddenSimulatorOperations).toContain("actual dry-run runner invocation");
    expect(boundary.simulationDoesNotInvokeAdapter).toBe(true);
    expect(boundary.simulationDoesNotInvokeSandbox).toBe(true);
    expect(boundary.simulationDoesNotInvokeRunner).toBe(true);
  });

  it("diagnostic bundle includes simulator fields", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const diag = serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(semantic);
    expect(diag.runtimeSafeEchoInvocationSimulatorSummary).toBeTruthy();
    expect(diag.runtimeSafeEchoInvocationSimulatorInput).toBeTruthy();
    expect(diag.runtimeSafeEchoInvocationSimulatorOutput).toBeTruthy();
    expect(diag.runtimeSafeEchoInvocationSimulatorBoundary).toBeTruthy();
  });

  it("user VM displays simulator contract status labels", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const vm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(vm.simulatorContractStatusKo.length).toBeGreaterThan(0);
    expect(vm.simulatorModeKo.length).toBeGreaterThan(0);
    expect(vm.simulatorNoInvocationNoticeKo).toContain("실제 Adapter/Sandbox/Runner 호출 없음");
    expect(vm.simulatorNoInvocationNoticeKo).not.toContain("시뮬레이터 실행됨");
    expect(vm.simulatorNoInvocationNoticeKo).not.toContain("Adapter 호출됨");
  });
});

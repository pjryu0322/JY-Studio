/**
 * Pilot Validation Phase 4 — Safe Echo invocation simulator contract (read-only, no invocation).
 */

import type { RuntimeSafeEchoAdapterActualFlagsDisabled } from "./runtimeSafeEchoAdapterContractTypes";

export type RuntimeSafeEchoInvocationSimulatorStatus =
  | "simulator_contract_ready"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimeSafeEchoInvocationSimulatorMode =
  | "simulator_contract_only"
  | "read_only_echo_simulation_contract"
  | "blocked";

export type RuntimeSafeEchoInvocationSimulatorInput = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_invocation_simulator_input";
    sourceRequestDraftIdCandidate: string;
    acceptedInputRows: readonly string[];
    rejectedInputRows: readonly string[];
    requiredApprovalRows: readonly string[];
    requiredAuditRows: readonly string[];
    requiredRollbackRows: readonly string[];
  }
>;

export type RuntimeSafeEchoInvocationSimulatorOutput = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_invocation_simulator_output";
    expectedSimulationOutputs: readonly string[];
    prohibitedSimulationOutputs: readonly string[];
    auditEchoRows: readonly string[];
    rollbackEchoRows: readonly string[];
  }
>;

export type RuntimeSafeEchoInvocationSimulatorBoundary = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_invocation_simulator_boundary";
    boundarySourceLayer: "runtimePilotValidationRequestDraft";
    boundaryTargetLayer: "safeEchoInvocationSimulatorContract";
    allowedSimulatorScopes: readonly string[];
    forbiddenSimulatorOperations: readonly string[];
    simulationDoesNotInvokeAdapter: true;
    simulationDoesNotInvokeSandbox: true;
    simulationDoesNotInvokeRunner: true;
    simulationDoesNotModifySource: true;
  }
>;

export type RuntimeSafeEchoInvocationSimulatorSummary = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_invocation_simulator_summary";
    simulatorStatus: RuntimeSafeEchoInvocationSimulatorStatus;
    simulatorMode: RuntimeSafeEchoInvocationSimulatorMode;
    rationaleKo: string;
    blockers: readonly string[];
    warnings: readonly string[];
    recommendations: readonly string[];
  }
>;

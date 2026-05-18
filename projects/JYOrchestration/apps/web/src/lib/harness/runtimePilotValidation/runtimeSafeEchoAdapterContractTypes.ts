/**
 * Pilot Validation Phase 2 — Safe Echo Adapter Contract & Sandbox dry-run boundary (read-only).
 */

export type RuntimeSafeEchoAdapterContractStatus = "contract_ready" | "watch" | "blocked" | "not_ready";

export type RuntimeSafeEchoAdapterMode = "contract_only" | "sandbox_dry_run_contract" | "blocked";

export type RuntimeSafeEchoAdapterActualFlagsDisabled = Readonly<{
  actualAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualPilotExecutionEnabled: false;
  actualExecutionEnabled: false;
}>;

export type RuntimeSafeEchoAdapterInputContract = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_adapter_input_contract";
    requiredInputs: readonly string[];
    acceptedInputMetadata: readonly string[];
    prohibitedInputPayloads: readonly string[];
    validationRules: readonly string[];
  }
>;

export type RuntimeSafeEchoAdapterOutputContract = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_adapter_output_contract";
    expectedOutputs: readonly string[];
    prohibitedOutputs: readonly string[];
    auditMetadataRows: readonly string[];
  }
>;

export type RuntimeSandboxDryRunBoundary = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_sandbox_dry_run_boundary";
    boundarySourceLayer: "runtimePilotValidationReadOnlyChainSummary";
    boundaryTargetLayer: "safeEchoAdapterContract";
    allowedBoundaryScopes: readonly string[];
    forbiddenBoundaryOperations: readonly string[];
    operatorApprovalRequiredBeforeInvocation: true;
    auditTraceRequired: true;
    rollbackPlanRequired: true;
  }
>;

export type RuntimeSafeEchoAdapterContractSummary = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_safe_echo_adapter_contract_summary";
    contractStatus: RuntimeSafeEchoAdapterContractStatus;
    adapterMode: RuntimeSafeEchoAdapterMode;
    rationaleKo: string;
    blockers: readonly string[];
    warnings: readonly string[];
    recommendations: readonly string[];
  }
>;

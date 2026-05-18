/**
 * Pilot Validation Phase 2 — Safe Echo Adapter contract reports (no invocation).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  SAFE_ECHO_ADAPTER_ACCEPTED_INPUT_METADATA,
  SAFE_ECHO_ADAPTER_AUDIT_METADATA_ROWS,
  SAFE_ECHO_ADAPTER_EXPECTED_OUTPUTS,
  SAFE_ECHO_ADAPTER_INPUT_VALIDATION_RULES,
  SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS,
  SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS,
  SAFE_ECHO_ADAPTER_REQUIRED_INPUTS,
  RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
  SANDBOX_DRY_RUN_BOUNDARY_ALLOWED_SCOPES,
  SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS,
} from "./runtimeSafeEchoAdapterContractConstants";
import {
  resolveRuntimeSafeEchoAdapterContractStatus,
  resolveRuntimeSafeEchoAdapterMode,
} from "./runtimeSafeEchoAdapterContractCheckHelpers";
import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterInputContract,
  RuntimeSafeEchoAdapterOutputContract,
  RuntimeSandboxDryRunBoundary,
  RuntimeSafeEchoAdapterContractSummary,
} from "./runtimeSafeEchoAdapterContractTypes";

function buildInputContract(): RuntimeSafeEchoAdapterInputContract {
  return {
    mode: "runtime_safe_echo_adapter_input_contract",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    requiredInputs: [...SAFE_ECHO_ADAPTER_REQUIRED_INPUTS],
    acceptedInputMetadata: [...SAFE_ECHO_ADAPTER_ACCEPTED_INPUT_METADATA],
    prohibitedInputPayloads: [...SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS],
    validationRules: [...SAFE_ECHO_ADAPTER_INPUT_VALIDATION_RULES],
  };
}

function buildOutputContract(): RuntimeSafeEchoAdapterOutputContract {
  return {
    mode: "runtime_safe_echo_adapter_output_contract",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    expectedOutputs: [...SAFE_ECHO_ADAPTER_EXPECTED_OUTPUTS],
    prohibitedOutputs: [...SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS],
    auditMetadataRows: [...SAFE_ECHO_ADAPTER_AUDIT_METADATA_ROWS],
  };
}

function buildSandboxDryRunBoundary(): RuntimeSandboxDryRunBoundary {
  return {
    mode: "runtime_sandbox_dry_run_boundary",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: "runtimePilotValidationReadOnlyChainSummary",
    boundaryTargetLayer: "safeEchoAdapterContract",
    allowedBoundaryScopes: [...SANDBOX_DRY_RUN_BOUNDARY_ALLOWED_SCOPES],
    forbiddenBoundaryOperations: [...SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS],
    operatorApprovalRequiredBeforeInvocation: true,
    auditTraceRequired: true,
    rollbackPlanRequired: true,
  };
}

function buildSummary(
  summary: RuntimePilotValidationReadOnlyChainSummary,
  finalGateStatus: string
): RuntimeSafeEchoAdapterContractSummary {
  const contractStatus = resolveRuntimeSafeEchoAdapterContractStatus({ summary, finalGateStatus });
  const adapterMode = resolveRuntimeSafeEchoAdapterMode(contractStatus);

  const blockers = mergeSortedUniqueKo([
    ...summary.topBlockers,
    ...(contractStatus === "blocked" ? ["safe_echo_adapter_contract:blocked"] : []),
  ]);
  const warnings = mergeSortedUniqueKo([
    ...summary.topWarnings,
    ...(contractStatus === "watch" ? ["safe_echo_adapter_contract:watch"] : []),
  ]);

  const rationaleKo =
    contractStatus === "contract_ready"
      ? "read-only chain이 준비되어 Safe Echo Adapter contract metadata만 정의 가능합니다(실제 invocation 없음)."
      : contractStatus === "watch"
        ? "주의 항목이 있어 Safe Echo contract는 contract-only 모드로 제한됩니다."
        : contractStatus === "blocked"
          ? "차단 상태로 Safe Echo Adapter contract invocation 경로가 닫혀 있습니다."
          : "파일럿 검증 계약 정의 전 준비 단계입니다.";

  const recommendations = mergeSortedUniqueKo([
    ...summary.recommendations,
    "actual adapter invocation·sandbox invocation·dry-run runner·pilot execution 금지 유지",
    contractStatus === "contract_ready"
      ? "Phase 3에서 validation request draft·operator approval UI contract 검토"
      : "blocked/watch 해소 후 contract_ready 재확인",
  ]);

  return {
    mode: "runtime_safe_echo_adapter_contract_summary",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    contractStatus,
    adapterMode,
    rationaleKo,
    blockers,
    warnings,
    recommendations,
  };
}

export function buildRuntimeSafeEchoAdapterContractReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  chainSummary: RuntimePilotValidationReadOnlyChainSummary
): Readonly<{
  runtimeSafeEchoAdapterContractSummary: RuntimeSafeEchoAdapterContractSummary;
  runtimeSafeEchoAdapterInputContract: RuntimeSafeEchoAdapterInputContract;
  runtimeSafeEchoAdapterOutputContract: RuntimeSafeEchoAdapterOutputContract;
  runtimeSandboxDryRunBoundary: RuntimeSandboxDryRunBoundary;
}> {
  const finalGateStatus = reports.runtimeControlledPilotExecutionCandidateFinalSafetyGate.finalGateStatus;

  return {
    runtimeSafeEchoAdapterContractSummary: buildSummary(chainSummary, finalGateStatus),
    runtimeSafeEchoAdapterInputContract: buildInputContract(),
    runtimeSafeEchoAdapterOutputContract: buildOutputContract(),
    runtimeSandboxDryRunBoundary: buildSandboxDryRunBoundary(),
  };
}

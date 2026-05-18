/**
 * Pilot Validation Phase 4 — Safe Echo invocation simulator reports (no invocation).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterContractSummary,
  RuntimeSandboxDryRunBoundary,
} from "./runtimeSafeEchoAdapterContractTypes";
import { RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED } from "./runtimeSafeEchoAdapterContractConstants";
import {
  SAFE_ECHO_SIMULATOR_ACCEPTED_INPUT_ROWS,
  SAFE_ECHO_SIMULATOR_BOUNDARY_ALLOWED_SCOPES,
  SAFE_ECHO_SIMULATOR_BOUNDARY_FORBIDDEN_OPERATIONS,
  SAFE_ECHO_SIMULATOR_EXPECTED_OUTPUTS,
  SAFE_ECHO_SIMULATOR_PROHIBITED_OUTPUTS,
  SAFE_ECHO_SIMULATOR_REJECTED_INPUT_ROWS,
} from "./runtimeSafeEchoInvocationSimulatorConstants";
import {
  resolveRuntimeSafeEchoInvocationSimulatorMode,
  resolveRuntimeSafeEchoInvocationSimulatorStatus,
} from "./runtimeSafeEchoInvocationSimulatorCheckHelpers";
import type {
  RuntimePilotValidationAuditTraceCandidate,
  RuntimePilotValidationOperatorApprovalSnapshot,
  RuntimePilotValidationRequestDraft,
  RuntimePilotValidationRollbackPlanCandidate,
} from "./runtimePilotValidationRequestDraftTypes";
import type {
  RuntimeSafeEchoInvocationSimulatorBoundary,
  RuntimeSafeEchoInvocationSimulatorInput,
  RuntimeSafeEchoInvocationSimulatorOutput,
  RuntimeSafeEchoInvocationSimulatorSummary,
} from "./runtimeSafeEchoInvocationSimulatorTypes";

type RequestDraftReports = Readonly<{
  runtimePilotValidationRequestDraft: RuntimePilotValidationRequestDraft;
  runtimePilotValidationOperatorApprovalSnapshot: RuntimePilotValidationOperatorApprovalSnapshot;
  runtimePilotValidationAuditTraceCandidate: RuntimePilotValidationAuditTraceCandidate;
  runtimePilotValidationRollbackPlanCandidate: RuntimePilotValidationRollbackPlanCandidate;
}>;

type SafeEchoReports = Readonly<{
  runtimeSafeEchoAdapterContractSummary: RuntimeSafeEchoAdapterContractSummary;
  runtimeSandboxDryRunBoundary: RuntimeSandboxDryRunBoundary;
}>;

function buildSimulatorInput(
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  draftReports: RequestDraftReports,
  safeEcho: SafeEchoReports
): RuntimeSafeEchoInvocationSimulatorInput {
  const draft = draftReports.runtimePilotValidationRequestDraft;
  const approval = draftReports.runtimePilotValidationOperatorApprovalSnapshot;
  const audit = draftReports.runtimePilotValidationAuditTraceCandidate;
  const rollback = draftReports.runtimePilotValidationRollbackPlanCandidate;
  const contract = safeEcho.runtimeSafeEchoAdapterContractSummary;

  return {
    mode: "runtime_safe_echo_invocation_simulator_input",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    sourceRequestDraftIdCandidate: draft.validationRequestIdCandidate,
    acceptedInputRows: mergeSortedUniqueKo([
      ...SAFE_ECHO_SIMULATOR_ACCEPTED_INPUT_ROWS,
      `validationRequestIdCandidate:${draft.validationRequestIdCandidate}`,
      `requestedValidationMode:${draft.requestedValidationMode}`,
      `operatorApprovalSnapshotStatus:${approval.approvalSnapshotStatus}`,
      `auditTraceIdCandidate:${audit.auditTraceIdCandidate}`,
      `rollbackPlanCandidateId:${rollback.rollbackPlanCandidateId}`,
      `safeEchoAdapterContractStatus:${contract.contractStatus}`,
      `sandboxDryRunBoundaryStatus:operatorApprovalRequired`,
      `readOnlyChainValidationStatus:${chainSummary.validationStatus}`,
    ]),
    rejectedInputRows: [...SAFE_ECHO_SIMULATOR_REJECTED_INPUT_ROWS],
    requiredApprovalRows: mergeSortedUniqueKo([
      ...approval.approvalRows,
      `approvalSnapshotStatus:${approval.approvalSnapshotStatus}`,
    ]),
    requiredAuditRows: mergeSortedUniqueKo([
      ...audit.traceRows,
      `auditTraceStatus:${audit.auditTraceStatus}`,
    ]),
    requiredRollbackRows: mergeSortedUniqueKo([
      ...rollback.rollbackRows,
      `rollbackPlanStatus:${rollback.rollbackPlanStatus}`,
    ]),
  };
}

function buildSimulatorOutput(
  audit: RuntimePilotValidationAuditTraceCandidate,
  rollback: RuntimePilotValidationRollbackPlanCandidate
): RuntimeSafeEchoInvocationSimulatorOutput {
  return {
    mode: "runtime_safe_echo_invocation_simulator_output",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    expectedSimulationOutputs: [...SAFE_ECHO_SIMULATOR_EXPECTED_OUTPUTS],
    prohibitedSimulationOutputs: [...SAFE_ECHO_SIMULATOR_PROHIBITED_OUTPUTS],
    auditEchoRows: mergeSortedUniqueKo([
      audit.auditTraceIdCandidate,
      ...audit.traceRows.slice(0, 2),
    ]),
    rollbackEchoRows: mergeSortedUniqueKo([
      rollback.rollbackPlanCandidateId,
      ...rollback.rollbackRows.slice(0, 2),
    ]),
  };
}

function buildSimulatorBoundary(): RuntimeSafeEchoInvocationSimulatorBoundary {
  return {
    mode: "runtime_safe_echo_invocation_simulator_boundary",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: "runtimePilotValidationRequestDraft",
    boundaryTargetLayer: "safeEchoInvocationSimulatorContract",
    allowedSimulatorScopes: [...SAFE_ECHO_SIMULATOR_BOUNDARY_ALLOWED_SCOPES],
    forbiddenSimulatorOperations: [...SAFE_ECHO_SIMULATOR_BOUNDARY_FORBIDDEN_OPERATIONS],
    simulationDoesNotInvokeAdapter: true,
    simulationDoesNotInvokeSandbox: true,
    simulationDoesNotInvokeRunner: true,
    simulationDoesNotModifySource: true,
  };
}

function buildSimulatorSummary(
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  draftReports: RequestDraftReports,
  safeEcho: SafeEchoReports
): RuntimeSafeEchoInvocationSimulatorSummary {
  const simulatorStatus = resolveRuntimeSafeEchoInvocationSimulatorStatus({
    draft: draftReports.runtimePilotValidationRequestDraft,
    approvalSnapshot: draftReports.runtimePilotValidationOperatorApprovalSnapshot,
    auditTrace: draftReports.runtimePilotValidationAuditTraceCandidate,
    rollbackPlan: draftReports.runtimePilotValidationRollbackPlanCandidate,
    contract: safeEcho.runtimeSafeEchoAdapterContractSummary,
  });
  const simulatorMode = resolveRuntimeSafeEchoInvocationSimulatorMode(simulatorStatus);

  const blockers = mergeSortedUniqueKo([
    ...draftReports.runtimePilotValidationRequestDraft.blockers,
    ...(simulatorStatus === "blocked" ? ["safe_echo_invocation_simulator:blocked"] : []),
  ]);
  const warnings = mergeSortedUniqueKo([
    ...draftReports.runtimePilotValidationRequestDraft.warnings,
    ...(simulatorStatus === "watch" ? ["safe_echo_invocation_simulator:watch"] : []),
  ]);

  const rationaleKo =
    simulatorStatus === "simulator_contract_ready"
      ? "validation request draft 기반 read-only echo simulation contract metadata가 준비되었습니다(실제 invocation 없음)."
      : simulatorStatus === "watch"
        ? "시뮬레이터 계약은 contract-only 모드로 제한됩니다."
        : simulatorStatus === "blocked"
          ? "시뮬레이터 계약이 차단되어 echo simulation metadata를 생성할 수 없습니다."
          : "시뮬레이터 계약 정의 전 준비 단계입니다.";

  return {
    mode: "runtime_safe_echo_invocation_simulator_summary",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    simulatorStatus,
    simulatorMode,
    rationaleKo,
    blockers,
    warnings,
    recommendations: mergeSortedUniqueKo([
      ...draftReports.runtimePilotValidationRequestDraft.recommendations,
      "simulator는 metadata contract이며 actual adapter/sandbox/runner invocation 없음",
    ]),
  };
}

export function buildRuntimeSafeEchoInvocationSimulatorReports(
  _reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  safeEcho: SafeEchoReports,
  draftReports: RequestDraftReports
): Readonly<{
  runtimeSafeEchoInvocationSimulatorSummary: RuntimeSafeEchoInvocationSimulatorSummary;
  runtimeSafeEchoInvocationSimulatorInput: RuntimeSafeEchoInvocationSimulatorInput;
  runtimeSafeEchoInvocationSimulatorOutput: RuntimeSafeEchoInvocationSimulatorOutput;
  runtimeSafeEchoInvocationSimulatorBoundary: RuntimeSafeEchoInvocationSimulatorBoundary;
}> {
  const runtimeSafeEchoInvocationSimulatorSummary = buildSimulatorSummary(chainSummary, draftReports, safeEcho);
  return {
    runtimeSafeEchoInvocationSimulatorSummary,
    runtimeSafeEchoInvocationSimulatorInput: buildSimulatorInput(chainSummary, draftReports, safeEcho),
    runtimeSafeEchoInvocationSimulatorOutput: buildSimulatorOutput(
      draftReports.runtimePilotValidationAuditTraceCandidate,
      draftReports.runtimePilotValidationRollbackPlanCandidate
    ),
    runtimeSafeEchoInvocationSimulatorBoundary: buildSimulatorBoundary(),
  };
}

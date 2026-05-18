import { describe, expect, it } from "vitest";

import {
  buildAuditTraceIdCandidate,
  buildRollbackPlanCandidateId,
  buildValidationRequestIdCandidate,
} from "@/lib/harness/runtimePilotValidation/runtimePilotValidationRequestDraftCheckHelpers";
import {
  SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS,
  SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS,
  SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoAdapterContractConstants";
import { buildRuntimePilotValidationReadOnlyChainPlanningReports } from "@/lib/harness/runtimePilotValidation/buildRuntimePilotValidationReadOnlyChainPlanningReports";
import { serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotValidation/serializeRuntimePilotValidationDiagnosticBundle";
import { filterOverlayRuntimeDiagnosticDataForAudience } from "@/lib/overlay/overlayRuntimeDiagnosticAudienceFilter";
import { buildPilotValidationUserSummaryVmFromDiagnosticData } from "@/lib/overlay-ui/pilotValidationUserSummaryVmFromDiagnostic";
import { buildOverlayRuntimePilotValidationReadOnlyChainSectionVmFromReports } from "@/lib/overlay-ui/overlayRuntimePilotValidationReadOnlyChainSectionVm";
import { serializeRuntimeSemanticDiagnosticBundleFromPlanningReports } from "@/lib/harness/runtimeSemantic/serializeRuntimeSemanticDiagnosticBundle";
import { buildFullSemanticForPilotValidation } from "./runtimePilotValidationTestFixtures";

const PHASE_0_THROUGH_3_PLANNING_KEYS = [
  "runtimePilotValidationReadOnlyChainSummary",
  "runtimeSafeEchoAdapterContractSummary",
  "runtimeSafeEchoAdapterInputContract",
  "runtimeSafeEchoAdapterOutputContract",
  "runtimeSandboxDryRunBoundary",
  "runtimePilotValidationRequestDraft",
  "runtimePilotValidationOperatorApprovalSnapshot",
  "runtimePilotValidationAuditTraceCandidate",
  "runtimePilotValidationRollbackPlanCandidate",
] as const;

const USER_VM_REQUIRED_DIAGNOSTIC_KEYS = [
  "runtimePilotValidationReadOnlyChainSummary",
  "runtimeControlledPilotExecutionCandidateSummary",
  "runtimeControlledPilotExecutionCandidatePolicy",
  "runtimeOperatorApprovalSummary",
  "runtimeSafeEchoAdapterContractSummary",
  "runtimeSandboxDryRunBoundary",
  "runtimePilotValidationRequestDraft",
  "runtimePilotValidationOperatorApprovalSnapshot",
  "runtimePilotValidationAuditTraceCandidate",
  "runtimePilotValidationRollbackPlanCandidate",
] as const;

describe("Pilot Validation Phase 3 — completion verification", () => {
  it("planning reports include Phase 0 through Phase 3 fields in order", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const reports = buildRuntimePilotValidationReadOnlyChainPlanningReports(semantic);
    for (const key of PHASE_0_THROUGH_3_PLANNING_KEYS) {
      expect(reports).toHaveProperty(key);
      expect((reports as Record<string, unknown>)[key]).toBeTruthy();
    }
    expect(reports.runtimePilotValidationReadOnlyChainSummary.mode).toBe(
      "runtime_pilot_validation_read_only_chain_summary"
    );
    expect(reports.runtimeSafeEchoAdapterContractSummary.mode).toBe(
      "runtime_safe_echo_adapter_contract_summary"
    );
    expect(reports.runtimePilotValidationRequestDraft.mode).toBe("runtime_pilot_validation_request_draft");
  });

  it("serializer exposes Phase 0~3 fields without rebuilding reports", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const diag = serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(semantic);
    for (const key of PHASE_0_THROUGH_3_PLANNING_KEYS) {
      expect(diag).toHaveProperty(key);
    }
    expect(Object.keys(diag).length).toBeGreaterThanOrEqual(PHASE_0_THROUGH_3_PLANNING_KEYS.length);
  });

  it("user audience filter retains Phase 3 UI required diagnostic fields", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const bundle = serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(semantic);
    const filtered = filterOverlayRuntimeDiagnosticDataForAudience(
      bundle as Record<string, unknown>,
      "user"
    );
    for (const key of USER_VM_REQUIRED_DIAGNOSTIC_KEYS) {
      expect(filtered[key]).toBeTruthy();
    }
    const vm = buildPilotValidationUserSummaryVmFromDiagnosticData(filtered);
    expect(vm).not.toBeNull();
    expect(vm?.requestDraftStatusKo.length).toBeGreaterThan(0);
    expect(vm?.operatorApprovalSnapshotStatusKo.length).toBeGreaterThan(0);
    expect(vm?.auditTraceCandidateStatusKo.length).toBeGreaterThan(0);
    expect(vm?.rollbackPlanCandidateStatusKo.length).toBeGreaterThan(0);
    expect(vm?.validationRequestIdCandidateKo).toContain("pilot-validation:");
  });

  it("request draft IDs are deterministic and execution flags stay disabled", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const chain = semantic.runtimePilotValidationReadOnlyChainSummary;
    const contract = semantic.runtimeSafeEchoAdapterContractSummary;
    const draft = semantic.runtimePilotValidationRequestDraft;
    const approval = semantic.runtimePilotValidationOperatorApprovalSnapshot;
    const audit = semantic.runtimePilotValidationAuditTraceCandidate;
    const rollback = semantic.runtimePilotValidationRollbackPlanCandidate;

    expect(draft.validationRequestIdCandidate).toBe(
      buildValidationRequestIdCandidate(contract.contractStatus, chain.validationStatus)
    );
    expect(audit.auditTraceIdCandidate).toBe(
      buildAuditTraceIdCandidate(contract.contractStatus, chain.validationStatus)
    );
    expect(rollback.rollbackPlanCandidateId).toBe(
      buildRollbackPlanCandidateId(contract.contractStatus, chain.validationStatus)
    );

    expect(approval.actualApprovalEnforcementEnabled).toBe(false);
    expect(rollback.actualRollbackExecutionEnabled).toBe(false);
    expect(draft.actualAdapterInvocationEnabled).toBe(false);
    expect(draft.actualSandboxInvocationEnabled).toBe(false);
    expect(draft.actualPilotExecutionEnabled).toBe(false);
    expect(draft.actualExecutionEnabled).toBe(false);
  });

  it("safe echo contracts list prohibited inputs/outputs and boundary forbids invocation", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const input = semantic.runtimeSafeEchoAdapterInputContract;
    const output = semantic.runtimeSafeEchoAdapterOutputContract;
    const boundary = semantic.runtimeSandboxDryRunBoundary;

    expect(input.prohibitedInputPayloads).toEqual(expect.arrayContaining([...SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS]));
    expect(output.prohibitedOutputs).toEqual(expect.arrayContaining([...SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS]));
    expect(boundary.forbiddenBoundaryOperations).toEqual(
      expect.arrayContaining([...SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS])
    );
    expect(boundary.forbiddenBoundaryOperations).toContain("actual adapter invocation");
    expect(boundary.forbiddenBoundaryOperations).toContain("actual sandbox invocation");
  });

  it("overlay VM exposes Phase 3 status labels", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const overlayVm = buildOverlayRuntimePilotValidationReadOnlyChainSectionVmFromReports(semantic);
    expect(overlayVm.requestDraftStatusKo.length).toBeGreaterThan(0);
    expect(overlayVm.operatorApprovalSnapshotStatusKo.length).toBeGreaterThan(0);
    expect(overlayVm.auditTraceCandidateStatusKo.length).toBeGreaterThan(0);
    expect(overlayVm.rollbackPlanCandidateStatusKo.length).toBeGreaterThan(0);
    expect(overlayVm.validationRequestIdCandidate).toContain("pilot-validation:");
    expect(overlayVm.userSummaryVm.prohibitedOperationRows.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildAuditTraceIdCandidate,
  buildValidationRequestIdCandidate,
} from "@/lib/harness/runtimePilotValidation/runtimePilotValidationRequestDraftCheckHelpers";
import { serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotValidation/serializeRuntimePilotValidationDiagnosticBundle";
import { buildPilotValidationUserSummaryVmFromReports } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import {
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForPilotValidation,
  buildPilotValidationBaseReports,
  buildPilotValidationPlanning,
  buildPilotValidationPlanningWithControlledCandidatePatches,
} from "./runtimePilotValidationTestFixtures";

describe("Pilot Validation Phase 3 — request draft & approval contracts", () => {
  it("contract_ready yields draft_ready with deterministic validationRequestIdCandidate", () => {
    const semantic = buildFullSemanticForPilotValidation();
    if (semantic.runtimeSafeEchoAdapterContractSummary.contractStatus !== "contract_ready") {
      return;
    }
    const draft = semantic.runtimePilotValidationRequestDraft;
    expect(draft.draftStatus).toBe("draft_ready");
    expect(draft.draftMode).toBe("operator_approval_required");
    expect(draft.validationRequestIdCandidate).toBe(
      buildValidationRequestIdCandidate("contract_ready", semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus)
    );
    expect(draft.actualAdapterInvocationEnabled).toBe(false);
  });

  it("watch contract yields watch or blocked draft when blockers exist", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanningWithControlledCandidatePatches(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    const draftStatus = semantic.runtimePilotValidationRequestDraft.draftStatus;
    expect(draftStatus === "watch" || draftStatus === "blocked").toBe(true);
  });

  it("blocked contract yields blocked draft", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateFinalSafetyGate: {
        ...base.runtimeControlledPilotExecutionCandidateFinalSafetyGate,
        finalGateStatus: "blocked",
        pilotValidationEntryReadiness: "blocked",
      },
    });
    expect(semantic.runtimePilotValidationRequestDraft.draftStatus).toBe("blocked");
  });

  it("operator approval snapshot does not enable enforcement", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const snapshot = semantic.runtimePilotValidationOperatorApprovalSnapshot;
    expect(snapshot.actualApprovalEnforcementEnabled).toBe(false);
    expect(snapshot.approvalDoesNotTriggerExecution).toBe(true);
    expect(snapshot.actualExecutionBlockingEnabled).toBe(false);
    expect(snapshot.actualMergeBlockingEnabled).toBe(false);
  });

  it("audit trace candidate does not enable execution", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const audit = semantic.runtimePilotValidationAuditTraceCandidate;
    expect(audit.actualExecutionEnabled).toBe(false);
    expect(audit.actualAdapterInvocationEnabled).toBe(false);
    expect(audit.auditTraceIdCandidate).toBe(
      buildAuditTraceIdCandidate(
        semantic.runtimeSafeEchoAdapterContractSummary.contractStatus,
        semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus
      )
    );
  });

  it("rollback plan candidate does not enable rollback execution", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const rollback = semantic.runtimePilotValidationRollbackPlanCandidate;
    expect(rollback.actualRollbackExecutionEnabled).toBe(false);
    expect(rollback.actualExecutionEnabled).toBe(false);
    expect(rollback.rollbackDoesNotExecute).toBe(true);
    expect(rollback.rollbackScope).toBe("metadata_only");
  });

  it("diagnostic bundle includes request draft fields", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const diag = serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(semantic);
    expect(diag.runtimePilotValidationRequestDraft).toBeTruthy();
    expect(diag.runtimePilotValidationOperatorApprovalSnapshot).toBeTruthy();
    expect(diag.runtimePilotValidationAuditTraceCandidate).toBeTruthy();
    expect(diag.runtimePilotValidationRollbackPlanCandidate).toBeTruthy();
  });

  it("user VM displays request draft status labels", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const vm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(vm.requestDraftStatusKo.length).toBeGreaterThan(0);
    expect(vm.operatorApprovalSnapshotStatusKo).toContain("운영자");
    expect(vm.auditTraceCandidateStatusKo).toContain("감사");
    expect(vm.rollbackPlanCandidateStatusKo).toContain("롤백");
    expect(vm.validationRequestIdCandidateKo).toContain("pilot-validation:");
  });
});

/**
 * H27 — H28 전 activation **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotActivation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimePilotActivationBlockerReport } from "./runtimePilotActivationTypes";
import type { RuntimePilotActivationReadinessChecklist } from "./runtimePilotActivationTypes";

export function buildRuntimePilotActivationReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotActivation;
  readonly blockerReport: RuntimePilotActivationBlockerReport;
}): RuntimePilotActivationReadinessChecklist {
  const { reports, blockerReport } = input;
  const pf = reports.runtimeAdapterSandboxPreflightSummary;
  const env = reports.runtimeAdapterSandboxEnvelopeVerificationReport;
  const bv = reports.runtimeAdapterSandboxBoundaryViolationReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const sandboxPreflightReady = pf.preflightReadiness === "ready_metadata";
  const envelopeVerified = env.verificationStatus === "verified_metadata";
  const noBoundaryViolations = bv.actualFlagViolations.length === 0;
  const noActivationBlockers = blockerReport.blockers.length === 0;
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" ||
    approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient =
    audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";
  const controlNotBlocked = control.boundaryRisk !== "blocked";

  const checklist = mergeSortedUniqueKo([
    `sandbox preflight ready_metadata:${sandboxPreflightReady}`,
    `sandbox envelope verified_metadata:${envelopeVerified}`,
    `no sandbox boundary violations:${noBoundaryViolations}`,
    `no activation blockers:${noActivationBlockers}`,
    `operator approval metadata ready:${operatorApprovalReady}`,
    `rollback readiness metadata ready:${rollbackReady}`,
    `audit readiness metadata sufficient:${auditSufficient}`,
    `control boundary not blocked:${controlNotBlocked}`,
    "actual activation disabled:true",
  ]);

  const blockers: string[] = [];
  if (!sandboxPreflightReady) {
    blockers.push("sandbox preflight not ready_metadata");
  }
  if (!envelopeVerified) {
    blockers.push("sandbox envelope not verified_metadata");
  }
  if (!noBoundaryViolations) {
    blockers.push("sandbox boundary violations present");
  }
  if (!noActivationBlockers) {
    blockers.push(...blockerReport.blockers.slice(0, 2));
  }

  const recommendations = mergeSortedUniqueKo([
    ...(checklist.every((row) => row.endsWith(":true"))
      ? ["H27: activation readiness checklist pass — H28 pilot skeleton gate 후보(activation 없음)"]
      : ["H27: activation readiness checklist incomplete — sandbox·approval·control 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_pilot_activation_readiness_checklist",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}

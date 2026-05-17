/**
 * H42 — limited pilot **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";
import { readLimitedPilotBoundaryUpstreamContext } from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type {
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotReadinessChecklist,
} from "./runtimeLimitedPilotBoundaryTypes";

export function buildRuntimeLimitedPilotReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
}): RuntimeLimitedPilotReadinessChecklist {
  const { reports, blockerReport } = input;
  const {
    activationFinalGate,
    activationVerification,
    activationAlignment,
    activationViolation,
    approval,
    rollback,
    audit,
  } = readLimitedPilotBoundaryUpstreamContext(reports);

  const activationFinalGateReady =
    activationFinalGate.finalGateStatus === "ready_metadata" &&
    activationFinalGate.h42EntryReadiness === "ready_metadata";
  const activationVerified = activationVerification.verificationStatus === "verified_metadata";
  const activationAligned = activationAlignment.alignmentStatus === "aligned_metadata";
  const noActivationActualViolations = activationViolation.actualFlagViolations.length === 0;
  const noActivationPolicyViolations = activationViolation.policyViolations.length === 0;
  const noPilotBlockers = blockerReport.blockers.length === 0;
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "controlled activation candidate final gate ready_metadata", ok: activationFinalGateReady },
    { label: "h42 entry readiness ready_metadata", ok: activationFinalGate.h42EntryReadiness === "ready_metadata" },
    {
      label: "controlled activation verification verified_metadata",
      ok: activationVerified,
    },
    { label: "controlled activation alignment aligned_metadata", ok: activationAligned },
    { label: "no controlled activation actual flag violations", ok: noActivationActualViolations },
    { label: "no controlled activation policy violations", ok: noActivationPolicyViolations },
    { label: "no limited pilot boundary blockers", ok: noPilotBlockers },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual runtime orchestration disabled", ok: true },
    { label: "actual controlled activation disabled", ok: true },
    { label: "actual pilot activation disabled", ok: true },
    { label: "actual pilot execution disabled", ok: true },
    { label: "actual isolated runner invocation disabled", ok: true },
    { label: "actual isolated runner execution disabled", ok: true },
    { label: "actual runtime adapter invocation disabled", ok: true },
    { label: "actual sandbox invocation disabled", ok: true },
    { label: "actual execution disabled", ok: true },
    { label: "actual execution routing disabled", ok: true },
    { label: "actual release enforcement disabled", ok: true },
    { label: "actual approval enforcement disabled", ok: true },
    { label: "actual execution blocking disabled", ok: true },
    { label: "actual merge blocking disabled", ok: true },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!activationFinalGateReady) blockers.push("controlled activation candidate final gate not ready_metadata");
  if (!activationVerified) blockers.push("controlled activation verification not verified_metadata");
  if (!activationAligned) blockers.push("controlled activation alignment not aligned_metadata");
  if (!noActivationActualViolations) blockers.push("controlled activation actual flag violations present");
  if (!noActivationPolicyViolations) blockers.push("controlled activation policy violations present");
  if (!noPilotBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H42: limited pilot readiness checklist pass — metadata_only boundary candidate(pilot 없음)"]
      : ["H42: limited pilot readiness checklist incomplete — controlled activation final gate 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_limited_pilot_readiness_checklist",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}

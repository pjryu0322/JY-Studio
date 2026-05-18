/**
 * H44 — pilot execution readiness **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import { readPilotExecutionReadinessUpstreamContext } from "./runtimePilotExecutionReadinessCheckHelpers";
import type { RuntimePilotExecutionReadinessBlockerReport } from "./runtimePilotExecutionReadinessTypes";

export function detectRuntimePilotExecutionReadinessBlockers(
  reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
): RuntimePilotExecutionReadinessBlockerReport {
  const {
    reviewFinalGate,
    reviewVerification,
    reviewAlignment,
    reviewViolation,
    pilotReadinessBlockers,
    pilotBoundaryFinalGate,
    activationFinalGate,
    approval,
    rollback,
    audit,
    control,
  } = readPilotExecutionReadinessUpstreamContext(reports);

  const blockers: string[] = [];

  if (reviewFinalGate.finalGateStatus === "blocked") {
    blockers.push("limited pilot readiness review final safety gate blocked");
  }
  if (reviewFinalGate.h44EntryReadiness === "blocked") {
    blockers.push("h44 entry readiness blocked");
  }
  if (reviewVerification.verificationStatus === "failed") {
    blockers.push("limited pilot readiness review verification failed");
  }
  if (reviewAlignment.alignmentStatus === "failed") {
    blockers.push("limited pilot readiness review alignment failed");
  }
  if (reviewViolation.actualFlagViolations.length > 0) {
    blockers.push(...reviewViolation.actualFlagViolations.slice(0, 3));
  }
  if (reviewViolation.proofViolations.length > 0) {
    blockers.push(...reviewViolation.proofViolations.slice(0, 3));
  }
  if (reviewViolation.forbiddenProofViolations.length > 0) {
    blockers.push(...reviewViolation.forbiddenProofViolations.slice(0, 3));
  }
  if (pilotReadinessBlockers.blockers.length > 0) {
    blockers.push(...pilotReadinessBlockers.blockers.slice(0, 2));
  }
  if (pilotBoundaryFinalGate.finalGateStatus === "blocked") {
    blockers.push("limited pilot boundary final safety gate blocked");
  }
  if (activationFinalGate.finalGateStatus === "blocked") {
    blockers.push("controlled activation candidate final safety gate blocked");
  }
  if (approval.approvalReadiness === "blocked") {
    blockers.push("operator approval blocked");
  }
  if (rollback.rollbackReadiness === "blocked") {
    blockers.push("rollback readiness blocked");
  }
  if (audit.auditReadiness === "blocked") {
    blockers.push("audit readiness blocked");
  }
  if (control.boundaryRisk === "blocked") {
    blockers.push("control boundary blocked");
  }

  return {
    mode: "runtime_pilot_execution_readiness_blocker_report",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(blockers.length > 0
        ? ["H44: pilot execution readiness blocker — limited pilot readiness review·approval 정렬(pilot activation·execution 없음)"]
        : []),
    ]),
  };
}

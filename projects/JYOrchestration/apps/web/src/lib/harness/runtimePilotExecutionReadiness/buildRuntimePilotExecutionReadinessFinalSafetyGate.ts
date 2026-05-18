/**
 * H44.5 — H45 진입 전 pilot execution readiness **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  PILOT_EXECUTION_READINESS_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
} from "./runtimePilotExecutionReadinessConstants";
import {
  collectPilotExecutionReadinessFinalSafetyBlockers,
  resolvePilotExecutionReadinessFinalGateStatus,
} from "./runtimePilotExecutionReadinessCheckHelpers";
import type {
  RuntimePilotExecutionReadinessAlignmentReport,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessFinalSafetyGate,
  RuntimePilotExecutionReadinessSummary,
  RuntimePilotExecutionReadinessVerificationReport,
  RuntimePilotExecutionReadinessViolationReport,
} from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessFinalSafetyGate(input: {
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly executionViolation: RuntimePilotExecutionReadinessViolationReport;
  readonly readinessVerification: RuntimePilotExecutionReadinessVerificationReport;
  readonly alignmentReport: RuntimePilotExecutionReadinessAlignmentReport;
}): RuntimePilotExecutionReadinessFinalSafetyGate {
  const { summary, blockerReport, executionViolation, readinessVerification, alignmentReport } = input;

  const finalGateStatus = resolvePilotExecutionReadinessFinalGateStatus({
    summary,
    blockerReport,
    executionViolation,
    readinessVerification,
    alignmentReport,
  });

  const blockers = collectPilotExecutionReadinessFinalSafetyBlockers({
    blockerReport,
    summary,
    executionViolation,
    readinessVerification,
    alignmentReport,
  });

  const checklist = mergeSortedUniqueKo([
    `readinessStatus:${summary.readinessStatus}`,
    `readinessMode:${summary.readinessMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${executionViolation.actualFlagViolations.length}`,
    `proofViolations:${executionViolation.proofViolations.length}`,
    `forbiddenProofViolations:${executionViolation.forbiddenProofViolations.length}`,
    `wordingRiskFindings:${executionViolation.wordingRiskFindings.length}`,
    `readinessBlockers:${summary.readinessBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    ...PILOT_EXECUTION_READINESS_FINAL_SAFETY_CHECKLIST_STATIC_ROWS,
  ]);

  return {
    mode: "runtime_pilot_execution_readiness_final_safety_gate",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h45EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(finalGateStatus === "ready_metadata"
        ? ["H44.5: pilot execution readiness final safety gate ready_metadata — H45 entry 후보(pilot activation 없음)"]
        : []),
      ...(finalGateStatus === "watch"
        ? ["H44.5: pilot execution readiness final safety gate watch — verification·alignment·wording risk 재검토"]
        : []),
      ...(finalGateStatus === "blocked"
        ? ["H44.5: pilot execution readiness final safety gate blocked — violation·blocker·proof 정렬"]
        : []),
      ...(finalGateStatus === "not_ready"
        ? ["H44.5: pilot execution readiness final safety gate not_ready — pilot_execution_readiness_metadata_ready 선행"]
        : []),
      ...readinessVerification.recommendations,
      ...alignmentReport.recommendations,
      ...executionViolation.recommendations,
    ]),
  };
}

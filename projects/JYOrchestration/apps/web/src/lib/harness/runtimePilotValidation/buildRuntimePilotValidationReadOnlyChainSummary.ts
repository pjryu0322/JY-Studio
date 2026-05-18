/**
 * Pilot Validation Phase 0 — H45.5 final gate 기반 read-only chain validation summary.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
} from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessCheckHelpers";
import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  readControlledPilotExecutionStabilizationContext,
  resolveRuntimePilotValidationReadOnlyChainStatus,
} from "./runtimePilotValidationCheckHelpers";
import { RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS_DISABLED } from "./runtimePilotValidationConstants";
import type {
  RuntimePilotValidationReadOnlyChainStatus,
  RuntimePilotValidationReadOnlyChainSummary,
} from "./runtimePilotValidationTypes";

export { resolveRuntimePilotValidationReadOnlyChainStatus } from "./runtimePilotValidationCheckHelpers";

function buildFinalProofSummary(reports: RuntimeSemanticPlanningReportsBeforePilotValidation): readonly string[] {
  const { noExecutionProof, forbiddenProof } = readControlledPilotExecutionStabilizationContext(reports);
  if (!noExecutionProof || !forbiddenProof) {
    return ["final proof reports unavailable on planning input"];
  }
  return mergeSortedUniqueKo([
    `noExecutionProof.diagnosticOnly:${noExecutionProof.diagnosticOnly}`,
    `noExecutionProof.valid:${isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof)}`,
    `forbiddenProof.complete:${isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof)}`,
    `forbiddenProof.actualPilotActivationForbidden:${forbiddenProof.actualPilotActivationForbidden}`,
    `forbiddenProof.actualPilotExecutionForbidden:${forbiddenProof.actualPilotExecutionForbidden}`,
    `forbiddenProof.actualExecutionForbidden:${forbiddenProof.actualExecutionForbidden}`,
  ]);
}

function buildUserVisibleSummaryKo(status: RuntimePilotValidationReadOnlyChainStatus): string {
  switch (status) {
    case "ready_for_validation":
      return "H20.5~H45.5 read-only chain이 pilot validation entry 준비 상태입니다. 실제 pilot activation·execution은 없습니다.";
    case "watch":
      return "read-only chain이 pilot validation entry 후보이나 verification·alignment·wording risk를 재확인하세요. 실제 실행은 없습니다.";
    case "blocked":
      return "pilot validation entry가 차단되었습니다. violation·blocker·final gate를 정렬하세요. 실제 실행은 없습니다.";
    default:
      return "controlled pilot execution candidate final safety gate 선행이 필요합니다. 실제 pilot execution은 없습니다.";
  }
}

function buildOperatorVisibleSummaryKo(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  status: RuntimePilotValidationReadOnlyChainStatus
): string {
  const { finalGate, candidateSummary } = readControlledPilotExecutionStabilizationContext(reports);
  return [
    `validationStatus:${status}`,
    `finalGate:${finalGate.finalGateStatus}`,
    `pilotValidationEntry:${finalGate.pilotValidationEntryReadiness}`,
    `candidateStatus:${candidateSummary.candidateStatus}`,
    `executionMode:${candidateSummary.executionMode}`,
    "actual pilot activation·execution·runner·adapter·sandbox·routing 없음",
  ].join(" · ");
}

export function buildRuntimePilotValidationReadOnlyChainSummary(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): RuntimePilotValidationReadOnlyChainSummary {
  const { finalGate, verification, alignment, violation, blockerReport, candidateSummary } =
    readControlledPilotExecutionStabilizationContext(reports);

  const validationStatus = resolveRuntimePilotValidationReadOnlyChainStatus(reports);

  const topBlockers = mergeSortedUniqueKo([
    ...blockerReport.blockers,
    ...finalGate.blockers,
    ...candidateSummary.executionBlockers,
  ]).slice(0, 5);

  const topWarnings = mergeSortedUniqueKo([
    ...violation.wordingRiskFindings,
    ...verification.findings.slice(0, 2),
    ...alignment.findings.slice(0, 2),
  ]).slice(0, 5);

  const recommendations = mergeSortedUniqueKo([
    ...(validationStatus === "ready_for_validation"
      ? [
          "Pilot Validation Phase 0: read-only chain ready_for_validation — 사용자 파일럿 실행 검증 UI 준비 가능(pilot activation·execution 없음)",
        ]
      : []),
    ...(validationStatus === "watch"
      ? ["Pilot Validation Phase 0: read-only chain watch — H45.5 verification·alignment·wording risk 재검토"]
      : []),
    ...(validationStatus === "blocked"
      ? ["Pilot Validation Phase 0: read-only chain blocked — violation·blocker·final gate 정렬"]
      : []),
    ...(validationStatus === "not_ready"
      ? ["Pilot Validation Phase 0: read-only chain not_ready — controlled pilot execution candidate final gate 선행"]
      : []),
    ...finalGate.recommendations.slice(0, 2),
    ...candidateSummary.recommendations.slice(0, 2),
  ]);

  return {
    mode: "runtime_pilot_validation_read_only_chain_summary",
    ...RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS_DISABLED,
    validationStatus,
    finalGateStatus: finalGate.finalGateStatus,
    pilotValidationEntryReadiness: finalGate.pilotValidationEntryReadiness,
    topBlockers,
    topWarnings,
    finalProofSummary: buildFinalProofSummary(reports),
    userVisibleSummaryKo: buildUserVisibleSummaryKo(validationStatus),
    operatorVisibleSummaryKo: buildOperatorVisibleSummaryKo(reports, validationStatus),
    recommendations,
  };
}

/**
 * H44.5 — pilot execution readiness **violation** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import {
  collectFinalPilotForbiddenProofViolations,
  collectFinalPilotNoExecutionProofViolations,
  collectPilotExecutionReadinessSummaryActualFlagViolations,
  collectPilotExecutionReadinessWordingBlob,
  scanPilotExecutionReadinessWordingRisks,
} from "./runtimePilotExecutionReadinessCheckHelpers";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessSummary,
  RuntimePilotExecutionReadinessViolationReport,
} from "./runtimePilotExecutionReadinessTypes";

export function detectRuntimePilotExecutionReadinessViolations(input: {
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
}): RuntimePilotExecutionReadinessViolationReport {
  const { summary, noExecutionProof, forbiddenProof } = input;

  const actualFlagViolations = mergeSortedUniqueKo(
    collectPilotExecutionReadinessSummaryActualFlagViolations(summary)
  );
  const proofViolations = mergeSortedUniqueKo(collectFinalPilotNoExecutionProofViolations(noExecutionProof));
  const forbiddenProofViolations = mergeSortedUniqueKo(
    collectFinalPilotForbiddenProofViolations(forbiddenProof)
  );

  const wordingRiskFindings = scanPilotExecutionReadinessWordingRisks(
    collectPilotExecutionReadinessWordingBlob([
      summary.rationaleKo,
      ...summary.readinessBlockers,
      ...summary.recommendations,
      ...noExecutionProof.proofRows,
      ...forbiddenProof.proofRows,
    ])
  );

  return {
    mode: "runtime_pilot_execution_readiness_violation_report",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations,
    proofViolations,
    forbiddenProofViolations,
    wordingRiskFindings: mergeSortedUniqueKo(wordingRiskFindings),
    recommendations: mergeSortedUniqueKo([
      ...(actualFlagViolations.length > 0 ||
      proofViolations.length > 0 ||
      forbiddenProofViolations.length > 0 ||
      wordingRiskFindings.length > 0
        ? ["H44.5: pilot execution readiness violation — actual·proof·forbidden·wording risk 제거(pilot activation 없음)"]
        : []),
    ]),
  };
}

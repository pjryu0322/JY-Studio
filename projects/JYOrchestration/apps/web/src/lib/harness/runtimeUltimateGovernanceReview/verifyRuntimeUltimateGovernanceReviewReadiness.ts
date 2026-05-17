/**
 * H40.5 — ultimate governance review **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
  ULTIMATE_GOVERNANCE_VERIFICATION_CHECKLIST_LABEL_ROWS,
  ULTIMATE_GOVERNANCE_VERIFICATION_INPUT_ENVELOPE_FRAGMENTS,
} from "./runtimeUltimateGovernanceReviewConstants";
import {
  isRuntimeOrchestrationForbiddenProofComplete,
  isRuntimeUltimateNoEnforcementProofValid,
  resolveUltimateGovernanceReviewVerificationStatus,
  runtimeChecklistHasLabel,
  runtimeEnvelopeIncludes,
  ultimateBoundarySourceLayerValid,
  ultimateBoundaryTargetLayerValid,
  ultimateGovernanceBlockersAligned,
} from "./runtimeUltimateGovernanceReviewCheckHelpers";
import type {
  RuntimeFinalOrchestrationReadinessBoundary,
  RuntimeFinalOrchestrationReadinessChecklist,
  RuntimeOrchestrationForbiddenProof,
  RuntimeOrchestrationReadinessInputEnvelope,
  RuntimeOrchestrationReadinessOutputEnvelope,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateGovernanceReviewVerificationReport,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

export function verifyRuntimeUltimateGovernanceReviewReadiness(input: {
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly boundary: RuntimeFinalOrchestrationReadinessBoundary;
  readonly inputEnvelope: RuntimeOrchestrationReadinessInputEnvelope;
  readonly outputEnvelope: RuntimeOrchestrationReadinessOutputEnvelope;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
  readonly checklist: RuntimeFinalOrchestrationReadinessChecklist;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
}): RuntimeUltimateGovernanceReviewVerificationReport {
  const {
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noEnforcementProof,
    forbiddenProof,
    checklist,
    blockerReport,
  } = input;
  const findings: string[] = [];

  if (
    summary.reviewStatus === "ultimate_governance_metadata_ready" &&
    summary.reviewMode !== "metadata_only"
  ) {
    findings.push("ultimate_governance_metadata_ready requires reviewMode metadata_only");
  }
  if (summary.reviewStatus === "blocked" && summary.reviewBlockers.length === 0) {
    findings.push("blocked reviewStatus requires reviewBlockers");
  }
  if (!ultimateBoundarySourceLayerValid(boundary.boundarySourceLayer)) {
    findings.push("boundary.boundarySourceLayer must be runtimeFinalReleaseGovernanceGateFinalSafetyGate");
  }
  if (!ultimateBoundaryTargetLayerValid(boundary.boundaryTargetLayer)) {
    findings.push("boundary.boundaryTargetLayer must be finalOrchestrationReadinessBoundary");
  }
  if (boundary.forbiddenBoundaryOperations.length === 0) {
    findings.push("boundary.forbiddenBoundaryOperations must be non-empty");
  }
  for (const fragment of ULTIMATE_GOVERNANCE_VERIFICATION_INPUT_ENVELOPE_FRAGMENTS) {
    if (!runtimeEnvelopeIncludes(inputEnvelope.envelopeRows, fragment)) {
      findings.push(`input envelope missing ${fragment}`);
    }
  }
  if (!runtimeEnvelopeIncludes(outputEnvelope.envelopeRows, "ultimateNoEnforcementProofDiagnosticOnly")) {
    findings.push("output envelope missing ultimate no-enforcement proof");
  }
  if (!runtimeEnvelopeIncludes(outputEnvelope.envelopeRows, "orchestrationForbiddenProofComplete")) {
    findings.push("output envelope missing orchestration-forbidden proof");
  }
  if (!isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof)) {
    findings.push("ultimateNoEnforcementProof.diagnosticOnly must be true");
  }
  if (!isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof)) {
    findings.push("orchestration-forbidden proof incomplete");
  }
  for (const label of ULTIMATE_GOVERNANCE_VERIFICATION_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!ultimateGovernanceBlockersAligned(blockerReport.blockers, summary.reviewBlockers)) {
    findings.push("blocker report and summary.reviewBlockers misaligned");
  }
  if (
    summary.reviewStatus === "ultimate_governance_metadata_ready" &&
    (blockerReport.blockers.length > 0 || summary.reviewBlockers.length > 0)
  ) {
    findings.push("ultimate_governance_metadata_ready requires no review blockers");
  }

  const verificationStatus = resolveUltimateGovernanceReviewVerificationStatus(findings);

  return {
    mode: "runtime_ultimate_governance_review_verification_report",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(verificationStatus === "verified_metadata"
        ? ["H40.5: ultimate governance review verified_metadata — H41 entry 후보(orchestration 없음)"]
        : []),
      ...(verificationStatus === "partial"
        ? ["H40.5: ultimate governance review partial — boundary·envelope·checklist 정합성 재검토"]
        : []),
      ...(verificationStatus === "failed"
        ? ["H40.5: ultimate governance review failed — proof·blocker·mode alignment 정렬"]
        : []),
    ]),
  };
}

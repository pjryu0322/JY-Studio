/**
 * H33 / H33.5 — Overlay runtime **no-op shell hardening** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_SHELL_HARDENING_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_HARDENING_CONTRACT_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_HARDENING_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_HARDENING_MODE_LABEL_KO,
  RUNTIME_NOOP_SHELL_HARDENING_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_NOOP_SHELL_HARDENING_READINESS_LABEL_KO,
  RUNTIME_NOOP_SHELL_HARDENING_SECTION_DISCLAIMER_KO,
  runtimeNoopShellHardeningReadinessVerificationStatusKo,
} from "@/lib/harness/runtimeNoopShellHardening/runtimeNoopShellHardeningLabelsKo";

export type OverlayRuntimeNoopShellHardeningSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  hardeningReadinessKo: string;
  hardeningModeKo: string;
  contractVerificationStatusKo: string;
  preflightReadinessKo: string;
  finalGateStatusKo: string;
  h34EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topHardeningBlocker: string | null;
  topBoundaryViolation: string | null;
  noExecutionResultSummaryKo: string;
  safetyGuardSummaryKo: string;
  topViolationOrBlocker: string | null;
  contractRowSample: readonly string[];
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  guardRows: readonly string[];
  boundaryViolationRows: readonly string[];
  contractFindingRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  preflightChecklistRows: readonly string[];
  hardeningBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeNoopShellHardeningSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeNoopShellHardeningSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeNoopShellHardeningSummary;
  const contract = reports.runtimeNoopShellHardeningContract;
  const inputEnvelope = reports.runtimeNoopShellHardeningInputEnvelope;
  const outputEnvelope = reports.runtimeNoopShellHardeningOutputEnvelope;
  const result = reports.runtimeNoopShellNoExecutionResultMetadata;
  const guard = reports.runtimeNoopShellHardeningSafetyGuard;
  const verification = reports.runtimeNoopShellHardeningContractVerificationReport;
  const boundary = reports.runtimeNoopShellHardeningBoundaryViolationReport;
  const preflight = reports.runtimeNoopShellHardeningPreflightSummary;
  const readinessVerification = reports.runtimeNoopShellHardeningReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellHardeningAlignmentReport;
  const finalGate = reports.runtimeNoopShellHardeningFinalSafetyGate;

  const contractRowSample = compactAndNarrowUi
    ? contract.forbiddenHardeningOperations.slice(0, 1)
    : [...contract.forbiddenHardeningOperations.slice(0, 4)];
  const inputEnvelopeRows = compactAndNarrowUi
    ? inputEnvelope.envelopeRows.slice(0, 1)
    : [...inputEnvelope.envelopeRows];
  const outputEnvelopeRows = compactAndNarrowUi
    ? outputEnvelope.envelopeRows.slice(0, 1)
    : [...outputEnvelope.envelopeRows];
  const guardRows = compactAndNarrowUi ? guard.guardRows.slice(0, 1) : [...guard.guardRows];
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const contractFindingRows = compactAndNarrowUi ? verification.findings.slice(0, 1) : [...verification.findings];
  const readinessFindingRows = compactAndNarrowUi
    ? readinessVerification.findings.slice(0, 1)
    : [...readinessVerification.findings];
  const alignmentFindingRows = compactAndNarrowUi ? alignment.findings.slice(0, 1) : [...alignment.findings];
  const finalGateChecklistRows = compactAndNarrowUi ? finalGate.checklist.slice(0, 1) : [...finalGate.checklist];
  const preflightChecklistRows = compactAndNarrowUi ? preflight.checklist.slice(0, 1) : [...preflight.checklist];
  const hardeningBlockerRows = compactAndNarrowUi
    ? [...s.hardeningBlockers.slice(0, 1), ...preflight.blockers.slice(0, 1)]
    : mergeSortedUniqueKo([...s.hardeningBlockers, ...preflight.blockers]);
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]);

  const topBoundaryViolation =
    boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topHardeningBlocker = s.hardeningBlockers[0] ?? preflight.blockers[0] ?? null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topBoundaryViolation ?? topHardeningBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? verification.findings[0] ?? null;

  const noExecutionResultSummaryKo = [
    `noopShellExecuted: ${result.noopShellExecuted}`,
    `executionShellExecuted: ${result.executionShellExecuted}`,
    `diagnosticOnly: ${result.diagnosticOnly}`,
  ].join(" · ");

  const safetyGuardSummaryKo = [
    "actualShellExecutionForbidden: true",
    "actualAdapterInvocationForbidden: true",
    "actualExecutionForbidden: true",
    "actualPromptMutationForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_NOOP_SHELL_HARDENING_SECTION_DISCLAIMER_KO,
    showAttention:
      s.hardeningReadiness !== "hardening_metadata_ready" ||
      s.hardeningMode === "blocked" ||
      verification.verificationStatus !== "verified_metadata" ||
      preflight.preflightReadiness !== "ready_metadata" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      boundary.actualFlagViolations.length > 0 ||
      s.hardeningBlockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    hardeningReadinessKo: RUNTIME_NOOP_SHELL_HARDENING_READINESS_LABEL_KO[s.hardeningReadiness],
    hardeningModeKo: RUNTIME_NOOP_SHELL_HARDENING_MODE_LABEL_KO[s.hardeningMode],
    contractVerificationStatusKo:
      RUNTIME_NOOP_SHELL_HARDENING_CONTRACT_VERIFICATION_STATUS_LABEL_KO[verification.verificationStatus],
    preflightReadinessKo: RUNTIME_NOOP_SHELL_HARDENING_PREFLIGHT_READINESS_LABEL_KO[preflight.preflightReadiness],
    finalGateStatusKo: RUNTIME_NOOP_SHELL_HARDENING_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h34EntryReadinessKo: RUNTIME_NOOP_SHELL_HARDENING_FINAL_GATE_STATUS_LABEL_KO[finalGate.h34EntryReadiness],
    readinessVerificationStatusKo: runtimeNoopShellHardeningReadinessVerificationStatusKo(
      readinessVerification.verificationStatus
    ),
    alignmentStatusKo: RUNTIME_NOOP_SHELL_HARDENING_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topReadinessFinding,
    topAlignmentFinding,
    topHardeningBlocker,
    topBoundaryViolation,
    noExecutionResultSummaryKo,
    safetyGuardSummaryKo,
    topViolationOrBlocker,
    contractRowSample,
    inputEnvelopeRows,
    outputEnvelopeRows,
    guardRows,
    boundaryViolationRows,
    contractFindingRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    preflightChecklistRows,
    hardeningBlockerRows,
    recommendationRows,
  };
}

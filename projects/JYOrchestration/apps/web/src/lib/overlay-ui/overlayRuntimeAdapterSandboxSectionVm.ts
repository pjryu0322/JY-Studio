/**
 * H26 / H26.5 — Overlay runtime **adapter sandbox** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_ADAPTER_SANDBOX_MODE_LABEL_KO,
  RUNTIME_ADAPTER_SANDBOX_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_ADAPTER_SANDBOX_READINESS_LABEL_KO,
  RUNTIME_ADAPTER_SANDBOX_SECTION_DISCLAIMER_KO,
  runtimeAdapterSandboxEnvelopeVerificationStatusKo,
} from "@/lib/harness/runtimeAdapterSandbox/runtimeAdapterSandboxLabelsKo";

export type OverlayRuntimeAdapterSandboxSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  sandboxReadinessKo: string;
  sandboxModeKo: string;
  sandboxPreflightReadinessKo: string;
  envelopeVerificationStatusKo: string;
  topSandboxBlocker: string | null;
  topBoundaryViolation: string | null;
  topViolationOrBlocker: string | null;
  topForbiddenSandboxOperation: string | null;
  topEnvelopeFinding: string | null;
  inputEnvelopeSummaryRows: readonly string[];
  outputEnvelopeSummaryRows: readonly string[];
  forbiddenSandboxOperationRows: readonly string[];
  envelopeFindingRows: readonly string[];
  boundaryViolationRows: readonly string[];
  sandboxResultRows: readonly string[];
  preflightChecklistRows: readonly string[];
  preflightBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeAdapterSandboxSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeAdapterSandboxSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeAdapterSandboxSummary;
  const input = reports.runtimeAdapterSandboxInputEnvelope;
  const output = reports.runtimeAdapterSandboxOutputEnvelope;
  const policy = reports.runtimeAdapterSandboxPolicy;
  const result = reports.runtimeAdapterSandboxResultMetadata;
  const blockers = reports.runtimeAdapterSandboxBlockerReport;
  const env = reports.runtimeAdapterSandboxEnvelopeVerificationReport;
  const v = reports.runtimeAdapterSandboxBoundaryViolationReport;
  const pf = reports.runtimeAdapterSandboxPreflightSummary;

  const inputEnvelopeSummaryRows = compactAndNarrowUi
    ? input.envelopeRows.slice(0, 1)
    : [...input.envelopeRows];
  const outputEnvelopeSummaryRows = compactAndNarrowUi
    ? [...output.acceptedMetadataRows.slice(0, 1), ...output.safetyEnvelopeRows.slice(0, 1)]
    : [...output.acceptedMetadataRows, ...output.safetyEnvelopeRows];
  const forbiddenSandboxOperationRows = compactAndNarrowUi
    ? policy.forbiddenSandboxOperations.slice(0, 1)
    : [...policy.forbiddenSandboxOperations];
  const envelopeFindingRows = compactAndNarrowUi
    ? [...env.findings.slice(0, 1), ...env.missingInputEnvelopeRefs.slice(0, 1)]
    : [...env.findings, ...env.missingInputEnvelopeRefs];
  const boundaryViolationRows = compactAndNarrowUi
    ? [...v.actualFlagViolations.slice(0, 1), ...v.wordingRiskFindings.slice(0, 1)]
    : [...v.actualFlagViolations, ...v.wordingRiskFindings];
  const sandboxResultRows = compactAndNarrowUi ? result.resultRows.slice(0, 1) : [...result.resultRows];
  const preflightChecklistRows = compactAndNarrowUi ? pf.checklist.slice(0, 1) : [...pf.checklist];
  const preflightBlockerRows = compactAndNarrowUi ? pf.blockers.slice(0, 1) : [...pf.blockers];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  const topBoundaryViolation = v.actualFlagViolations[0] ?? v.wordingRiskFindings[0] ?? null;
  const topSandboxBlocker = blockers.blockers[0] ?? s.sandboxBlockers[0] ?? null;
  const topEnvelopeFinding = env.findings[0] ?? env.missingInputEnvelopeRefs[0] ?? null;
  const topViolationOrBlocker = topBoundaryViolation ?? topSandboxBlocker ?? topEnvelopeFinding;
  const topForbiddenSandboxOperation = policy.forbiddenSandboxOperations[0] ?? null;

  return {
    sectionDisclaimer: RUNTIME_ADAPTER_SANDBOX_SECTION_DISCLAIMER_KO,
    showAttention:
      s.sandboxReadiness !== "sandbox_metadata_ready" ||
      pf.preflightReadiness !== "ready_metadata" ||
      s.sandboxMode === "blocked" ||
      blockers.blockers.length > 0 ||
      v.actualFlagViolations.length > 0 ||
      env.verificationStatus !== "verified_metadata",
    showDetailSections: !compactAndNarrowUi,
    sandboxReadinessKo: RUNTIME_ADAPTER_SANDBOX_READINESS_LABEL_KO[s.sandboxReadiness],
    sandboxModeKo: RUNTIME_ADAPTER_SANDBOX_MODE_LABEL_KO[s.sandboxMode],
    sandboxPreflightReadinessKo: RUNTIME_ADAPTER_SANDBOX_PREFLIGHT_READINESS_LABEL_KO[pf.preflightReadiness],
    envelopeVerificationStatusKo: runtimeAdapterSandboxEnvelopeVerificationStatusKo(env.verificationStatus),
    topSandboxBlocker,
    topBoundaryViolation,
    topViolationOrBlocker,
    topForbiddenSandboxOperation,
    topEnvelopeFinding,
    inputEnvelopeSummaryRows,
    outputEnvelopeSummaryRows,
    forbiddenSandboxOperationRows,
    envelopeFindingRows,
    boundaryViolationRows,
    sandboxResultRows,
    preflightChecklistRows,
    preflightBlockerRows,
    recommendationRows,
  };
}

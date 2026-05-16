/**
 * H26 — Overlay runtime **adapter sandbox** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_ADAPTER_SANDBOX_MODE_LABEL_KO,
  RUNTIME_ADAPTER_SANDBOX_READINESS_LABEL_KO,
  RUNTIME_ADAPTER_SANDBOX_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeAdapterSandbox/runtimeAdapterSandboxLabelsKo";

export type OverlayRuntimeAdapterSandboxSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  sandboxReadinessKo: string;
  sandboxModeKo: string;
  topSandboxBlocker: string | null;
  topForbiddenSandboxOperation: string | null;
  inputEnvelopeSummaryRows: readonly string[];
  outputEnvelopeSummaryRows: readonly string[];
  forbiddenSandboxOperationRows: readonly string[];
  sandboxResultRows: readonly string[];
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

  const inputEnvelopeSummaryRows = compactAndNarrowUi
    ? input.envelopeRows.slice(0, 1)
    : [...input.envelopeRows];
  const outputEnvelopeSummaryRows = compactAndNarrowUi
    ? [...output.acceptedMetadataRows.slice(0, 1), ...output.safetyEnvelopeRows.slice(0, 1)]
    : [...output.acceptedMetadataRows, ...output.safetyEnvelopeRows];
  const forbiddenSandboxOperationRows = compactAndNarrowUi
    ? policy.forbiddenSandboxOperations.slice(0, 1)
    : [...policy.forbiddenSandboxOperations];
  const sandboxResultRows = compactAndNarrowUi ? result.resultRows.slice(0, 1) : [...result.resultRows];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  const topSandboxBlocker = blockers.blockers[0] ?? s.sandboxBlockers[0] ?? null;
  const topForbiddenSandboxOperation = policy.forbiddenSandboxOperations[0] ?? null;

  return {
    sectionDisclaimer: RUNTIME_ADAPTER_SANDBOX_SECTION_DISCLAIMER_KO,
    showAttention:
      s.sandboxReadiness !== "sandbox_metadata_ready" ||
      s.sandboxMode === "blocked" ||
      blockers.blockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    sandboxReadinessKo: RUNTIME_ADAPTER_SANDBOX_READINESS_LABEL_KO[s.sandboxReadiness],
    sandboxModeKo: RUNTIME_ADAPTER_SANDBOX_MODE_LABEL_KO[s.sandboxMode],
    topSandboxBlocker,
    topForbiddenSandboxOperation,
    inputEnvelopeSummaryRows,
    outputEnvelopeSummaryRows,
    forbiddenSandboxOperationRows,
    sandboxResultRows,
    recommendationRows,
  };
}

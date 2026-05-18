/**
 * H25 / H25.5 — Overlay runtime **no-op adapter** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_ADAPTER_INVOCATION_GUARD_LABEL_KO,
  RUNTIME_NOOP_ADAPTER_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_NOOP_ADAPTER_SECTION_DISCLAIMER_KO,
  RUNTIME_NOOP_ADAPTER_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeNoopAdapter/runtimeNoopAdapterLabelsKo";

export type OverlayRuntimeNoopAdapterSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  noopAdapterStatusKo: string;
  invocationGuardKo: string;
  contractVerificationStatusKo: string;
  preflightReadinessKo: string;
  topViolation: string | null;
  topPreflightBlocker: string | null;
  topViolationOrBlocker: string | null;
  topForbiddenOperation: string | null;
  noopResultRows: readonly string[];
  skeletonInputRows: readonly string[];
  violationRows: readonly string[];
  forbiddenOperationRows: readonly string[];
  preflightChecklistRows: readonly string[];
  preflightBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

const VERIFICATION_STATUS_LABEL_KO: Record<string, string> = {
  failed: "contract 검증 실패",
  partial: "contract 검증 부분",
  verified_noop: "contract no-op 검증 완료",
};

export function buildOverlayRuntimeNoopAdapterSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeNoopAdapterSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeNoopAdapterSummary;
  const sk = reports.runtimeNoopAdapterSkeleton;
  const v = reports.runtimeNoopAdapterBoundaryViolationReport;
  const pf = reports.runtimeNoopAdapterPreflightSummary;

  const noopResultRows = compactAndNarrowUi ? s.noopResultMetadata.slice(0, 1) : [...s.noopResultMetadata];
  const skeletonInputRows = compactAndNarrowUi ? sk.acceptedContractInputs.slice(0, 1) : [...sk.acceptedContractInputs];
  const violationRows = compactAndNarrowUi
    ? [...v.actualFlagViolations.slice(0, 1), ...v.wordingRiskFindings.slice(0, 1)]
    : [...v.actualFlagViolations, ...v.wordingRiskFindings];
  const forbiddenOperationRows = compactAndNarrowUi
    ? sk.forbiddenOperations.slice(0, 1)
    : [...sk.forbiddenOperations];
  const preflightChecklistRows = compactAndNarrowUi ? pf.checklist.slice(0, 1) : [...pf.checklist];
  const preflightBlockerRows = compactAndNarrowUi ? pf.blockers.slice(0, 1) : [...pf.blockers];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  const topViolation = v.actualFlagViolations[0] ?? v.wordingRiskFindings[0] ?? null;
  const topPreflightBlocker = pf.blockers[0] ?? null;
  const topViolationOrBlocker = topViolation ?? topPreflightBlocker;

  return {
    sectionDisclaimer: RUNTIME_NOOP_ADAPTER_SECTION_DISCLAIMER_KO,
    showAttention:
      s.noopAdapterStatus !== "not_available" ||
      s.invocationGuard !== "noop_only" ||
      pf.preflightReadiness !== "ready_metadata" ||
      v.actualFlagViolations.length > 0 ||
      v.wordingRiskFindings.length > 0,
    showDetailSections: !compactAndNarrowUi,
    noopAdapterStatusKo: RUNTIME_NOOP_ADAPTER_STATUS_LABEL_KO[s.noopAdapterStatus],
    invocationGuardKo: RUNTIME_NOOP_ADAPTER_INVOCATION_GUARD_LABEL_KO[s.invocationGuard],
    contractVerificationStatusKo:
      VERIFICATION_STATUS_LABEL_KO[s.contractVerificationStatus] ?? s.contractVerificationStatus,
    preflightReadinessKo: RUNTIME_NOOP_ADAPTER_PREFLIGHT_READINESS_LABEL_KO[pf.preflightReadiness],
    topViolation,
    topPreflightBlocker,
    topViolationOrBlocker,
    topForbiddenOperation: sk.forbiddenOperations[0] ?? null,
    noopResultRows,
    skeletonInputRows,
    violationRows,
    forbiddenOperationRows,
    preflightChecklistRows,
    preflightBlockerRows,
    recommendationRows,
  };
}

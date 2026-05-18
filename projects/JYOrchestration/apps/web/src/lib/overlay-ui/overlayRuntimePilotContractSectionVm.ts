/**
 * H24.5 — Overlay runtime **pilot contract** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_ADAPTER_BOUNDARY_MODE_LABEL_KO,
  RUNTIME_PILOT_CONTRACT_READINESS_LABEL_KO,
  RUNTIME_PILOT_CONTRACT_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimePilotContract/runtimePilotContractLabelsKo";

export type OverlayRuntimePilotContractSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  contractReadinessKo: string;
  adapterBoundaryModeKo: string;
  handoffReadinessKo: string;
  topHandoffBlocker: string | null;
  topForbiddenOperation: string | null;
  inputRequirementRows: readonly string[];
  outputExpectationRows: readonly string[];
  handoffBlockerRows: readonly string[];
  forbiddenOperationRows: readonly string[];
  recommendationRows: readonly string[];
}>;

const HANDOFF_READINESS_LABEL_KO: Record<string, string> = {
  not_ready: "handoff 미준비",
  metadata_watch: "handoff 메타 주시",
  metadata_ready: "handoff 메타 준비(실행·adapter 없음)",
  blocked: "handoff 차단",
};

export function buildOverlayRuntimePilotContractSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimePilotContractSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const c = reports.runtimePilotContractSummary;
  const h = reports.runtimePilotHandoffReadiness;
  const f = reports.runtimeAdapterForbiddenOperationReport;

  const inputRequirementRows = compactAndNarrowUi
    ? c.contractInputRequirements.slice(0, 1)
    : [...c.contractInputRequirements];
  const outputExpectationRows = compactAndNarrowUi
    ? c.contractOutputExpectations.slice(0, 1)
    : [...c.contractOutputExpectations];
  const handoffBlockerRows = compactAndNarrowUi ? c.handoffBlockers.slice(0, 1) : [...c.handoffBlockers];
  const forbiddenOperationRows = compactAndNarrowUi
    ? f.forbiddenOperations.slice(0, 1)
    : [...f.forbiddenOperations];
  const recommendationRows = compactAndNarrowUi ? c.recommendations.slice(0, 1) : [...c.recommendations];

  return {
    sectionDisclaimer: RUNTIME_PILOT_CONTRACT_SECTION_DISCLAIMER_KO,
    showAttention:
      c.contractReadiness !== "not_ready" ||
      c.adapterBoundaryMode !== "no_op_only" ||
      c.handoffBlockers.length > 0 ||
      f.forbiddenOperations.length > 0,
    showDetailSections: !compactAndNarrowUi,
    contractReadinessKo: RUNTIME_PILOT_CONTRACT_READINESS_LABEL_KO[c.contractReadiness],
    adapterBoundaryModeKo: RUNTIME_ADAPTER_BOUNDARY_MODE_LABEL_KO[c.adapterBoundaryMode],
    handoffReadinessKo: HANDOFF_READINESS_LABEL_KO[h.handoffReadiness] ?? h.handoffReadiness,
    topHandoffBlocker: c.handoffBlockers[0] ?? null,
    topForbiddenOperation: f.forbiddenOperations[0] ?? null,
    inputRequirementRows,
    outputExpectationRows,
    handoffBlockerRows,
    forbiddenOperationRows,
    recommendationRows,
  };
}

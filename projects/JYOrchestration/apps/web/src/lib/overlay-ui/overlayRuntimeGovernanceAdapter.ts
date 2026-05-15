/**
 * H10.5 — Overlay **런타임 거버넌스** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import {
  ROLLBACK_SAFETY_RISK_LABEL_KO,
  RUNTIME_GOVERNANCE_APPROVAL_LABEL_KO,
  RUNTIME_GOVERNANCE_EMPTY_BLOCKERS_LABEL_KO,
  RUNTIME_GOVERNANCE_RISK_LABEL_KO,
  RUNTIME_GOVERNANCE_ROLLBACK_READINESS_LABEL_KO,
  RUNTIME_GOVERNANCE_SECTION_DISCLAIMER_KO,
  runtimeGovernanceAuditabilityLevelLabelKo,
  runtimeGovernanceOperatorReviewLabelKo,
} from "@/lib/harness/runtimeGovernance/runtimeGovernanceLabelsKo";

export type OverlayRuntimeGovernanceSectionVM = Readonly<{
  sectionDisclaimer: string;
  approvalReadinessLabel: string;
  rollbackReadinessLabel: string;
  governanceBlockers: readonly string[];
  auditabilityLevelLabel: string;
  governanceRiskLabel: string;
  operatorReviewReadinessLabel: string;
  rollbackSafetyRiskLabel: string;
  rollbackSafetyFactors: readonly string[];
  auditabilityDisclaimer: string;
  auditabilityRows: readonly Readonly<{ title: string; note: string }>[];
}>;

export function buildOverlayRuntimeGovernanceSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
}): OverlayRuntimeGovernanceSectionVM {
  const { governance, rollbackSafety, auditability } = buildRuntimeGovernancePlanningContext({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    extract: input.overlay,
  });

  return {
    sectionDisclaimer: RUNTIME_GOVERNANCE_SECTION_DISCLAIMER_KO,
    approvalReadinessLabel: RUNTIME_GOVERNANCE_APPROVAL_LABEL_KO[governance.approvalMode],
    rollbackReadinessLabel: RUNTIME_GOVERNANCE_ROLLBACK_READINESS_LABEL_KO[governance.rollbackReadiness],
    governanceBlockers: governance.blockers.length ? governance.blockers : [RUNTIME_GOVERNANCE_EMPTY_BLOCKERS_LABEL_KO],
    auditabilityLevelLabel: runtimeGovernanceAuditabilityLevelLabelKo(governance.auditabilityLevel),
    governanceRiskLabel: RUNTIME_GOVERNANCE_RISK_LABEL_KO[governance.governanceRisk],
    operatorReviewReadinessLabel: runtimeGovernanceOperatorReviewLabelKo(governance.operatorReviewReadiness),
    rollbackSafetyRiskLabel: ROLLBACK_SAFETY_RISK_LABEL_KO[rollbackSafety.rollbackRisk],
    rollbackSafetyFactors: rollbackSafety.factorsKo,
    auditabilityDisclaimer: auditability.disclaimerKo,
    auditabilityRows: auditability.plannedTraceTargets.map((t) => ({
      title: t.labelKo,
      note: t.planningNoteKo,
    })),
  };
}

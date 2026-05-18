/**
 * H11.5 — Overlay **통제 enforcement governance** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildGovernanceDependencyPlanning } from "@/lib/harness/enforcementGovernance/buildGovernanceDependencyPlanning";
import { evaluateControlledEnforcementGovernance } from "@/lib/harness/enforcementGovernance/evaluateControlledEnforcementGovernance";
import { buildGovernanceRiskSummary } from "@/lib/harness/enforcementGovernance/governanceRiskSummary";
import type { EnforcementApprovalRequirement, EnforcementRollbackDependency } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import {
  CONTROLLED_ENFORCEMENT_GOVERNANCE_SECTION_DISCLAIMER_KO,
  ENFORCEMENT_GOVERNANCE_MODE_LABEL_KO,
  GOVERNANCE_RISK_SUMMARY_LEVEL_LABEL_KO,
} from "@/lib/harness/enforcementGovernance/enforcementGovernanceLabelsKo";

const APPROVAL_KO: Record<EnforcementApprovalRequirement, string> = {
  operator_required: "운영자 필수",
  governance_required: "거버넌스 필수",
  auditability_required: "감사 계획 필수",
};

const ROLLBACK_DEP_KO: Record<EnforcementRollbackDependency, string> = {
  required: "필수",
  recommended: "권장",
  optional: "선택",
};

export type OverlayControlledEnforcementGovernanceSectionVM = Readonly<{
  sectionDisclaimer: string;
  governanceReadinessLabel: string;
  governanceModeLabel: string;
  governanceRiskLevelLabel: string;
  eligibleCandidates: readonly string[];
  blockedCandidates: readonly string[];
  requiredGovernanceConditions: readonly string[];
  requiredRollbackConditions: readonly string[];
  requiredAuditabilityConditions: readonly string[];
  dependencyRows: readonly Readonly<{ title: string; approvalLabel: string; rollbackLabel: string; note: string }>[];
  governanceRiskFactors: readonly string[];
}>;

export function buildOverlayControlledEnforcementGovernanceSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): OverlayControlledEnforcementGovernanceSectionVM {
  const governanceCtx = buildRuntimeGovernancePlanningContext({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    extract: input.overlay,
  });
  const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    governanceCtx,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const controlled = evaluateControlledEnforcementGovernance({
    releaseGate: input.releaseGate,
    governanceCtx,
    candidateReport: enforcementPlanning.candidateReport,
    capabilityPlanning: enforcementPlanning.capabilityPlanning,
  });
  const dependencyPlanning = buildGovernanceDependencyPlanning({
    governanceCtx,
    controlledGovernance: controlled,
  });
  const riskSummary = buildGovernanceRiskSummary({
    baseline: input.maturityBaseline,
    governanceCtx,
    candidateReport: enforcementPlanning.candidateReport,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });

  return {
    sectionDisclaimer: CONTROLLED_ENFORCEMENT_GOVERNANCE_SECTION_DISCLAIMER_KO,
    governanceReadinessLabel: controlled.governanceReadinessEligible
      ? "거버넌스 기반 후보 허용(메타)"
      : "거버넌스 기반 후보 비허용(메타)",
    governanceModeLabel: ENFORCEMENT_GOVERNANCE_MODE_LABEL_KO[controlled.governanceMode],
    governanceRiskLevelLabel: GOVERNANCE_RISK_SUMMARY_LEVEL_LABEL_KO[riskSummary.governanceRiskLevel],
    eligibleCandidates: controlled.eligibleCandidates,
    blockedCandidates: controlled.blockedCandidates,
    requiredGovernanceConditions: controlled.requiredGovernanceConditions,
    requiredRollbackConditions: controlled.requiredRollbackConditions,
    requiredAuditabilityConditions: controlled.requiredAuditabilityConditions,
    dependencyRows: dependencyPlanning.rows.map((r) => ({
      title: r.labelKo,
      approvalLabel: APPROVAL_KO[r.approvalRequirement],
      rollbackLabel: ROLLBACK_DEP_KO[r.rollbackDependency],
      note: r.noteKo,
    })),
    governanceRiskFactors: riskSummary.factorNotesKo,
  };
}

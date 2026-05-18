/**
 * H11 — Overlay **enforcement 후보** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildCandidateCapabilityPlanning } from "@/lib/harness/runtimeEnforcement/buildCandidateCapabilityPlanning";
import { evaluateRuntimeEnforcementCandidate } from "@/lib/harness/runtimeEnforcement/evaluateRuntimeEnforcementCandidate";
import { buildRuntimeEnforcementRiskSummary } from "@/lib/harness/runtimeEnforcement/runtimeEnforcementRiskSummary";
import type { CandidateCapabilityStatus } from "@/lib/harness/runtimeEnforcement/runtimeEnforcementCandidateTypes";
import {
  ENFORCEMENT_CANDIDATE_MODE_LABEL_KO,
  ENFORCEMENT_CANDIDATE_RISK_LABEL_KO,
  ENFORCEMENT_RISK_SUMMARY_LEVEL_LABEL_KO,
  RUNTIME_ENFORCEMENT_CANDIDATE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeEnforcement/runtimeEnforcementLabelsKo";

const STATUS_KO: Record<CandidateCapabilityStatus, string> = {
  blocked: "차단(후보 제외)",
  candidate: "후보",
  planning_only: "계획만",
};

export type OverlayRuntimeEnforcementCandidateSectionVM = Readonly<{
  sectionDisclaimer: string;
  candidateReadinessLabel: string;
  candidateEligibleLabel: string;
  riskLevelLabel: string;
  enforcementRiskLevelLabel: string;
  governanceDependencyLabel: string;
  rollbackDependencyLabel: string;
  blockedCapabilities: readonly string[];
  candidateCapabilities: readonly string[];
  capabilityRows: readonly Readonly<{ title: string; statusLabel: string; note: string }>[];
  riskFactorNotes: readonly string[];
}>;

export function buildOverlayRuntimeEnforcementCandidateSectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): OverlayRuntimeEnforcementCandidateSectionVM {
  const governanceCtx = buildRuntimeGovernancePlanningContext({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    extract: input.overlay,
  });
  const candidateReport = evaluateRuntimeEnforcementCandidate({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    governanceCtx,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const riskSummary = buildRuntimeEnforcementRiskSummary({
    baseline: input.maturityBaseline,
    governanceCtx,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
  });
  const capabilityPlanning = buildCandidateCapabilityPlanning({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    governanceCtx,
    candidateReport,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });

  return {
    sectionDisclaimer: RUNTIME_ENFORCEMENT_CANDIDATE_SECTION_DISCLAIMER_KO,
    candidateReadinessLabel: ENFORCEMENT_CANDIDATE_MODE_LABEL_KO[candidateReport.candidateMode],
    candidateEligibleLabel: candidateReport.candidateEligible ? "후보 적격(메타)" : "후보 비적격(메타)",
    riskLevelLabel: ENFORCEMENT_CANDIDATE_RISK_LABEL_KO[candidateReport.riskLevel],
    enforcementRiskLevelLabel: ENFORCEMENT_RISK_SUMMARY_LEVEL_LABEL_KO[riskSummary.enforcementRiskLevel],
    governanceDependencyLabel: candidateReport.governanceDependencySummaryKo,
    rollbackDependencyLabel: candidateReport.rollbackDependencySummaryKo,
    blockedCapabilities: candidateReport.blockedCapabilities,
    candidateCapabilities: candidateReport.candidateCapabilities,
    capabilityRows: capabilityPlanning.rows.map((r) => ({
      title: r.labelKo,
      statusLabel: STATUS_KO[r.status],
      note: r.noteKo,
    })),
    riskFactorNotes: riskSummary.factorNotesKo,
  };
}

/**
 * H12 — enforcement **후보·거버넌스 포화** planning 분석(read-only).
 */

import type { ControlledEnforcementGovernanceReport } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import type { GovernanceDependencyPlanningReport } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import { countOverlayHarnessPlanningBlocks } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type {
  CandidateCapabilityPlanningReport,
  RuntimeEnforcementCandidateReport,
} from "@/lib/harness/runtimeEnforcement/runtimeEnforcementCandidateTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { OverlayOverloadSummary } from "@/lib/overlay-ui/overlayOverloadMitigation";
import type { CandidateSaturationLevel, CandidateSaturationSummary } from "./runtimeStabilityTypes";

export function evaluateCandidateSaturation(input: {
  readonly candidateReport: RuntimeEnforcementCandidateReport;
  readonly capabilityPlanning: CandidateCapabilityPlanningReport;
  readonly controlledGovernance: ControlledEnforcementGovernanceReport;
  readonly dependencyPlanning: GovernanceDependencyPlanningReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly overlayWarningCount: number;
  readonly overlayOverload: OverlayOverloadSummary;
}): CandidateSaturationSummary {
  const candidateCount =
    input.capabilityPlanning.rows.filter((r) => r.status === "candidate").length +
    input.controlledGovernance.eligibleCandidates.length;
  const depCount = input.dependencyPlanning.rows.length;
  const govConditionCount =
    input.controlledGovernance.requiredGovernanceConditions.length +
    input.controlledGovernance.requiredRollbackConditions.length +
    input.controlledGovernance.requiredAuditabilityConditions.length;
  const planningBlocks = countOverlayHarnessPlanningBlocks(input.extract);
  const factors: string[] = [];

  let level: CandidateSaturationLevel = "low";
  const bump = (next: CandidateSaturationLevel) => {
    const order: CandidateSaturationLevel[] = ["low", "medium", "high"];
    if (order.indexOf(next) > order.indexOf(level)) level = next;
  };

  if (candidateCount >= 6) {
    factors.push(`동시 enforcement 후보 메타가 ${candidateCount}건으로 많습니다.`);
    bump("high");
  } else if (candidateCount >= 4) {
    factors.push(`후보 capability 행이 ${candidateCount}건입니다.`);
    bump("medium");
  }

  if (govConditionCount >= 10) {
    factors.push("Governance·rollback·auditability 필수 조건이 과도합니다.");
    bump("high");
  } else if (govConditionCount >= 6) {
    factors.push("Governance dependency 조건이 다수입니다.");
    bump("medium");
  }

  if (depCount >= 5 && input.controlledGovernance.governanceMode === "planning_only") {
    factors.push("Dependency planning 행은 많으나 governance 모드는 planning_only입니다.");
    bump("medium");
  }

  if (planningBlocks > 8) {
    factors.push(`Harness planning 블록 추정 ${planningBlocks}건 — Overlay 과밀 가능.`);
    bump(planningBlocks > 10 ? "high" : "medium");
  }

  if (input.overlayOverload.overlayOverloadRisk === "high") {
    factors.push("Overlay 과밀 위험이 높게 분류되었습니다.");
    bump("high");
  } else if (input.overlayOverload.overlayOverloadRisk === "medium") {
    bump("medium");
  }

  if (input.overlayWarningCount >= 8) {
    factors.push("Overlay 정책 경고가 많아 planning 섹션 포화 가능.");
    bump("medium");
  }

  const reviewOverload =
    (input.extract?.reviewSecurityHarnessPlan?.findings?.length ?? 0) +
    (input.extract?.remediationLoopPlan?.steps?.length ?? 0);
  if (reviewOverload >= 10) {
    factors.push("Review/Security·remediation planning 블록이 과다합니다.");
    bump("high");
  }

  if (factors.length === 0) {
    factors.push("후보·거버넌스·Overlay planning 포화는 낮게 유지됩니다(실제 enforcement 없음).");
  }

  return {
    mode: "candidate_saturation_summary",
    actualRuntimeEnforcementEnabled: false,
    saturationLevel: level,
    factorNotesKo: factors.slice(0, 10),
    estimatedCandidateCount: candidateCount,
    estimatedPlanningBlockCount: planningBlocks,
  };
}

export function serializeCandidateSaturationSummaryForDiagnostic(
  summary: CandidateSaturationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeEnforcementEnabled: summary.actualRuntimeEnforcementEnabled,
    saturationLevel: summary.saturationLevel,
    factorNotesKo: [...summary.factorNotesKo],
    estimatedCandidateCount: summary.estimatedCandidateCount,
    estimatedPlanningBlockCount: summary.estimatedPlanningBlockCount,
  };
}

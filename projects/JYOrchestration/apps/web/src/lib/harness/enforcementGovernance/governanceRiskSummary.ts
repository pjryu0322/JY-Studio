/**
 * H11.5 — **governance** 위험 요약(read-only). enforcement risk(H11)와 별도.
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeEnforcementCandidateReport } from "@/lib/harness/runtimeEnforcement/runtimeEnforcementCandidateTypes";
import type { GovernanceRiskSummary, GovernanceRiskSummaryLevel } from "./controlledEnforcementGovernanceTypes";

export function buildGovernanceRiskSummary(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly candidateReport: RuntimeEnforcementCandidateReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): GovernanceRiskSummary {
  const pressure = evaluateResourcePressure(input.extract);
  const { governance, rollbackSafety } = input.governanceCtx;
  const factors: string[] = [];

  let level: GovernanceRiskSummaryLevel = "stable";
  const bump = (next: GovernanceRiskSummaryLevel) => {
    const order: GovernanceRiskSummaryLevel[] = ["stable", "watch", "elevated", "high"];
    if (order.indexOf(next) > order.indexOf(level)) level = next;
  };

  if (governance.governanceRisk === "high") {
    factors.push("거버넌스 불안정 신호가 높습니다.");
    bump("elevated");
  } else if (governance.governanceRisk === "medium") {
    factors.push("거버넌스 중간 리스크입니다.");
    bump("watch");
  }

  if (rollbackSafety.rollbackRisk === "high") {
    factors.push("롤백 안전 메타가 ‘높음’으로 분류되었습니다.");
    bump("elevated");
  } else if (rollbackSafety.rollbackRisk === "watch") {
    factors.push("롤백 경로를 주시 단계로 유지하세요.");
    bump("watch");
  }

  if (governance.auditabilityLevel === "none") {
    factors.push("감사 가능성 계획이 최소 수준입니다.");
    bump("watch");
  }

  if (!input.messageExplainabilityAvailable || !input.baseline.userVisibleSummaryReady) {
    factors.push("Explainability·사용자 요약 경로 불안정.");
    bump("watch");
  }

  if (input.overlayWarningCount >= 6) {
    factors.push("Overlay 경고가 많아 운영 과부하 가능.");
    bump("watch");
  }

  if (pressure.pressureSeverity === "critical" || pressure.pressureSeverity === "high") {
    factors.push("자원 압력이 높아 governance 기반 후보 판단 신뢰가 떨어집니다.");
    bump(pressure.pressureSeverity === "critical" ? "high" : "elevated");
  }

  if (!input.candidateReport.candidateEligible) {
    factors.push("H11 enforcement 후보가 비적격입니다.");
    bump("watch");
  }

  if (factors.length === 0) {
    factors.push("관측 범위에서 governance 기반 후보 위험은 낮게 유지됩니다(실제 적용 없음).");
  }

  return {
    mode: "governance_risk_summary",
    governanceRiskLevel: level,
    factorNotesKo: factors.slice(0, 10),
  };
}

export function serializeGovernanceRiskSummaryForDiagnostic(
  summary: GovernanceRiskSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    governanceRiskLevel: summary.governanceRiskLevel,
    factorNotesKo: [...summary.factorNotesKo],
  };
}

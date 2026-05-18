/**
 * H11 — enforcement **위험 요약**(read-only). 실제 차단 없음.
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { EnforcementRiskSummaryLevel, RuntimeEnforcementRiskSummary } from "./runtimeEnforcementCandidateTypes";

export function buildRuntimeEnforcementRiskSummary(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
}): RuntimeEnforcementRiskSummary {
  const pressure = evaluateResourcePressure(input.extract);
  const { governance, rollbackSafety } = input.governanceCtx;
  const factors: string[] = [];

  let level: EnforcementRiskSummaryLevel = "stable";

  const bump = (next: EnforcementRiskSummaryLevel) => {
    const order: EnforcementRiskSummaryLevel[] = ["stable", "watch", "elevated", "high"];
    if (order.indexOf(next) > order.indexOf(level)) level = next;
  };

  if (governance.governanceRisk === "high") {
    factors.push("거버넌스 불안정 신호가 높습니다.");
    bump("elevated");
  } else if (governance.governanceRisk === "medium") {
    factors.push("거버넌스 중간 리스크입니다.");
    bump("watch");
  }

  if (!input.messageExplainabilityAvailable || !input.baseline.userVisibleSummaryReady) {
    factors.push("Explainability·사용자 요약 경로가 불안정하면 enforcement 후보 판단 신뢰가 떨어집니다.");
    bump("watch");
  }

  if (input.overlayWarningCount >= 6) {
    factors.push("Overlay 정책 경고가 다수입니다(과밀·설정 드리프트 가능).");
    bump("watch");
  }

  if (pressure.pressureSeverity === "critical" || pressure.pressureSeverity === "high") {
    factors.push("자원 압력이 높아 enforcement 후보 적용 전 완화가 필요합니다.");
    bump(pressure.pressureSeverity === "critical" ? "high" : "elevated");
  } else if (pressure.pressureSeverity === "elevated") {
    factors.push("자원 압력이 다소 상승했습니다.");
    bump("watch");
  }

  if (rollbackSafety.rollbackRisk === "high") {
    factors.push("롤백 안전 메타가 ‘높음’ 위험으로 분류되었습니다.");
    bump("elevated");
  } else if (rollbackSafety.rollbackRisk === "watch") {
    factors.push("롤백 경로를 주시 단계로 유지하세요.");
    bump("watch");
  }

  if (factors.length === 0) {
    factors.push("관측 범위에서 enforcement 후보 위험은 낮게 유지됩니다(여전히 실제 적용 없음).");
  }

  return {
    mode: "runtime_enforcement_risk_summary",
    enforcementRiskLevel: level,
    factorNotesKo: factors.slice(0, 10),
  };
}

export function serializeRuntimeEnforcementRiskSummaryForDiagnostic(
  summary: RuntimeEnforcementRiskSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    enforcementRiskLevel: summary.enforcementRiskLevel,
    factorNotesKo: [...summary.factorNotesKo],
  };
}

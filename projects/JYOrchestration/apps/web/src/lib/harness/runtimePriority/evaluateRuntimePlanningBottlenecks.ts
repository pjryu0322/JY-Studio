/**
 * H12.5 — runtime planning **병목** 분석(read-only).
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeEscalationSummary } from "./runtimePriorityTypes";
import type {
  RuntimePlanningBottleneckKind,
  RuntimePlanningBottleneckRow,
  RuntimePlanningBottleneckSummary,
  RuntimePlanningPriority,
} from "./runtimePriorityTypes";

function bottleneck(
  kind: RuntimePlanningBottleneckKind,
  labelKo: string,
  priority: RuntimePlanningPriority,
  noteKo: string
): RuntimePlanningBottleneckRow {
  return { kind, labelKo, priority, noteKo };
}

export function evaluateRuntimePlanningBottlenecks(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly escalationSummary: RuntimeEscalationSummary;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): RuntimePlanningBottleneckSummary {
  const pressure = evaluateResourcePressure(input.extract);
  const bottlenecks: RuntimePlanningBottleneckRow[] = [];

  if (input.governanceCtx.governance.governanceRisk !== "low") {
    bottlenecks.push(
      bottleneck(
        "governance",
        "거버넌스 병목",
        input.governanceCtx.governance.governanceRisk === "high" ? "critical" : "high",
        `거버넌스 리스크 ${input.governanceCtx.governance.governanceRisk}.`
      )
    );
  }

  const reviewBlocks =
    (input.extract?.reviewSecurityHarnessPlan?.findings?.length ?? 0) +
    (input.extract?.remediationLoopPlan?.steps?.length ?? 0);
  if (reviewBlocks >= 8) {
    bottlenecks.push(
      bottleneck(
        "review_security",
        "Review/Security 병목",
        reviewBlocks >= 12 ? "critical" : "high",
        `Planning 블록 ${reviewBlocks}건.`
      )
    );
  }

  if (!input.messageExplainabilityAvailable || !input.baseline.userVisibleSummaryReady) {
    bottlenecks.push(
      bottleneck(
        "explainability",
        "Explainability 병목",
        "high",
        "사용자 explainability·요약 경로 불안정."
      )
    );
  }

  if (input.stabilityReports.overlayOverload.overlayOverloadRisk !== "low") {
    bottlenecks.push(
      bottleneck(
        "overlay",
        "Overlay 병목",
        input.stabilityReports.overlayOverload.overlayOverloadRisk === "high" ? "critical" : "medium",
        `과밀 위험 ${input.stabilityReports.overlayOverload.overlayOverloadRisk}.`
      )
    );
  }

  if (pressure.pressureSeverity === "high" || pressure.pressureSeverity === "critical") {
    bottlenecks.push(
      bottleneck(
        "resource",
        "자원 병목",
        pressure.pressureSeverity === "critical" ? "critical" : "high",
        `자원 압력 ${pressure.pressureSeverity}.`
      )
    );
  }

  let overallPlanningPriority: RuntimePlanningPriority = "low";
  const order: RuntimePlanningPriority[] = ["low", "medium", "high", "critical"];
  for (const b of bottlenecks) {
    if (order.indexOf(b.priority) > order.indexOf(overallPlanningPriority)) {
      overallPlanningPriority = b.priority;
    }
  }
  if (input.escalationSummary.escalationLevel === "critical") overallPlanningPriority = "critical";
  else if (
    input.escalationSummary.escalationLevel === "escalated" &&
    order.indexOf(overallPlanningPriority) < order.indexOf("high")
  ) {
    overallPlanningPriority = "high";
  }

  const recommendations: string[] = [
    "H12.5 bottleneck은 planning ordering 힌트만 제공합니다. 실제 orchestration 없음.",
    "병목이 critical이면 H10–H11.5 세부 섹션을 접고 H12·H12.5 요약만 우선 확인하세요.",
  ];
  if (bottlenecks.length === 0) {
    recommendations.unshift("관측 범위에서 planning 병목은 낮게 유지됩니다.");
  }

  return {
    mode: "runtime_planning_bottleneck_summary",
    actualRuntimeOrchestrationEnabled: false,
    overallPlanningPriority,
    bottlenecks: bottlenecks.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningBottleneckSummaryForDiagnostic(
  summary: RuntimePlanningBottleneckSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    overallPlanningPriority: summary.overallPlanningPriority,
    bottlenecks: summary.bottlenecks.map((b) => ({
      kind: b.kind,
      labelKo: b.labelKo,
      priority: b.priority,
      noteKo: b.noteKo,
    })),
    recommendations: [...summary.recommendations],
  };
}

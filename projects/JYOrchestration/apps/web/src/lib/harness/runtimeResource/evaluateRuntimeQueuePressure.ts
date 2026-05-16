/**
 * H20.5 — **Queue pressure** 해석(read-only; escalation·semantic·reasoning 신호만 참조).
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeQueuePressure, RuntimeResourcePressure } from "./runtimeResourceTypes";

export function evaluateRuntimeQueuePressure(
  reports: RuntimeSemanticPlanningReportsBeforeResource,
  pressures: readonly RuntimeResourcePressure[]
): RuntimeQueuePressure {
  const q = pressures.find((x) => x.kind === "queue_overload");
  const escalationHeavy = reports.runtimeForecastEscalation.chains.some(
    (c) => c.includes("saturation") || c.includes("overload")
  );
  const semanticHeavy = reports.semanticExplosionRiskSummary.explosionRisk !== "low";
  const reasoningHeavy = reports.compressedReasoningTrace.compressedItemCount > 14;

  let amplificationLevel: RuntimeQueuePressure["amplificationLevel"] = "low";
  if (q && (q.severity === "high" || q.severity === "critical_candidate")) amplificationLevel = "high";
  else if (q && q.severity === "medium") amplificationLevel = "medium";
  else if (escalationHeavy && (semanticHeavy || reasoningHeavy)) amplificationLevel = "medium";

  const summaryKo = [
    `queue overload pressure=${q?.severity ?? "low"}`,
    escalationHeavy ? "escalation chain에 saturation·overload 언급" : "escalation queue 신호 제한적",
    semanticHeavy ? "semantic expansion pressure" : "semantic expansion 안정",
    reasoningHeavy ? "reasoning trace depth 증가" : "reasoning recursion pressure 낮음",
  ].join(" · ");

  return {
    mode: "runtime_queue_pressure",
    actualRuntimeOrchestrationEnabled: false,
    amplificationLevel,
    summaryKo,
  };
}

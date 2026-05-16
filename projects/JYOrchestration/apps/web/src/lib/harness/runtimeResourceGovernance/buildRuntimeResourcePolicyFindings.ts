/**
 * H21 — resource 관련 **정책 finding**(read-only; 기존 resource·decision·forecast 신호만 사용).
 */

import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";
import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import type { RuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import type { RuntimeResourcePolicyFinding, RuntimeResourcePolicyFindingKind } from "./runtimeResourceGovernanceTypes";

function finding(
  kind: RuntimeResourcePolicyFindingKind,
  labelKo: string,
  messageKo: string
): RuntimeResourcePolicyFinding {
  return { kind, labelKo, messageKo };
}

export function buildRuntimeResourcePolicyFindings(input: {
  readonly resource: RuntimeResourcePlanningReports;
  readonly decision: RuntimeDecisionPlanningReports;
  readonly forecast: RuntimeForecastPlanningReports;
}): readonly RuntimeResourcePolicyFinding[] {
  const { resource, decision, forecast } = input;
  const out: RuntimeResourcePolicyFinding[] = [];

  if (
    resource.runtimeResourceSummary.providerPressure.severity === "high" ||
    resource.runtimeResourceSummary.providerPressure.severity === "critical_candidate"
  ) {
    out.push(
      finding(
        "provider_saturation_candidate",
        "Provider saturation 후보",
        `provider pressure=${resource.runtimeResourceSummary.providerPressure.severity}`
      )
    );
  }

  if (resource.runtimeResourceSummary.queuePressureInsight.amplificationLevel !== "low") {
    out.push(
      finding(
        "queue_amplification_risk",
        "Queue amplification risk",
        resource.runtimeResourceSummary.queuePressureInsight.summaryKo
      )
    );
  }

  if (resource.runtimeResourceSummary.bottleneckPropagation.propagationSeverity !== "low") {
    out.push(
      finding(
        "bottleneck_propagation_risk",
        "Bottleneck propagation risk",
        resource.runtimeResourceSummary.bottleneckPropagation.bottleneckChainKo
      )
    );
  }

  const saturatedMembers = resource.runtimeMemberWorkload.members.filter(
    (m) => m.workloadLevel === "saturated" || m.workloadLevel === "elevated"
  );
  if (saturatedMembers.length > 0) {
    out.push(
      finding(
        "member_workload_imbalance",
        "Member workload imbalance",
        `${saturatedMembers.length}명 elevated/saturated — ${resource.runtimeMemberWorkload.imbalanceNoteKo}`
      )
    );
  }

  if (
    resource.runtimeResourceCapacity.outlook === "strained" ||
    resource.runtimeResourceCapacity.outlook === "exhaustion_candidate"
  ) {
    out.push(
      finding(
        "capacity_exhaustion_candidate",
        "Capacity exhaustion 후보",
        `capacity outlook=${resource.runtimeResourceCapacity.outlook}`
      )
    );
  }

  if (
    decision.runtimeDecisionCoherence.overallLevel === "divergent" ||
    forecast.runtimeForecastStability.outlook === "degrading" ||
    forecast.runtimeForecastStability.outlook === "critical_candidate"
  ) {
    out.push(
      finding(
        "decision_forecast_governance_link",
        "Decision·forecast governance link",
        `coherence=${decision.runtimeDecisionCoherence.overallLevel} · forecast stability=${forecast.runtimeForecastStability.outlook}`
      )
    );
  }

  return [...out].sort((a, b) => a.kind.localeCompare(b.kind));
}

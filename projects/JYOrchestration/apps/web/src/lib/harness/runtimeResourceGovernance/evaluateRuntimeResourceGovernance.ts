/**
 * H21 — resource pressure를 **governance risk·운영 정책**으로 해석(read-only).
 */

import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";
import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import type { RuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import type {
  RuntimeResourceAllocationReadiness,
  RuntimeResourceGovernanceMode,
  RuntimeResourceGovernanceRisk,
  RuntimeResourceGovernanceSummary,
  RuntimeResourceOperatorReviewRequirement,
  RuntimeResourcePolicyFinding,
  RuntimeResourcePolicyViolationCandidate,
  RuntimeResourcePolicyViolationRisk,
} from "./runtimeResourceGovernanceTypes";

const RISK_RANK: Record<RuntimeResourceGovernanceRisk, number> = {
  stable: 0,
  watch: 1,
  elevated: 2,
  critical_candidate: 3,
};

function maxRisk(
  a: RuntimeResourceGovernanceRisk,
  b: RuntimeResourceGovernanceRisk
): RuntimeResourceGovernanceRisk {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

export function evaluateRuntimeResourceGovernance(input: {
  readonly resource: RuntimeResourcePlanningReports;
  readonly decision: RuntimeDecisionPlanningReports;
  readonly forecast: RuntimeForecastPlanningReports;
  readonly policyFindings: readonly RuntimeResourcePolicyFinding[];
}): RuntimeResourceGovernanceSummary {
  const { resource, decision, forecast, policyFindings } = input;
  const prov = resource.runtimeResourceSummary.providerPressure.severity;
  const queueAmp = resource.runtimeResourceSummary.queuePressureInsight.amplificationLevel;
  const bottleneckSev = resource.runtimeResourceSummary.bottleneckPropagation.propagationSeverity;
  const capOutlook = resource.runtimeResourceCapacity.outlook;
  const saturatedMembers = resource.runtimeMemberWorkload.members.filter(
    (m) => m.workloadLevel === "saturated" || m.workloadLevel === "elevated"
  );
  const coherence = decision.runtimeDecisionCoherence.overallLevel;
  const stabilityOutlook = forecast.runtimeForecastStability.outlook;

  let governanceRisk: RuntimeResourceGovernanceRisk = "stable";
  if (bottleneckSev === "critical_candidate" || prov === "critical_candidate") {
    governanceRisk = "critical_candidate";
  } else if (prov === "high" || queueAmp === "high" || saturatedMembers.length >= 2) {
    governanceRisk = "elevated";
  } else if (
    prov === "medium" ||
    queueAmp === "medium" ||
    bottleneckSev === "high" ||
    saturatedMembers.length === 1
  ) {
    governanceRisk = "watch";
  }

  if (capOutlook === "exhaustion_candidate") {
    governanceRisk = maxRisk(governanceRisk, "elevated");
  } else if (capOutlook === "strained") {
    governanceRisk = maxRisk(governanceRisk, "watch");
  }

  if (coherence === "divergent") {
    governanceRisk = maxRisk(governanceRisk, "elevated");
  }

  if (stabilityOutlook === "critical_candidate") {
    governanceRisk = maxRisk(governanceRisk, "critical_candidate");
  } else if (stabilityOutlook === "degrading") {
    governanceRisk = maxRisk(governanceRisk, "elevated");
  } else if (stabilityOutlook === "watch") {
    governanceRisk = maxRisk(governanceRisk, "watch");
  }

  let operatorReviewRequirement: RuntimeResourceOperatorReviewRequirement = "not_required";
  if (governanceRisk === "critical_candidate" || bottleneckSev === "critical_candidate") {
    operatorReviewRequirement = "required";
  } else if (governanceRisk === "elevated" || prov === "high" || queueAmp === "high") {
    operatorReviewRequirement = "recommended";
  } else if (governanceRisk === "watch" && policyFindings.length > 0) {
    operatorReviewRequirement = "recommended";
  }

  const controlBlocked =
    bottleneckSev === "critical_candidate" || governanceRisk === "critical_candidate";

  let governanceMode: RuntimeResourceGovernanceMode = "observe_only";
  if (controlBlocked) {
    governanceMode = "control_not_allowed";
  } else if (
    saturatedMembers.some((m) => m.workloadLevel === "saturated") &&
    governanceRisk === "elevated"
  ) {
    governanceMode = "trial_candidate";
  } else if (governanceRisk === "elevated" || governanceRisk === "watch" || policyFindings.length > 0) {
    governanceMode = "planning_only";
  }

  let allocationReadiness: RuntimeResourceAllocationReadiness = "planning_metadata_only";
  if (controlBlocked) {
    allocationReadiness = "trial_signal_blocked";
  } else if (saturatedMembers.some((m) => m.workloadLevel === "saturated")) {
    allocationReadiness = "allocation_planning_candidate";
  } else if (governanceRisk === "stable" && policyFindings.length === 0) {
    allocationReadiness = "not_ready";
  }

  let violationRisk: RuntimeResourcePolicyViolationRisk = "none";
  if (governanceRisk === "critical_candidate") violationRisk = "high";
  else if (governanceRisk === "elevated") violationRisk = "medium";
  else if (governanceRisk === "watch") violationRisk = "low";

  const policyViolationCandidate: RuntimeResourcePolicyViolationCandidate = {
    mode: "runtime_resource_policy_violation_candidate",
    actualRuntimeOrchestrationEnabled: false,
    risk: violationRisk,
    summaryKo:
      violationRisk === "high"
        ? "policy violation 후보 높음 — operator review·planning_only 유지"
        : violationRisk === "medium"
          ? "policy violation 후보 중간 — governance drift·resource pressure 병행"
          : violationRisk === "low"
            ? "policy violation 후보 낮음 — 관측 범위"
            : "policy violation 신호 없음",
  };

  const policyFindingStrings = policyFindings.map((f) => `${f.labelKo}: ${f.messageKo}`);

  const recommendations: string[] = [];
  if (operatorReviewRequirement === "required") {
    recommendations.push("operator review 필요(메타) — provider·bottleneck 임계 신호");
  } else if (operatorReviewRequirement === "recommended") {
    recommendations.push("operator review 권장(메타) — queue·provider·forecast 연계");
  }
  if (allocationReadiness === "allocation_planning_candidate") {
    recommendations.push("allocation planning 후보만 표시 — 실제 allocation 없음");
  }
  if (governanceMode === "trial_candidate") {
    recommendations.push("runtime trial 후보 신호 — governance·forecast 확인 후 단계 전환(실행 없음)");
  }
  if (governanceMode === "control_not_allowed") {
    recommendations.push("control 경로 비허용(메타) — trial·routing 자동화 없음");
  }
  if (coherence === "divergent") {
    recommendations.push("decision coherence divergent — decision lineage와 resource pressure 정합 재검토(메타)");
  }

  const sortedRecs = [...new Set(recommendations)].sort((a, b) => a.localeCompare(b));

  return {
    mode: "runtime_resource_governance_summary",
    actualRuntimeOrchestrationEnabled: false,
    governanceMode,
    governanceRisk,
    operatorReviewRequirement,
    allocationReadiness,
    policyViolationCandidate,
    policyFindings: policyFindingStrings,
    recommendations: sortedRecs,
  };
}

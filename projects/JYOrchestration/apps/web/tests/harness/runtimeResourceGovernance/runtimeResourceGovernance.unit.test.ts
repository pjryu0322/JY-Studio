import { describe, expect, it } from "vitest";

import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";
import { buildRuntimeResourceGovernancePlanningReports } from "@/lib/harness/runtimeResourceGovernance/buildRuntimeResourceGovernancePlanningReports";
import { evaluateRuntimeResourceGovernance } from "@/lib/harness/runtimeResourceGovernance/evaluateRuntimeResourceGovernance";
import { buildRuntimeResourcePolicyFindings } from "@/lib/harness/runtimeResourceGovernance/buildRuntimeResourcePolicyFindings";
import { serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResourceGovernance/serializeRuntimeResourceGovernanceDiagnosticBundle";
import type { RuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";

describe("H21 runtime resource governance", () => {
  it("builds governance reports from semantic without recomputing resource fields", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const { runtimeResourceGovernanceSummary, runtimeResourcePolicyFindings, runtimeResourceControlBoundary } =
      buildRuntimeResourceGovernancePlanningReports(semantic);
    expect(runtimeResourceGovernanceSummary.mode).toBe("runtime_resource_governance_summary");
    expect(runtimeResourceGovernanceSummary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(runtimeResourceControlBoundary.boundary).toBe(runtimeResourceGovernanceSummary.governanceMode);
    expect(Array.isArray(runtimeResourcePolicyFindings)).toBe(true);
  });

  it("serializes governance bundle without rebuilding reports", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const a = serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports(semantic);
    const b = serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports(semantic);
    expect(a).toEqual(b);
    expect(Object.keys(a).sort()).toEqual(
      ["runtimeResourceControlBoundary", "runtimeResourceGovernanceSummary", "runtimeResourcePolicyFindings"].sort()
    );
  });

  it("elevates governance risk when provider pressure is high", () => {
    const base = minimalResource();
    const resource: RuntimeResourcePlanningReports = {
      ...base,
      runtimeResourceSummary: {
        ...base.runtimeResourceSummary,
        providerPressure: {
          mode: "runtime_provider_pressure",
          actualRuntimeOrchestrationEnabled: false,
          severity: "high",
          summaryKo: "test",
        },
      },
    };
    const decision = minimalDecision();
    const forecast = minimalForecast();
    const findings = buildRuntimeResourcePolicyFindings({ resource, decision, forecast });
    const g = evaluateRuntimeResourceGovernance({ resource, decision, forecast, policyFindings: findings });
    expect(g.governanceRisk).toBe("elevated");
    expect(g.operatorReviewRequirement).toBe("recommended");
  });

  it("marks allocation planning candidate when member workload is saturated", () => {
    const base = minimalResource();
    const resource: RuntimeResourcePlanningReports = {
      ...base,
      runtimeMemberWorkload: {
        ...base.runtimeMemberWorkload,
        members: [
          {
            memberId: "planner",
            labelKo: "Planner",
            workloadLevel: "saturated",
            saturationRisk: "high",
            noteKo: "heavy",
          },
        ],
      },
    };
    const decision = minimalDecision();
    const forecast = minimalForecast();
    const findings = buildRuntimeResourcePolicyFindings({ resource, decision, forecast });
    const g = evaluateRuntimeResourceGovernance({ resource, decision, forecast, policyFindings: findings });
    expect(g.allocationReadiness).toBe("allocation_planning_candidate");
  });

  it("sets control_not_allowed when bottleneck propagation is critical_candidate", () => {
    const base = minimalResource();
    const resource: RuntimeResourcePlanningReports = {
      ...base,
      runtimeResourceSummary: {
        ...base.runtimeResourceSummary,
        bottleneckPropagation: {
          mode: "runtime_bottleneck_propagation",
          actualRuntimeOrchestrationEnabled: false,
          propagationSeverity: "critical_candidate",
          bottleneckChainKo: "critical",
          slowdownRiskKo: "high",
        },
      },
    };
    const decision = minimalDecision();
    const forecast = minimalForecast();
    const findings = buildRuntimeResourcePolicyFindings({ resource, decision, forecast });
    const g = evaluateRuntimeResourceGovernance({ resource, decision, forecast, policyFindings: findings });
    expect(g.governanceMode).toBe("control_not_allowed");
    expect(g.allocationReadiness).toBe("trial_signal_blocked");
  });
});

function minimalResource(): RuntimeResourcePlanningReports {
  return {
    runtimeResourceSummary: {
      mode: "runtime_resource_summary",
      actualRuntimeOrchestrationEnabled: false,
      pressures: [],
      overloadSummaryKo: "ok",
      primaryPressureKo: "ok",
      saturation: {
        mode: "runtime_resource_saturation",
        actualRuntimeOrchestrationEnabled: false,
        providerSaturationLevel: "low",
        queueSaturationLevel: "low",
        primarySaturationKo: "low",
      },
      queue: {
        mode: "runtime_resource_queue",
        actualRuntimeOrchestrationEnabled: false,
        queueDepthLabel: "normal",
        overloadRiskKo: "low",
      },
      providerPressure: {
        mode: "runtime_provider_pressure",
        actualRuntimeOrchestrationEnabled: false,
        severity: "low",
        summaryKo: "low",
      },
      queuePressureInsight: {
        mode: "runtime_queue_pressure",
        actualRuntimeOrchestrationEnabled: false,
        amplificationLevel: "low",
        summaryKo: "low",
      },
      bottleneckPropagation: {
        mode: "runtime_bottleneck_propagation",
        actualRuntimeOrchestrationEnabled: false,
        propagationSeverity: "low",
        bottleneckChainKo: "low",
        slowdownRiskKo: "low",
      },
    },
    runtimeResourceForecast: {
      mode: "runtime_resource_forecast",
      actualRuntimeOrchestrationEnabled: false,
      predictions: [],
      primaryPredictionKo: "stable",
    },
    runtimeResourceCapacity: {
      mode: "runtime_resource_capacity",
      actualRuntimeOrchestrationEnabled: false,
      outlook: "comfortable",
      bottleneckLabelKo: "none",
      findings: [],
    },
    runtimeMemberWorkload: {
      mode: "runtime_member_workload",
      actualRuntimeOrchestrationEnabled: false,
      members: [
        {
          memberId: "planner",
          labelKo: "Planner",
          workloadLevel: "balanced",
          saturationRisk: "low",
          noteKo: "ok",
        },
      ],
      imbalanceNoteKo: "balanced",
      primaryOverloadKo: "balanced",
    },
    runtimeResourceExplainability: {
      mode: "runtime_resource_explainability",
      actualRuntimeOrchestrationEnabled: false,
      causalChainKo: "chain",
      findings: [],
    },
  };
}

function minimalDecision(): RuntimeDecisionPlanningReports {
  return {
    runtimeDecisionLineage: {
      mode: "runtime_decision_lineage",
      actualRuntimeOrchestrationEnabled: false,
      nodes: [],
      edges: [],
      lineagePaths: [],
      primaryReason: null,
      recommendations: [],
    },
    runtimeDecisionSnapshot: {
      mode: "runtime_decision_snapshot",
      actualRuntimeOrchestrationEnabled: false,
      snapshotId: "s",
      capturedAtLabel: "t",
      topPriorityLabel: "p",
      criticalPathLabel: "c",
      coherenceLevel: "aligned",
      summaryKo: "ok",
    },
    runtimeRecommendationSummary: {
      mode: "runtime_recommendation_summary",
      actualRuntimeOrchestrationEnabled: false,
      recommendations: [],
      primaryRecommendationKo: "ok",
      routingImplicationKo: "ok",
    },
    runtimeDecisionCoherence: {
      mode: "runtime_decision_coherence",
      actualRuntimeOrchestrationEnabled: false,
      overallLevel: "aligned",
      dimensions: [],
      findings: [],
      recommendations: [],
    },
  };
}

function minimalForecast(): RuntimeForecastPlanningReports {
  return {
    runtimeForecastSummary: {
      mode: "runtime_forecast_summary",
      actualRuntimeOrchestrationEnabled: false,
      trends: [],
      topRisks: [],
      snapshot: {
        snapshotId: "f",
        capturedAtLabel: "t",
        topRiskLabelKo: "r",
        saturationRiskKo: "s",
        stabilityOutlook: "stable",
        summaryKo: "ok",
      },
      primaryForecastKo: "ok",
      orchestrationSaturationRiskKo: "ok",
    },
    runtimeForecastEscalation: {
      mode: "runtime_forecast_escalation",
      actualRuntimeOrchestrationEnabled: false,
      chains: [],
      primaryChainKo: "ok",
      highRiskFirst: [],
    },
    runtimeForecastGovernanceDrift: {
      mode: "runtime_forecast_governance_drift",
      actualRuntimeOrchestrationEnabled: false,
      drifts: [],
      primaryDriftKo: "ok",
    },
    runtimeForecastStability: {
      mode: "runtime_forecast_stability",
      actualRuntimeOrchestrationEnabled: false,
      outlook: "stable",
      longitudinalNoteKo: "ok",
      coherenceDriftRiskKo: "ok",
      findings: [],
    },
  };
}

import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeSemanticGroups } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticGroups";
import { compressRuntimeReasoningTrace } from "@/lib/harness/runtimeSemantic/compressRuntimeReasoningTrace";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { serializeRuntimeSemanticDiagnosticBundleFromContext } from "@/lib/harness/runtimeSemantic/serializeRuntimeSemanticDiagnosticBundle";

describe("H17 runtime semantic compression", () => {
  it("builds semantic groups and compressed trace from reasoning reports", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const ctx = normalizeRuntimePlanningContext({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
    const groups = buildRuntimeSemanticGroups(reasoning);
    const compressed = compressRuntimeReasoningTrace(reasoning);
    expect(groups.mode).toBe("runtime_semantic_groups_summary");
    expect(groups.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(groups.groups.length).toBeGreaterThan(0);
    expect(compressed.mode).toBe("compressed_runtime_reasoning_trace");
    expect(compressed.compressedLines.length).toBeGreaterThan(0);
  });

  it("serializes H17–H21.5 diagnostic fields including allocation planning", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const ctx = normalizeRuntimePlanningContext({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const b = serializeRuntimeSemanticDiagnosticBundleFromContext(ctx);
    const groups = b.runtimeSemanticGroups as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const compressed = b.compressedRuntimeReasoningTrace as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    const redundancy = b.runtimeSemanticRedundancySummary as {
      mode?: string;
      compressionApplied?: boolean;
    };
    const ordering = b.stabilizedRuntimeSemanticOrdering as { mode?: string };
    const quality = b.runtimeSemanticCompressionQualityReport as {
      mode?: string;
      quality?: string;
    };
    const hidden = b.runtimeHiddenSemanticTraceAudit as { mode?: string };
    const balance = b.runtimeSemanticGroupBalanceSummary as { mode?: string };
    expect(groups.mode).toBe("runtime_semantic_groups_summary");
    expect(groups.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(compressed.mode).toBe("compressed_runtime_reasoning_trace");
    expect(compressed.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(redundancy.mode).toBe("runtime_semantic_redundancy_summary");
    expect(redundancy.compressionApplied).toBe(true);
    expect(ordering.mode).toBe("stabilized_runtime_semantic_ordering");
    expect(quality.mode).toBe("runtime_semantic_compression_quality");
    expect(quality.quality).toBeTruthy();
    expect(hidden.mode).toBe("runtime_hidden_semantic_trace_audit");
    expect(balance.mode).toBe("runtime_semantic_group_balance_summary");
    const graph = b.runtimeSemanticExplainabilityGraph as { mode?: string };
    const origins = b.runtimeSemanticWarningOriginSummary as { mode?: string };
    const explosion = b.runtimeSemanticExplosionRiskSummary as { mode?: string; explosionRisk?: string };
    expect(graph.mode).toBe("runtime_semantic_explainability_graph");
    expect(origins.mode).toBe("runtime_semantic_warning_origin_summary");
    expect(explosion.mode).toBe("runtime_semantic_explosion_risk_summary");
    expect(explosion.explosionRisk).toBeTruthy();
    const narrative = b.runtimeSemanticNarrativeSummary as { mode?: string };
    const rootCauses = b.runtimeSemanticRootCauseGroups as { mode?: string };
    const relevance = b.runtimeSemanticGraphRelevanceSummary as { mode?: string };
    expect(narrative.mode).toBe("runtime_semantic_narrative_summary");
    expect(rootCauses.mode).toBe("runtime_semantic_root_cause_groups");
    expect(relevance.mode).toBe("runtime_semantic_graph_relevance_summary");
    const vocabulary = b.runtimeSemanticVocabularySummary as { mode?: string };
    const normalized = b.runtimeSemanticNormalizedLabels as { mode?: string };
    const priority = b.runtimeSemanticPriorityVocabulary as { mode?: string };
    expect(vocabulary.mode).toBe("runtime_semantic_vocabulary_summary");
    expect(normalized.mode).toBe("runtime_semantic_normalized_labels");
    expect(priority.mode).toBe("runtime_semantic_priority_vocabulary");
    const lineage = b.runtimeDecisionLineage as { mode?: string };
    const snapshot = b.runtimeDecisionSnapshot as { mode?: string };
    const recommendation = b.runtimeRecommendationSummary as { mode?: string };
    const coherence = b.runtimeDecisionCoherence as { mode?: string };
    expect(lineage.mode).toBe("runtime_decision_lineage");
    expect(snapshot.mode).toBe("runtime_decision_snapshot");
    expect(recommendation.mode).toBe("runtime_recommendation_summary");
    expect(coherence.mode).toBe("runtime_decision_coherence");
    const forecastSummary = b.runtimeForecastSummary as { mode?: string };
    const forecastEscalation = b.runtimeForecastEscalation as { mode?: string };
    const forecastDrift = b.runtimeForecastGovernanceDrift as { mode?: string };
    const forecastStability = b.runtimeForecastStability as { mode?: string };
    expect(forecastSummary.mode).toBe("runtime_forecast_summary");
    expect(forecastEscalation.mode).toBe("runtime_forecast_escalation");
    expect(forecastDrift.mode).toBe("runtime_forecast_governance_drift");
    expect(forecastStability.mode).toBe("runtime_forecast_stability");
    const resourceSummary = b.runtimeResourceSummary as { mode?: string };
    const resourceForecast = b.runtimeResourceForecast as { mode?: string };
    const resourceCapacity = b.runtimeResourceCapacity as { mode?: string };
    const memberWorkload = b.runtimeMemberWorkload as { mode?: string };
    const resourceExplainability = b.runtimeResourceExplainability as { mode?: string };
    const govSummary = b.runtimeResourceGovernanceSummary as { mode?: string };
    const govFindings = b.runtimeResourcePolicyFindings as unknown[];
    const govBoundary = b.runtimeResourceControlBoundary as { mode?: string };
    expect(resourceSummary.mode).toBe("runtime_resource_summary");
    expect(resourceForecast.mode).toBe("runtime_resource_forecast");
    expect(resourceCapacity.mode).toBe("runtime_resource_capacity");
    expect(memberWorkload.mode).toBe("runtime_member_workload");
    expect(resourceExplainability.mode).toBe("runtime_resource_explainability");
    expect(govSummary.mode).toBe("runtime_resource_governance_summary");
    expect(Array.isArray(govFindings)).toBe(true);
    expect(govBoundary.mode).toBe("runtime_resource_control_boundary");
    const allocPlan = b.runtimeResourceAllocationPlan as { mode?: string; actualResourceAllocationEnabled?: boolean };
    const allocElig = b.runtimeAllocationEligibilitySummary as { mode?: string };
    const allocProv = b.runtimeProviderSlotPlan as { mode?: string };
    const allocExec = b.runtimeExecutionSlotPlan as { mode?: string };
    expect(allocPlan.mode).toBe("runtime_resource_allocation_plan");
    expect(allocPlan.actualResourceAllocationEnabled).toBe(false);
    expect(allocElig.mode).toBe("runtime_allocation_eligibility_summary");
    expect(allocProv.mode).toBe("runtime_provider_slot_plan");
    expect(allocExec.mode).toBe("runtime_execution_slot_plan");
  });
});

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
    const trialReport = b.runtimeResourceAllocationTrialReport as {
      mode?: string;
      actualTrialExecutionEnabled?: boolean;
    };
    const trialFc = b.runtimeAllocationForecastComparison as { mode?: string; actualTrialExecutionEnabled?: boolean };
    const trialGc = b.runtimeAllocationGovernanceComparison as { mode?: string; actualTrialExecutionEnabled?: boolean };
    const trialDrift = b.runtimeAllocationTrialDriftSummary as { mode?: string; actualTrialExecutionEnabled?: boolean };
    expect(trialReport.mode).toBe("runtime_resource_allocation_trial_report");
    expect(trialReport.actualTrialExecutionEnabled).toBe(false);
    expect(trialFc.mode).toBe("runtime_allocation_forecast_comparison");
    expect(trialFc.actualTrialExecutionEnabled).toBe(false);
    expect(trialGc.mode).toBe("runtime_allocation_governance_comparison");
    expect(trialGc.actualTrialExecutionEnabled).toBe(false);
    expect(trialDrift.mode).toBe("runtime_allocation_trial_drift_summary");
    expect(trialDrift.actualTrialExecutionEnabled).toBe(false);
    const ctrlSummary = b.runtimeControlBoundarySummary as {
      mode?: string;
      actualControlEnabled?: boolean;
    };
    const ctrlViol = b.runtimeControlBoundaryViolationReport as { mode?: string; actualControlEnabled?: boolean };
    const ctrlMatrix = b.runtimeControlScopeMatrix as { mode?: string; actualControlEnabled?: boolean };
    expect(ctrlSummary.mode).toBe("runtime_control_boundary_summary");
    expect(ctrlSummary.actualControlEnabled).toBe(false);
    expect(ctrlViol.mode).toBe("runtime_control_boundary_violation_report");
    expect(ctrlViol.actualControlEnabled).toBe(false);
    expect(ctrlMatrix.mode).toBe("runtime_control_scope_matrix");
    expect(ctrlMatrix.actualControlEnabled).toBe(false);
    const execSummary = b.runtimeExecutionCandidateSummary as {
      mode?: string;
      actualExecutionEnabled?: boolean;
    };
    const execScope = b.runtimeExecutionCandidateScope as { mode?: string; actualExecutionEnabled?: boolean };
    const execPre = b.runtimeExecutionCandidatePreconditions as { mode?: string; actualExecutionEnabled?: boolean };
    const execBlock = b.runtimeExecutionCandidateBlockers as { mode?: string; actualExecutionEnabled?: boolean };
    expect(execSummary.mode).toBe("runtime_execution_candidate_summary");
    expect(execSummary.actualExecutionEnabled).toBe(false);
    expect(execScope.mode).toBe("runtime_execution_candidate_scope");
    expect(execScope.actualExecutionEnabled).toBe(false);
    expect(execPre.mode).toBe("runtime_execution_candidate_preconditions");
    expect(execPre.actualExecutionEnabled).toBe(false);
    expect(execBlock.mode).toBe("runtime_execution_candidate_blockers");
    expect(execBlock.actualExecutionEnabled).toBe(false);
    const opApproval = b.runtimeOperatorApprovalSummary as {
      mode?: string;
      actualApprovalEnforcementEnabled?: boolean;
    };
    const opRollback = b.runtimeRollbackReadinessSummary as { mode?: string; actualRollbackExecutionEnabled?: boolean };
    const opAudit = b.runtimeAuditReadinessSummary as { mode?: string };
    const opPilot = b.runtimePilotPreconditionSummary as { mode?: string };
    expect(opApproval.mode).toBe("runtime_operator_approval_summary");
    expect(opApproval.actualApprovalEnforcementEnabled).toBe(false);
    expect(opRollback.mode).toBe("runtime_rollback_readiness_summary");
    expect(opRollback.actualRollbackExecutionEnabled).toBe(false);
    expect(opAudit.mode).toBe("runtime_audit_readiness_summary");
    expect(opPilot.mode).toBe("runtime_pilot_precondition_summary");
    const cpSummary = b.runtimeControlledPilotSummary as {
      mode?: string;
      actualPilotExecutionEnabled?: boolean;
      actualProviderRoutingEnabled?: boolean;
    };
    const cpEnv = b.runtimeControlledPilotSafetyEnvelope as { mode?: string; actualRollbackExecutionEnabled?: boolean };
    const cpFb = b.runtimeControlledPilotFallbackPlan as { mode?: string; actualRollbackExecutionEnabled?: boolean };
    const cpAbort = b.runtimeControlledPilotAbortConditions as { mode?: string };
    expect(cpSummary.mode).toBe("runtime_controlled_pilot_summary");
    expect(cpSummary.actualPilotExecutionEnabled).toBe(false);
    expect(cpSummary.actualProviderRoutingEnabled).toBe(false);
    expect(cpEnv.mode).toBe("runtime_controlled_pilot_safety_envelope");
    expect(cpEnv.actualRollbackExecutionEnabled).toBe(false);
    expect(cpFb.mode).toBe("runtime_controlled_pilot_fallback_plan");
    expect(cpFb.actualRollbackExecutionEnabled).toBe(false);
    expect(cpAbort.mode).toBe("runtime_controlled_pilot_abort_conditions");
    const pcSummary = b.runtimePilotContractSummary as {
      mode?: string;
      actualRuntimeAdapterInvocationEnabled?: boolean;
    };
    const pcBoundary = b.runtimeAdapterBoundarySummary as { mode?: string };
    const pcHandoff = b.runtimePilotHandoffReadiness as { mode?: string };
    expect(pcSummary.mode).toBe("runtime_pilot_contract_summary");
    expect(pcSummary.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect(pcBoundary.mode).toBe("runtime_adapter_boundary_summary");
    expect(pcHandoff.mode).toBe("runtime_pilot_handoff_readiness");
    expect((b.runtimePilotContractInputSchema as { mode?: string }).mode).toBe("runtime_pilot_contract_input_schema");
    expect((b.runtimePilotContractOutputSchema as { mode?: string }).mode).toBe(
      "runtime_pilot_contract_output_schema"
    );
    expect((b.runtimeAdapterForbiddenOperationReport as { mode?: string }).mode).toBe(
      "runtime_adapter_forbidden_operation_report"
    );
    const noopSummary = b.runtimeNoopAdapterSummary as {
      mode?: string;
      actualRuntimeAdapterInvocationEnabled?: boolean;
    };
    expect(noopSummary.mode).toBe("runtime_noop_adapter_summary");
    expect(noopSummary.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect((b.runtimeNoopAdapterSkeleton as { mode?: string; adapterMode?: string }).adapterMode).toBe("noop");
    expect((b.runtimePilotContractVerificationReport as { mode?: string }).mode).toBe(
      "runtime_pilot_contract_verification_report"
    );
    expect((b.runtimeAdapterInvocationGuardReport as { mode?: string }).mode).toBe(
      "runtime_adapter_invocation_guard_report"
    );
  });
});

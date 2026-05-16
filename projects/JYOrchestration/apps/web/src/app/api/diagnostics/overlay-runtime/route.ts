import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE } from "@/lib/overlay/knowledgeActivationResolver";
import { OVERLAY_MEMORY_SCOPE_SOURCE_RULES } from "@/lib/overlay/memoryScopeRuntime";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { validateWorkspaceAiMemberOverlayMappings } from "@/lib/overlay/overlayIdentityFromWorkspace";
import { buildProjectOverlayDiagnosticFromSelectedAgents } from "@/lib/overlay/overlayProjectDiagnostic";
import {
  buildWorkspaceCatalogUnmappedWarnings,
  collateOverlayRuntimeDiagnosticWarnings,
  summarizeOverlayPolicyWarnings,
} from "@/lib/overlay/overlayPolicyWarning";
import { buildOverlayWarningReport } from "@/lib/overlay/overlayWarningReport";
import { summarizeOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";
import { summarizeOverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import { summarizeOverlayConflictWarnings } from "@/lib/overlay/overlayConflictDetection";
import {
  summarizeOverlayAssemblyPlan,
  summarizeOverlayAssemblyIncludeMode,
} from "@/lib/overlay/overlayContextAssemblyPlan";
import { summarizeOverlayPruningCandidates } from "@/lib/overlay/overlayContextPruning";
import { detectOverlayPolicyDrift } from "@/lib/overlay/overlayPolicyDriftWarning";
import { summarizeHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import {
  HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT,
  evaluateHarnessPromptApplyReadiness,
} from "@/lib/harness/promptAssembly/evaluateHarnessPromptApplyReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import {
  emptyKnowledgeActivationSummary,
  summarizeKnowledgeActivationPlan,
} from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import {
  emptyMemoryRuntimeSummary,
  summarizeMemoryRuntimePlan,
} from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";
import {
  emptyRecentMemoryRuntimeSummary,
  summarizeRecentMemoryRuntimePlans,
} from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import {
  emptyExecutionRoutingSummary,
  summarizeExecutionRoutingPlan,
} from "@/lib/harness/executionRouting/executionCapabilityTypes";
import {
  emptyExecutionRoutingSafetyReport,
  type ExecutionRoutingSafetyReport,
} from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import { evaluateExecutionRoutingSafety } from "@/lib/harness/executionRouting/evaluateExecutionRoutingSafety";
import {
  emptyRecentExecutionRoutingSummary,
  summarizeRecentExecutionRoutingPlans,
} from "@/lib/harness/executionRouting/executionRoutingRecentSummary";
import {
  emptyReviewSecuritySummary,
  summarizeReviewSecurityHarnessPlan,
} from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";
import {
  emptyRecentReviewSecuritySummary,
  summarizeRecentReviewSecurityPlans,
} from "@/lib/harness/reviewSecurity/reviewSecurityRecentSummary";
import {
  emptyRemediationLoopSummary,
  emptyReviewSecurityIssuePlanningSummary,
  summarizeRemediationLoopPlan,
  summarizeReviewSecurityIssuePlanningReport,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueTypes";
import {
  emptyRecentReviewSecurityIssueSummary,
  summarizeRecentReviewSecurityIssuePlans,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueRecentSummary";
import {
  OVERLAY_REGISTRY_CAPABILITY_IDS,
  OVERLAY_REGISTRY_PROVIDERS,
  OVERLAY_REGISTRY_ROLE_KEYS,
  resolveAiIdentityContract,
} from "@/lib/overlay/overlayRuntimeResolver";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveServicePlanningOrchestrationContext } from "@/lib/requirements/singleChatAgentContext";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import type { OverlayAudienceMode } from "@/lib/overlay-ui/overlayAudienceTypes";
import { filterOverlayRuntimeDiagnosticDataForAudience } from "@/lib/overlay/overlayRuntimeDiagnosticAudienceFilter";
import { summarizeResourceOrchestrationPlanning } from "@/lib/harness/resourceOrchestration/summarizeResourceOrchestrationPlanning";
import { summarizeResourcePressureForDiagnostic } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import { summarizeOverlayOverloadMitigation } from "@/lib/overlay-ui/overlayOverloadMitigation";
import { serializeOperatorRuntimeSummaryForDiagnostic } from "@/lib/overlay-ui/overlayOperatorResourceSummaryAdapter";
import { evaluateRuntimeTrialReadiness, serializeRuntimeTrialReadinessForDiagnostic } from "@/lib/harness/runtimeTrial/evaluateRuntimeTrialReadiness";
import {
  buildRuntimeRiskSummary,
  serializeRuntimeRiskSummaryForDiagnostic,
} from "@/lib/harness/runtimeTrial/runtimeRiskSummary";
import {
  buildRuntimeSimulationSummary,
  serializeRuntimeSimulationSummaryForDiagnostic,
} from "@/lib/harness/runtimeTrial/buildRuntimeSimulationSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import {
  serializeRuntimeGovernanceDiagnosticBundleFromContext,
} from "@/lib/harness/runtimeGovernance/serializeRuntimeGovernanceDiagnosticBundle";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { serializeRuntimeEnforcementDiagnosticBundleFromPlanning } from "@/lib/harness/runtimeEnforcement/serializeRuntimeEnforcementDiagnosticBundle";
import { serializeEnforcementGovernanceDiagnosticBundleFromEnforcementPlanning } from "@/lib/harness/enforcementGovernance/serializeEnforcementGovernanceDiagnosticBundle";
import { serializeRuntimeStabilityDiagnosticBundleFromReports } from "@/lib/harness/runtimeStability/serializeRuntimeStabilityDiagnosticBundle";
import { serializeRuntimePriorityDiagnosticBundleFromReports } from "@/lib/harness/runtimePriority/serializeRuntimePriorityDiagnosticBundle";
import { serializeRuntimeLifecycleDiagnosticBundleFromReports } from "@/lib/harness/runtimeLifecycle/serializeRuntimeLifecycleDiagnosticBundle";
import { serializeRuntimeCoherenceDiagnosticBundleFromReports } from "@/lib/harness/runtimeCoherence/serializeRuntimeCoherenceDiagnosticBundle";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { serializeRuntimeConsolidationDiagnosticBundleFromContext } from "@/lib/harness/runtimeConsolidation/serializeRuntimeConsolidationDiagnosticBundle";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { serializeRuntimeDependencyDiagnosticBundleFromReports } from "@/lib/harness/runtimeDependency/serializeRuntimeDependencyDiagnosticBundle";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { serializeRuntimeCriticalityDiagnosticBundleFromReports } from "@/lib/harness/runtimeCriticality/serializeRuntimeCriticalityDiagnosticBundle";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { serializeRuntimeTraceabilityDiagnosticBundleFromReports } from "@/lib/harness/runtimeTraceability/serializeRuntimeTraceabilityDiagnosticBundle";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { serializeRuntimeReasoningDiagnosticBundleFromReports } from "@/lib/harness/runtimeReasoning/serializeRuntimeReasoningDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { serializeRuntimeSemanticDiagnosticBundleFromPlanningReports } from "@/lib/harness/runtimeSemantic/serializeRuntimeSemanticDiagnosticBundle";

/**
 * Overlay 런타임·레지스트리 **읽기 전용** 진단. DB·오케스트레이션 경로에 영향 없음.
 * - `?roles=a,b,c` — 각 문자열에 대해 `resolveAiIdentityContract` 실패 시 `unresolvedRoleKeys`에 포함.
 * - `?projectId=` — 로그인 + `canViewProject` 필요. 서비스 기획 통합 `selectedAgents` 및 마지막 prompt 타임라인 overlay 추출(읽기).
 * - `?audienceMode=user|operator|internal` — (H8.5) `user`일 때 내부 진단 필드 일부를 응답에서 제외(미지정·`operator`·`internal`은 기존과 동일).
 */
export async function GET(request: NextRequest) {
  const rawAudience = request.nextUrl.searchParams.get("audienceMode")?.trim().toLowerCase() ?? "";
  const diagnosticAudienceMode: OverlayAudienceMode | undefined =
    rawAudience === "user" || rawAudience === "operator" || rawAudience === "internal" ? rawAudience : undefined;

  const rolesParam = request.nextUrl.searchParams.get("roles");
  const sample = rolesParam?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) ?? [];
  const unresolvedRoleKeys = sample.filter((r) => !resolveAiIdentityContract(r));

  const knowledgeHintMappings = Object.entries(OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE)
    .map(([roleKey, hintScope]) => ({ roleKey, hintScope }))
    .sort((a, b) => a.roleKey.localeCompare(b.roleKey));

  const memoryScopeMappings = OVERLAY_MEMORY_SCOPE_SOURCE_RULES.map((r) => ({
    sourceLabel: r.sourceLabel,
    scope: r.scope,
  }));

  const workspaceAiMemberOverlayMappings = validateWorkspaceAiMemberOverlayMappings();
  const workspaceUnmappedWarnings = buildWorkspaceCatalogUnmappedWarnings(workspaceAiMemberOverlayMappings.unmapped);

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  let projectOverlay: ReturnType<typeof buildProjectOverlayDiagnosticFromSelectedAgents> | undefined;
  let lastPromptTraceOverlayExtract: ReturnType<typeof extractOverlayPromptTraceMetadata> | null | undefined;
  let harnessPromptApplyReadinessReport:
    | ReturnType<typeof evaluateHarnessPromptApplyReadiness>
    | undefined;
  let recentMemoryRuntimeSummary: ReturnType<typeof summarizeRecentMemoryRuntimePlans> | undefined;
  let recentExecutionRoutingSummary:
    | ReturnType<typeof summarizeRecentExecutionRoutingPlans>
    | undefined;
  let recentReviewSecuritySummary:
    | ReturnType<typeof summarizeRecentReviewSecurityPlans>
    | undefined;
  let recentReviewSecurityIssueSummary:
    | ReturnType<typeof summarizeRecentReviewSecurityIssuePlans>
    | undefined;

  if (projectId) {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "diagnostics.overlay-runtime");
    } catch (e) {
      const denied = rbacErrorResponse(e);
      if (denied) return denied;
      throw e;
    }

    const orch = await resolveServicePlanningOrchestrationContext(projectId);
    projectOverlay = buildProjectOverlayDiagnosticFromSelectedAgents(projectId, orch.selectedAgents);

    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true },
    });
    const parsed = parseRequirementsStateJson(row?.requirementsStateJson ?? null);
    const last = parsed.promptTimeline?.length ? parsed.promptTimeline[parsed.promptTimeline.length - 1] : undefined;
    lastPromptTraceOverlayExtract = last ? extractOverlayPromptTraceMetadata(last) : null;

    // Harness Phase H2 — Apply-readiness: 최근 N entry의 preview/diff를 누적 집계(read-only).
    const recentTimeline = parsed.promptTimeline ?? [];
    const recentExtracts = recentTimeline
      .slice(-HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT)
      .map((row) => extractOverlayPromptTraceMetadata(row));
    const recentReadinessEntries = recentExtracts.map((extracted) => ({
      harnessPromptAssemblyPreview: extracted.harnessPromptAssemblyPreview,
      harnessPromptPreviewDiff: extracted.harnessPromptPreviewDiff,
    }));
    harnessPromptApplyReadinessReport = evaluateHarnessPromptApplyReadiness({
      entries: recentReadinessEntries,
      sampleLimit: HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT,
    });

    // Harness Phase H4.5 — Recent Memory Runtime Summary(누적 read-only).
    const recentMemoryPlans = recentExtracts
      .map((extracted) => extracted.memoryRuntimePlan)
      .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
    recentMemoryRuntimeSummary = summarizeRecentMemoryRuntimePlans({ plans: recentMemoryPlans });

    // Harness Phase H5.5 — Recent Execution Routing Summary(누적 read-only).
    const recentExecutionRoutingPlans = recentExtracts
      .map((extracted) => extracted.executionRoutingPlan)
      .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
    recentExecutionRoutingSummary = summarizeRecentExecutionRoutingPlans({
      plans: recentExecutionRoutingPlans,
    });

    // Harness Phase H6 — Recent Review/Security Summary(누적 read-only).
    const recentReviewSecurityPlans = recentExtracts
      .map((extracted) => extracted.reviewSecurityHarnessPlan)
      .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
    recentReviewSecuritySummary = summarizeRecentReviewSecurityPlans({
      plans: recentReviewSecurityPlans,
    });

    // Harness Phase H6.5 — Recent Review/Security Issue Summary(누적 read-only).
    const recentReviewSecurityIssueReports = recentExtracts
      .map((extracted) => extracted.reviewSecurityIssuePlanningReport)
      .filter((report): report is NonNullable<typeof report> => Boolean(report));
    recentReviewSecurityIssueSummary = summarizeRecentReviewSecurityIssuePlans({
      reports: recentReviewSecurityIssueReports,
    });
  }

  const summaryWarnings = collateOverlayRuntimeDiagnosticWarnings({
    workspaceUnmappedWarnings,
    unresolvedAgentRows: projectOverlay?.unresolvedAgents,
    timelineWarnings: lastPromptTraceOverlayExtract?.overlayPolicyWarnings,
  });
  const overlayPolicyWarningSummary = summarizeOverlayPolicyWarnings(summaryWarnings);
  const overlayWarningReport = buildOverlayWarningReport({ warnings: summaryWarnings });

  const overlaySelectionSummary = summarizeOverlaySelectedContextRefs(
    lastPromptTraceOverlayExtract?.overlaySelectedContextRefs ?? []
  );
  const overlayConflictSummary = summarizeOverlayConflictWarnings(
    lastPromptTraceOverlayExtract?.overlayConflictWarnings ?? []
  );
  const overlayContextBudgetSummary = summarizeOverlayContextBudgetMetadata(
    lastPromptTraceOverlayExtract?.overlayContextBudget
  );

  const resourceOrchestrationPlanningSummary = summarizeResourceOrchestrationPlanning(
    lastPromptTraceOverlayExtract ?? null
  );

  const lastAssemblyPlan = lastPromptTraceOverlayExtract?.overlayContextAssemblyPlan ?? [];
  const lastPruningCandidates = lastPromptTraceOverlayExtract?.overlayPruningCandidates ?? [];
  const overlayAssemblyPlanSummary = summarizeOverlayAssemblyPlan({
    plan: lastAssemblyPlan,
    budgetMetadata: lastPromptTraceOverlayExtract?.overlayContextBudget,
  });
  const overlayAssemblyIncludeModeSummary = summarizeOverlayAssemblyIncludeMode(lastAssemblyPlan);
  const overlayPruningSummary = summarizeOverlayPruningCandidates(lastPruningCandidates);

  // Drift는 replay에 저장된 값을 우선 사용하고, 없으면 즉시 재계산한다(읽기 전용 진단).
  const driftFromReplay = lastPromptTraceOverlayExtract?.overlayPolicyDriftWarnings;
  const overlayPolicyDriftWarnings =
    driftFromReplay && driftFromReplay.length > 0
      ? driftFromReplay
      : detectOverlayPolicyDrift({
          assemblyPlan: lastAssemblyPlan,
          budgetMetadata: lastPromptTraceOverlayExtract?.overlayContextBudget,
        });

  // Harness Phase H1 — Controlled prompt assembly preview (dry-run only).
  // **여전히 실제 prompt payload·LLM 호출에 영향 없음.** 진단 응답 노출용 summary만.
  const harnessPromptAssemblySummary = summarizeHarnessPromptAssemblyPreview(
    lastPromptTraceOverlayExtract?.harnessPromptAssemblyPreview
  );

  // Harness Phase H2 — Apply-readiness 진단(누적 read-only). projectId가 없으면 empty fallback.
  const harnessReadinessForResponse = harnessPromptApplyReadinessReport ?? emptyHarnessPromptApplyReadinessReport();

  // Harness Phase H3 — Role-aware Knowledge Activation summary(read-only).
  // 최근 promptTrace 1건의 knowledgeActivationPlan을 요약(누적 통계 아님; UI는 planning metadata로 표시).
  const knowledgeActivationSummary = lastPromptTraceOverlayExtract?.knowledgeActivationPlan
    ? summarizeKnowledgeActivationPlan(lastPromptTraceOverlayExtract.knowledgeActivationPlan)
    : emptyKnowledgeActivationSummary();

  // Harness Phase H4 Preparation — Memory Runtime Plan summary(read-only).
  // 최근 promptTrace 1건의 memoryRuntimePlan을 요약(누적 통계 아님; UI는 planning metadata로 표시).
  const memoryRuntimeSummary = lastPromptTraceOverlayExtract?.memoryRuntimePlan
    ? summarizeMemoryRuntimePlan(lastPromptTraceOverlayExtract.memoryRuntimePlan)
    : emptyMemoryRuntimeSummary();

  // Harness Phase H4.5 — Recent Memory Runtime Summary(누적). projectId가 없으면 empty fallback.
  const recentMemoryRuntimeSummaryForResponse =
    recentMemoryRuntimeSummary ?? emptyRecentMemoryRuntimeSummary();

  // Harness Phase H5 Preparation — Execution Routing summary(read-only).
  // 최근 promptTrace 1건의 executionRoutingPlan을 요약(누적 아님; UI는 planning metadata로 표시).
  const executionRoutingSummary = lastPromptTraceOverlayExtract?.executionRoutingPlan
    ? summarizeExecutionRoutingPlan(lastPromptTraceOverlayExtract.executionRoutingPlan)
    : emptyExecutionRoutingSummary();

  // Harness Phase H5.5 — Execution Routing Safety Report(read-only dry-run safety diagnostic).
  // 우선 replay에 기록된 safety report를 사용하고, 없으면 plan으로부터 즉시 평가(자동 차단 없음).
  const executionRoutingSafetyReport: ExecutionRoutingSafetyReport =
    lastPromptTraceOverlayExtract?.executionRoutingSafetyReport ??
    (lastPromptTraceOverlayExtract?.executionRoutingPlan
      ? evaluateExecutionRoutingSafety({ plan: lastPromptTraceOverlayExtract.executionRoutingPlan })
      : emptyExecutionRoutingSafetyReport());

  // Harness Phase H5.5 — Recent Execution Routing Summary(누적). projectId가 없으면 empty fallback.
  const recentExecutionRoutingSummaryForResponse =
    recentExecutionRoutingSummary ?? emptyRecentExecutionRoutingSummary();

  // Harness Phase H6 — Review/Security Summary(read-only).
  // 최근 promptTrace 1건의 reviewSecurityHarnessPlan을 요약(누적 아님; UI는 planning metadata로 표시).
  const reviewSecuritySummary = lastPromptTraceOverlayExtract?.reviewSecurityHarnessPlan
    ? summarizeReviewSecurityHarnessPlan(lastPromptTraceOverlayExtract.reviewSecurityHarnessPlan)
    : emptyReviewSecuritySummary();

  // Harness Phase H6 — Recent Review/Security Summary(누적). projectId가 없으면 empty fallback.
  const recentReviewSecuritySummaryForResponse =
    recentReviewSecuritySummary ?? emptyRecentReviewSecuritySummary();

  // Harness Phase H6.5 — Review/Security Issue Planning Summary(read-only).
  // 최근 promptTrace 1건의 reviewSecurityIssuePlanningReport를 요약(누적 아님).
  const reviewSecurityIssuePlanningSummary = lastPromptTraceOverlayExtract?.reviewSecurityIssuePlanningReport
    ? summarizeReviewSecurityIssuePlanningReport(
        lastPromptTraceOverlayExtract.reviewSecurityIssuePlanningReport
      )
    : emptyReviewSecurityIssuePlanningSummary();

  // Harness Phase H6.5 — Remediation Loop Summary(read-only).
  const remediationLoopSummary = lastPromptTraceOverlayExtract?.remediationLoopPlan
    ? summarizeRemediationLoopPlan(lastPromptTraceOverlayExtract.remediationLoopPlan)
    : emptyRemediationLoopSummary();

  // Harness Phase H6.5 — Recent Review/Security Issue Summary(누적). projectId가 없으면 empty fallback.
  const recentReviewSecurityIssueSummaryForResponse =
    recentReviewSecurityIssueSummary ?? emptyRecentReviewSecurityIssueSummary();

  const overlayArchitecturePhase = {
    current: "harness-review-security-issue-planning-layer" as const,
    enforcementEnabled: false,
    retrievalOrchestrationEnabled: false,
    providerOrchestrationEnabled: false,
    memoryOrchestrationEnabled: false,
    autoPromptAssemblyEnabled: false,
    harnessPromptAssemblyPreviewEnabled: true,
    harnessPromptApplyReadinessEnabled: true,
    harnessRoleAwareKnowledgeActivationEnabled: true,
    harnessMemoryRuntimePlanningEnabled: true,
    harnessMemoryRuntimeStabilizationEnabled: true,
    harnessExecutionRoutingPlanningEnabled: true,
    harnessExecutionRoutingSafetyStabilizationEnabled: true,
    harnessReviewSecurityPreparationEnabled: true,
    harnessReviewSecurityIssuePlanningEnabled: true,
    harnessResourceOrchestrationPlanningEnabled: true,
    harnessResourceStabilizationEnabled: true,
    harnessControlledRuntimeTrialPreparationEnabled: true,
    harnessControlledRuntimeGovernanceEnabled: true,
    harnessRuntimeEnforcementCandidateLayerEnabled: true,
    harnessControlledEnforcementGovernanceEnabled: true,
    harnessRuntimeStabilityPlanningEnabled: true,
    harnessRuntimePlanningPriorityEscalationEnabled: true,
    harnessRuntimePlanningLifecycleGovernanceEnabled: true,
    harnessRuntimePlanningCoherenceSynchronizationEnabled: true,
    harnessRuntimePlanningConsolidationNormalizationEnabled: true,
    harnessRuntimePlanningDependencyImpactGraphEnabled: true,
    harnessRuntimePlanningCriticalityPriorityPropagationEnabled: true,
    harnessRuntimePlanningTraceabilityReasoningChainEnabled: true,
    harnessRuntimePlanningReasoningConsolidationEnabled: true,
    harnessRuntimePlanningSemanticCompressionEnabled: true,
    harnessRuntimePlanningSemanticQualityGateEnabled: true,
    harnessRuntimePlanningSemanticExplainabilityGraphEnabled: true,
    harnessRuntimePlanningSemanticNarrativeConsolidationEnabled: true,
    harnessRuntimePlanningSemanticVocabularyStabilizationEnabled: true,
    harnessRuntimePlanningDecisionIntelligenceEnabled: true,
    harnessRuntimePlanningForecastingEnabled: true,
    harnessRuntimePlanningResourceIntelligenceEnabled: true,
    harnessRuntimePlanningResourceGovernanceEnabled: true,
    harnessRuntimePlanningResourceAllocationEnabled: true,
    harnessRuntimePlanningResourceTrialEnabled: true,
    harnessRuntimePlanningControlBoundaryEnabled: true,
    harnessRuntimePlanningExecutionCandidateEnabled: true,
    harnessRuntimePlanningOperatorApprovalReadinessEnabled: true,
    harnessRuntimePlanningControlledOrchestrationRuntimePilotEnabled: true,
    harnessRuntimePlanningPilotContractAdapterBoundaryEnabled: true,
    harnessRuntimePlanningNoopRuntimeAdapterEnabled: true,
    harnessRuntimePlanningNoopRuntimeAdapterStabilizationEnabled: true,
    harnessRuntimePlanningRuntimeAdapterSandboxEnabled: true,
    harnessRuntimePlanningRuntimeAdapterSandboxStabilizationEnabled: true,
    harnessRuntimePlanningRuntimePilotActivationCandidateEnabled: true,
    harnessRuntimePlanningRuntimePilotActivationStabilizationEnabled: true,
    harnessRuntimePlanningIsolatedRuntimePilotSkeletonEnabled: true,
    harnessRuntimePlanningIsolatedRuntimePilotSkeletonStabilizationEnabled: true,
    harnessRuntimePlanningIsolatedDryRunRunnerInvocationCandidateEnabled: true,
    harnessRuntimePlanningIsolatedDryRunRunnerInvocationStabilizationEnabled: true,
    harnessRuntimePlanningIsolatedDryRunRunnerNoopHarnessEnabled: true,
  };

  const overlayMaturity = {
    contractLayer: true,
    runtimeMetadataLayer: true,
    runtimePolicyHelperLayer: true,
    runtimePolicyWarningLayer: true,
    runtimeDiagnosticSelectionPreparationLayer: true,
    policyGuidedContextAssemblyPreparationLayer: true,
    policyGuidedAssemblyPlanStabilizationLayer: true,
    harnessControlledPromptAssemblyPreviewLayer: true,
    harnessApplyReadinessPreparationLayer: true,
    harnessRoleAwareKnowledgeActivationLayer: true,
    harnessMemoryRuntimePreparationLayer: true,
    harnessMemoryRuntimeStabilizationLayer: true,
    harnessExecutionRoutingPreparationLayer: true,
    harnessExecutionRoutingSafetyStabilizationLayer: true,
    harnessReviewSecurityPreparationLayer: true,
    harnessReviewSecurityIssuePlanningLayer: true,
    harnessControlledRuntimeGovernanceLayer: true,
    harnessRuntimeEnforcementCandidateLayer: true,
    harnessControlledEnforcementGovernanceLayer: true,
    harnessRuntimeStabilityPlanningLayer: true,
    harnessRuntimePlanningPriorityEscalationLayer: true,
    harnessRuntimePlanningLifecycleGovernanceLayer: true,
    harnessRuntimePlanningCoherenceSynchronizationLayer: true,
    harnessRuntimePlanningConsolidationNormalizationLayer: true,
    harnessRuntimePlanningDependencyImpactGraphLayer: true,
    harnessRuntimePlanningCriticalityPriorityPropagationLayer: true,
    harnessRuntimePlanningTraceabilityReasoningChainLayer: true,
    harnessRuntimePlanningReasoningConsolidationLayer: true,
    harnessRuntimePlanningSemanticCompressionLayer: true,
    harnessRuntimePlanningSemanticQualityGateLayer: true,
    harnessRuntimePlanningSemanticExplainabilityGraphLayer: true,
    harnessRuntimePlanningSemanticNarrativeConsolidationLayer: true,
    harnessRuntimePlanningSemanticVocabularyStabilizationLayer: true,
    harnessRuntimePlanningDecisionIntelligenceLayer: true,
    harnessRuntimePlanningForecastingLayer: true,
    harnessRuntimePlanningResourceIntelligenceLayer: true,
    harnessRuntimePlanningResourceGovernanceLayer: true,
    harnessRuntimePlanningResourceAllocationLayer: true,
    harnessRuntimePlanningResourceTrialLayer: true,
    harnessRuntimePlanningControlBoundaryLayer: true,
    harnessRuntimePlanningExecutionCandidateLayer: true,
    harnessRuntimePlanningOperatorApprovalReadinessLayer: true,
    harnessRuntimePlanningControlledOrchestrationRuntimePilotLayer: true,
    harnessRuntimePlanningPilotContractAdapterBoundaryLayer: true,
    harnessRuntimePlanningNoopRuntimeAdapterLayer: true,
    harnessRuntimePlanningNoopRuntimeAdapterStabilizationLayer: true,
    harnessRuntimePlanningRuntimeAdapterSandboxLayer: true,
    harnessRuntimePlanningRuntimeAdapterSandboxStabilizationLayer: true,
    harnessRuntimePlanningRuntimePilotActivationCandidateLayer: true,
    harnessRuntimePlanningIsolatedRuntimePilotSkeletonLayer: true,
    harnessRuntimePlanningIsolatedRuntimePilotSkeletonStabilizationLayer: true,
    harnessRuntimePlanningIsolatedDryRunRunnerInvocationCandidateLayer: true,
    harnessRuntimePlanningIsolatedDryRunRunnerInvocationStabilizationLayer: true,
    harnessRuntimePlanningIsolatedDryRunRunnerNoopHarnessLayer: true,
    runtimePolicyEnforcementLayer: false,
  } as const;

  const enforcementStatus = {
    hardBlockingEnabled: false,
    cursorCapabilityBlockingEnabled: false,
    retrievalPolicyEnforcementEnabled: false,
    promptInjectionPolicyEnabled: false,
  } as const;

  const harnessMaturityBaselineReport = evaluateHarnessMaturityBaseline({
    overlayExtract: lastPromptTraceOverlayExtract ?? null,
    harnessPromptApplyReadinessReport: harnessReadinessForResponse,
    recentMemoryRuntimeSummary: recentMemoryRuntimeSummaryForResponse,
    messageExplainabilityAvailable: true,
  });
  const harnessReleaseGateReadinessReport = evaluateHarnessReleaseGateReadiness(harnessMaturityBaselineReport);

  const overlayUiForDiag = buildOverlayUiViewModel(lastPromptTraceOverlayExtract ?? null);
  const resourcePressureSummary = summarizeResourcePressureForDiagnostic(lastPromptTraceOverlayExtract ?? null);
  const overlayOverloadSummary = summarizeOverlayOverloadMitigation({
    extract: lastPromptTraceOverlayExtract ?? null,
    compactAndNarrowUi: false,
  });
  const operatorRuntimeSummary = serializeOperatorRuntimeSummaryForDiagnostic({
    overlay: lastPromptTraceOverlayExtract ?? null,
    summary: overlayUiForDiag.summary,
    maturityBaseline: harnessMaturityBaselineReport,
    releaseGate: harnessReleaseGateReadinessReport,
    messageExplainabilityAvailable: true,
  });

  const runtimeTrialReadinessReport = evaluateRuntimeTrialReadiness({
    baseline: harnessMaturityBaselineReport,
    releaseGate: harnessReleaseGateReadinessReport,
    extract: lastPromptTraceOverlayExtract ?? null,
  });
  const runtimeTrialReadiness = serializeRuntimeTrialReadinessForDiagnostic(runtimeTrialReadinessReport);
  const governanceCtx = buildRuntimeGovernancePlanningContext({
    baseline: harnessMaturityBaselineReport,
    releaseGate: harnessReleaseGateReadinessReport,
    extract: lastPromptTraceOverlayExtract ?? null,
  });
  const governanceDiag = serializeRuntimeGovernanceDiagnosticBundleFromContext(governanceCtx);
  const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
    baseline: harnessMaturityBaselineReport,
    releaseGate: harnessReleaseGateReadinessReport,
    governanceCtx,
    extract: lastPromptTraceOverlayExtract ?? null,
    messageExplainabilityAvailable: true,
  });
  const enforcementDiag = serializeRuntimeEnforcementDiagnosticBundleFromPlanning({
    baseline: harnessMaturityBaselineReport,
    governanceCtx,
    enforcementPlanning,
    extract: lastPromptTraceOverlayExtract ?? null,
    messageExplainabilityAvailable: true,
    overlayWarningCount: overlayUiForDiag.summary.warningCount,
  });
  const enforcementGovernanceDiag = serializeEnforcementGovernanceDiagnosticBundleFromEnforcementPlanning({
    baseline: harnessMaturityBaselineReport,
    releaseGate: harnessReleaseGateReadinessReport,
    governanceCtx,
    enforcementPlanning,
    extract: lastPromptTraceOverlayExtract ?? null,
    messageExplainabilityAvailable: true,
    overlayWarningCount: overlayUiForDiag.summary.warningCount,
  });
  const planningCtx = normalizeRuntimePlanningContext({
    overlay: lastPromptTraceOverlayExtract ?? null,
    maturityBaseline: harnessMaturityBaselineReport,
    releaseGate: harnessReleaseGateReadinessReport,
    messageExplainabilityAvailable: true,
    overlayWarningCount: overlayUiForDiag.summary.warningCount,
    compactAndNarrowUi: false,
    governanceCtx,
    enforcementPlanning,
  });
  const runtimeStabilityDiag = serializeRuntimeStabilityDiagnosticBundleFromReports(planningCtx.stabilityReports);
  const runtimePriorityDiag = serializeRuntimePriorityDiagnosticBundleFromReports(planningCtx.priorityReports);
  const runtimeLifecycleDiag = serializeRuntimeLifecycleDiagnosticBundleFromReports(planningCtx.lifecycleReports);
  const runtimeCoherenceDiag = serializeRuntimeCoherenceDiagnosticBundleFromReports(planningCtx.coherenceReports);
  const runtimeConsolidationDiag = serializeRuntimeConsolidationDiagnosticBundleFromContext(planningCtx);
  const dependencyPlanningReports = buildRuntimeDependencyPlanningReports(planningCtx);
  const runtimeDependencyDiag = serializeRuntimeDependencyDiagnosticBundleFromReports(dependencyPlanningReports);
  const criticalityPlanningReports = buildRuntimeCriticalityPlanningReports(
    planningCtx,
    dependencyPlanningReports
  );
  const runtimeCriticalityDiag = serializeRuntimeCriticalityDiagnosticBundleFromReports(
    criticalityPlanningReports
  );
  const traceabilityPlanningReports = buildRuntimeTraceabilityPlanningReports(
    planningCtx,
    dependencyPlanningReports,
    criticalityPlanningReports
  );
  const runtimeTraceabilityDiag = serializeRuntimeTraceabilityDiagnosticBundleFromReports(
    traceabilityPlanningReports
  );
  const reasoningPlanningReports = buildRuntimeReasoningPlanningReports(
    dependencyPlanningReports,
    criticalityPlanningReports,
    traceabilityPlanningReports
  );
  const runtimeReasoningDiag = serializeRuntimeReasoningDiagnosticBundleFromReports(
    reasoningPlanningReports
  );
  const semanticPlanningReports = buildRuntimeSemanticPlanningReports(reasoningPlanningReports);
  const runtimeSemanticDiag = serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(
    semanticPlanningReports
  );
  const runtimeRiskSummary = serializeRuntimeRiskSummaryForDiagnostic(
    buildRuntimeRiskSummary({
      baseline: harnessMaturityBaselineReport,
      releaseGate: harnessReleaseGateReadinessReport,
      extract: lastPromptTraceOverlayExtract ?? null,
    })
  );
  const runtimeSimulationSummary = serializeRuntimeSimulationSummaryForDiagnostic(buildRuntimeSimulationSummary());

  const responseData: Record<string, unknown> = {
      overlayRuntimeEnabled: true,
      registeredRoles: [...OVERLAY_REGISTRY_ROLE_KEYS],
      registeredProviders: [...OVERLAY_REGISTRY_PROVIDERS],
      registeredCapabilities: [...OVERLAY_REGISTRY_CAPABILITY_IDS],
      memoryScopeMappings,
      knowledgeHintMappings,
      unresolvedRoleKeys,
      workspaceAiMemberOverlayMappings,
      overlayPolicyWarningSummary,
      overlayWarningReport,
      overlaySelectionSummary,
      overlayConflictSummary,
      overlayContextBudgetSummary,
      resourceOrchestrationPlanningSummary,
      resourcePressureSummary,
      overlayOverloadSummary,
      operatorRuntimeSummary,
      runtimeTrialReadiness,
      runtimeRiskSummary,
      runtimeSimulationSummary,
      runtimeGovernanceSummary: governanceDiag.runtimeGovernanceSummary,
      rollbackSafetyPlanning: governanceDiag.rollbackSafetyPlanning,
      runtimeAuditabilitySummary: governanceDiag.runtimeAuditabilitySummary,
      runtimeEnforcementCandidate: enforcementDiag.runtimeEnforcementCandidate,
      runtimeEnforcementRiskSummary: enforcementDiag.runtimeEnforcementRiskSummary,
      candidateCapabilityPlanning: enforcementDiag.candidateCapabilityPlanning,
      controlledEnforcementGovernance: enforcementGovernanceDiag.controlledEnforcementGovernance,
      governanceDependencyPlanning: enforcementGovernanceDiag.governanceDependencyPlanning,
      governanceRiskSummary: enforcementGovernanceDiag.governanceRiskSummary,
      runtimeStabilitySummary: runtimeStabilityDiag.runtimeStabilitySummary,
      runtimeCandidateConflictReport: runtimeStabilityDiag.runtimeCandidateConflictReport,
      candidateSaturationSummary: runtimeStabilityDiag.candidateSaturationSummary,
      runtimePlanningDependencyReport: runtimePriorityDiag.runtimePlanningDependencyReport,
      runtimeEscalationSummary: runtimePriorityDiag.runtimeEscalationSummary,
      runtimePlanningBottleneckSummary: runtimePriorityDiag.runtimePlanningBottleneckSummary,
      runtimePlanningFreshnessSummary: runtimeLifecycleDiag.runtimePlanningFreshnessSummary,
      runtimePlanningDriftReport: runtimeLifecycleDiag.runtimePlanningDriftReport,
      runtimePlanningInvalidationSummary: runtimeLifecycleDiag.runtimePlanningInvalidationSummary,
      runtimePlanningCoherenceSummary: runtimeCoherenceDiag.runtimePlanningCoherenceSummary,
      runtimePlanningSynchronizationSummary: runtimeCoherenceDiag.runtimePlanningSynchronizationSummary,
      runtimePlanningDivergenceReport: runtimeCoherenceDiag.runtimePlanningDivergenceReport,
      unifiedRuntimePlanningSummary: runtimeConsolidationDiag.unifiedRuntimePlanningSummary,
      runtimePlanningRedundancySummary: runtimeConsolidationDiag.runtimePlanningRedundancySummary,
      runtimePlanningDependencyGraph: runtimeDependencyDiag.runtimePlanningDependencyGraph,
      runtimePlanningImpactPropagationSummary: runtimeDependencyDiag.runtimePlanningImpactPropagationSummary,
      runtimePlanningDependencyConflictSummary: runtimeDependencyDiag.runtimePlanningDependencyConflictSummary,
      runtimePlanningCriticalitySummary: runtimeCriticalityDiag.runtimePlanningCriticalitySummary,
      runtimePriorityPropagationSummary: runtimeCriticalityDiag.runtimePriorityPropagationSummary,
      runtimeEscalationPriorityFlowSummary: runtimeCriticalityDiag.runtimeEscalationPriorityFlowSummary,
      runtimePlanningReasoningChain: runtimeTraceabilityDiag.runtimePlanningReasoningChain,
      runtimeDependencyReasoningTraceSummary: runtimeTraceabilityDiag.runtimeDependencyReasoningTraceSummary,
      runtimePriorityReasoningTraceSummary: runtimeTraceabilityDiag.runtimePriorityReasoningTraceSummary,
      unifiedRuntimeReasoningChain: runtimeReasoningDiag.unifiedRuntimeReasoningChain,
      runtimeReasoningRedundancySummary: runtimeReasoningDiag.runtimeReasoningRedundancySummary,
      normalizedRuntimeReasoningTrace: runtimeReasoningDiag.normalizedRuntimeReasoningTrace,
      runtimeSemanticGroups: runtimeSemanticDiag.runtimeSemanticGroups,
      compressedRuntimeReasoningTrace: runtimeSemanticDiag.compressedRuntimeReasoningTrace,
      runtimeSemanticRedundancySummary: runtimeSemanticDiag.runtimeSemanticRedundancySummary,
      stabilizedRuntimeSemanticOrdering: runtimeSemanticDiag.stabilizedRuntimeSemanticOrdering,
      runtimeSemanticCompressionQualityReport: runtimeSemanticDiag.runtimeSemanticCompressionQualityReport,
      runtimeHiddenSemanticTraceAudit: runtimeSemanticDiag.runtimeHiddenSemanticTraceAudit,
      runtimeSemanticGroupBalanceSummary: runtimeSemanticDiag.runtimeSemanticGroupBalanceSummary,
      runtimeSemanticExplainabilityGraph: runtimeSemanticDiag.runtimeSemanticExplainabilityGraph,
      runtimeSemanticWarningOriginSummary: runtimeSemanticDiag.runtimeSemanticWarningOriginSummary,
      runtimeSemanticExplosionRiskSummary: runtimeSemanticDiag.runtimeSemanticExplosionRiskSummary,
      runtimeSemanticNarrativeSummary: runtimeSemanticDiag.runtimeSemanticNarrativeSummary,
      runtimeSemanticRootCauseGroups: runtimeSemanticDiag.runtimeSemanticRootCauseGroups,
      runtimeSemanticGraphRelevanceSummary: runtimeSemanticDiag.runtimeSemanticGraphRelevanceSummary,
      runtimeSemanticVocabularySummary: runtimeSemanticDiag.runtimeSemanticVocabularySummary,
      runtimeSemanticNormalizedLabels: runtimeSemanticDiag.runtimeSemanticNormalizedLabels,
      runtimeSemanticPriorityVocabulary: runtimeSemanticDiag.runtimeSemanticPriorityVocabulary,
      runtimeDecisionLineage: runtimeSemanticDiag.runtimeDecisionLineage,
      runtimeDecisionSnapshot: runtimeSemanticDiag.runtimeDecisionSnapshot,
      runtimeRecommendationSummary: runtimeSemanticDiag.runtimeRecommendationSummary,
      runtimeDecisionCoherence: runtimeSemanticDiag.runtimeDecisionCoherence,
      runtimeForecastSummary: runtimeSemanticDiag.runtimeForecastSummary,
      runtimeForecastEscalation: runtimeSemanticDiag.runtimeForecastEscalation,
      runtimeForecastGovernanceDrift: runtimeSemanticDiag.runtimeForecastGovernanceDrift,
      runtimeForecastStability: runtimeSemanticDiag.runtimeForecastStability,
      runtimeResourceSummary: runtimeSemanticDiag.runtimeResourceSummary,
      runtimeResourceForecast: runtimeSemanticDiag.runtimeResourceForecast,
      runtimeResourceCapacity: runtimeSemanticDiag.runtimeResourceCapacity,
      runtimeMemberWorkload: runtimeSemanticDiag.runtimeMemberWorkload,
      runtimeResourceExplainability: runtimeSemanticDiag.runtimeResourceExplainability,
      runtimeResourceGovernanceSummary: runtimeSemanticDiag.runtimeResourceGovernanceSummary,
      runtimeResourcePolicyFindings: runtimeSemanticDiag.runtimeResourcePolicyFindings,
      runtimeResourceControlBoundary: runtimeSemanticDiag.runtimeResourceControlBoundary,
      runtimeResourceAllocationPlan: runtimeSemanticDiag.runtimeResourceAllocationPlan,
      runtimeAllocationEligibilitySummary: runtimeSemanticDiag.runtimeAllocationEligibilitySummary,
      runtimeProviderSlotPlan: runtimeSemanticDiag.runtimeProviderSlotPlan,
      runtimeExecutionSlotPlan: runtimeSemanticDiag.runtimeExecutionSlotPlan,
      runtimeResourceAllocationTrialReport: runtimeSemanticDiag.runtimeResourceAllocationTrialReport,
      runtimeAllocationForecastComparison: runtimeSemanticDiag.runtimeAllocationForecastComparison,
      runtimeAllocationGovernanceComparison: runtimeSemanticDiag.runtimeAllocationGovernanceComparison,
      runtimeAllocationTrialDriftSummary: runtimeSemanticDiag.runtimeAllocationTrialDriftSummary,
      runtimeControlBoundarySummary: runtimeSemanticDiag.runtimeControlBoundarySummary,
      runtimeControlBoundaryViolationReport: runtimeSemanticDiag.runtimeControlBoundaryViolationReport,
      runtimeControlScopeMatrix: runtimeSemanticDiag.runtimeControlScopeMatrix,
      runtimeExecutionCandidateSummary: runtimeSemanticDiag.runtimeExecutionCandidateSummary,
      runtimeExecutionCandidateScope: runtimeSemanticDiag.runtimeExecutionCandidateScope,
      runtimeExecutionCandidatePreconditions: runtimeSemanticDiag.runtimeExecutionCandidatePreconditions,
      runtimeExecutionCandidateBlockers: runtimeSemanticDiag.runtimeExecutionCandidateBlockers,
      runtimeOperatorApprovalSummary: runtimeSemanticDiag.runtimeOperatorApprovalSummary,
      runtimeRollbackReadinessSummary: runtimeSemanticDiag.runtimeRollbackReadinessSummary,
      runtimeAuditReadinessSummary: runtimeSemanticDiag.runtimeAuditReadinessSummary,
      runtimePilotPreconditionSummary: runtimeSemanticDiag.runtimePilotPreconditionSummary,
      runtimeControlledPilotSummary: runtimeSemanticDiag.runtimeControlledPilotSummary,
      runtimeControlledPilotSafetyEnvelope: runtimeSemanticDiag.runtimeControlledPilotSafetyEnvelope,
      runtimeControlledPilotFallbackPlan: runtimeSemanticDiag.runtimeControlledPilotFallbackPlan,
      runtimeControlledPilotAbortConditions: runtimeSemanticDiag.runtimeControlledPilotAbortConditions,
      runtimePilotContractSummary: runtimeSemanticDiag.runtimePilotContractSummary,
      runtimePilotContractInputSchema: runtimeSemanticDiag.runtimePilotContractInputSchema,
      runtimePilotContractOutputSchema: runtimeSemanticDiag.runtimePilotContractOutputSchema,
      runtimeAdapterBoundarySummary: runtimeSemanticDiag.runtimeAdapterBoundarySummary,
      runtimeAdapterForbiddenOperationReport: runtimeSemanticDiag.runtimeAdapterForbiddenOperationReport,
      runtimePilotHandoffReadiness: runtimeSemanticDiag.runtimePilotHandoffReadiness,
      runtimeNoopAdapterSummary: runtimeSemanticDiag.runtimeNoopAdapterSummary,
      runtimeNoopAdapterSkeleton: runtimeSemanticDiag.runtimeNoopAdapterSkeleton,
      runtimePilotContractVerificationReport: runtimeSemanticDiag.runtimePilotContractVerificationReport,
      runtimeNoopAdapterResultMetadata: runtimeSemanticDiag.runtimeNoopAdapterResultMetadata,
      runtimeAdapterInvocationGuardReport: runtimeSemanticDiag.runtimeAdapterInvocationGuardReport,
      runtimeNoopAdapterBoundaryViolationReport: runtimeSemanticDiag.runtimeNoopAdapterBoundaryViolationReport,
      runtimeNoopAdapterPreflightSummary: runtimeSemanticDiag.runtimeNoopAdapterPreflightSummary,
      runtimeAdapterSandboxSummary: runtimeSemanticDiag.runtimeAdapterSandboxSummary,
      runtimeAdapterSandboxInputEnvelope: runtimeSemanticDiag.runtimeAdapterSandboxInputEnvelope,
      runtimeAdapterSandboxOutputEnvelope: runtimeSemanticDiag.runtimeAdapterSandboxOutputEnvelope,
      runtimeAdapterSandboxPolicy: runtimeSemanticDiag.runtimeAdapterSandboxPolicy,
      runtimeAdapterSandboxResultMetadata: runtimeSemanticDiag.runtimeAdapterSandboxResultMetadata,
      runtimeAdapterSandboxBlockerReport: runtimeSemanticDiag.runtimeAdapterSandboxBlockerReport,
      runtimeAdapterSandboxEnvelopeVerificationReport:
        runtimeSemanticDiag.runtimeAdapterSandboxEnvelopeVerificationReport,
      runtimeAdapterSandboxBoundaryViolationReport:
        runtimeSemanticDiag.runtimeAdapterSandboxBoundaryViolationReport,
      runtimeAdapterSandboxPreflightSummary: runtimeSemanticDiag.runtimeAdapterSandboxPreflightSummary,
      runtimePilotActivationSummary: runtimeSemanticDiag.runtimePilotActivationSummary,
      runtimePilotActivationScope: runtimeSemanticDiag.runtimePilotActivationScope,
      runtimePilotActivationPolicy: runtimeSemanticDiag.runtimePilotActivationPolicy,
      runtimePilotActivationBlockerReport: runtimeSemanticDiag.runtimePilotActivationBlockerReport,
      runtimePilotActivationReadinessChecklist: runtimeSemanticDiag.runtimePilotActivationReadinessChecklist,
      runtimePilotActivationFinalSafetyGate: runtimeSemanticDiag.runtimePilotActivationFinalSafetyGate,
      runtimePilotActivationBoundaryViolationReport:
        runtimeSemanticDiag.runtimePilotActivationBoundaryViolationReport,
      runtimePilotActivationReadinessVerificationReport:
        runtimeSemanticDiag.runtimePilotActivationReadinessVerificationReport,
      runtimePilotSkeletonSummary: runtimeSemanticDiag.runtimePilotSkeletonSummary,
      runtimeDryRunRunnerContract: runtimeSemanticDiag.runtimeDryRunRunnerContract,
      runtimePilotRunnerInputEnvelope: runtimeSemanticDiag.runtimePilotRunnerInputEnvelope,
      runtimePilotRunnerOutputEnvelope: runtimeSemanticDiag.runtimePilotRunnerOutputEnvelope,
      runtimePilotRunnerSafetyGuard: runtimeSemanticDiag.runtimePilotRunnerSafetyGuard,
      runtimePilotSkeletonBlockerReport: runtimeSemanticDiag.runtimePilotSkeletonBlockerReport,
      runtimePilotRunnerContractVerificationReport:
        runtimeSemanticDiag.runtimePilotRunnerContractVerificationReport,
      runtimePilotRunnerBoundaryViolationReport:
        runtimeSemanticDiag.runtimePilotRunnerBoundaryViolationReport,
      runtimePilotRunnerNoExecutionResultMetadata:
        runtimeSemanticDiag.runtimePilotRunnerNoExecutionResultMetadata,
      runtimePilotSkeletonPreflightSummary: runtimeSemanticDiag.runtimePilotSkeletonPreflightSummary,
      runtimeRunnerInvocationSummary: runtimeSemanticDiag.runtimeRunnerInvocationSummary,
      runtimeRunnerInvocationScope: runtimeSemanticDiag.runtimeRunnerInvocationScope,
      runtimeRunnerInvocationPolicy: runtimeSemanticDiag.runtimeRunnerInvocationPolicy,
      runtimeRunnerInvocationBlockerReport: runtimeSemanticDiag.runtimeRunnerInvocationBlockerReport,
      runtimeRunnerInvocationReadinessChecklist:
        runtimeSemanticDiag.runtimeRunnerInvocationReadinessChecklist,
      runtimeRunnerInvocationFinalSafetyGate: runtimeSemanticDiag.runtimeRunnerInvocationFinalSafetyGate,
      runtimeRunnerInvocationBoundaryViolationReport:
        runtimeSemanticDiag.runtimeRunnerInvocationBoundaryViolationReport,
      runtimeRunnerInvocationReadinessVerificationReport:
        runtimeSemanticDiag.runtimeRunnerInvocationReadinessVerificationReport,
      runtimeRunnerNoopHarnessSummary: runtimeSemanticDiag.runtimeRunnerNoopHarnessSummary,
      runtimeRunnerNoopInvocationEnvelope: runtimeSemanticDiag.runtimeRunnerNoopInvocationEnvelope,
      runtimeRunnerNoopResultMetadata: runtimeSemanticDiag.runtimeRunnerNoopResultMetadata,
      runtimeRunnerNoopHarnessSafetyGuard: runtimeSemanticDiag.runtimeRunnerNoopHarnessSafetyGuard,
      runtimeRunnerNoopHarnessContractVerificationReport:
        runtimeSemanticDiag.runtimeRunnerNoopHarnessContractVerificationReport,
      runtimeRunnerNoopHarnessBoundaryViolationReport:
        runtimeSemanticDiag.runtimeRunnerNoopHarnessBoundaryViolationReport,
      runtimeRunnerNoopHarnessPreflightSummary: runtimeSemanticDiag.runtimeRunnerNoopHarnessPreflightSummary,
      overlayAssemblyPlanSummary,
      overlayAssemblyIncludeModeSummary,
      overlayPruningSummary,
      overlayPolicyDriftWarnings,
      harnessPromptAssemblySummary,
      harnessPromptApplyReadinessReport: harnessReadinessForResponse,
      knowledgeActivationSummary,
      memoryRuntimeSummary,
      recentMemoryRuntimeSummary: recentMemoryRuntimeSummaryForResponse,
      executionRoutingSummary,
      executionRoutingSafetyReport,
      recentExecutionRoutingSummary: recentExecutionRoutingSummaryForResponse,
      reviewSecuritySummary,
      recentReviewSecuritySummary: recentReviewSecuritySummaryForResponse,
      reviewSecurityIssuePlanningSummary,
      remediationLoopSummary,
      recentReviewSecurityIssueSummary: recentReviewSecurityIssueSummaryForResponse,
      overlayArchitecturePhase,
      overlayMaturity,
      enforcementStatus,
      harnessMaturityBaselineReport,
      harnessReleaseGateReadinessReport,
      promptTraceOverlayEnabled: true,
      ...(projectOverlay ? { projectOverlay } : {}),
      ...(projectId ? { lastPromptTraceOverlayExtract: lastPromptTraceOverlayExtract ?? null } : {}),
  };

  const data = filterOverlayRuntimeDiagnosticDataForAudience(responseData, diagnosticAudienceMode);

  return NextResponse.json({
    success: true,
    data,
  });
}

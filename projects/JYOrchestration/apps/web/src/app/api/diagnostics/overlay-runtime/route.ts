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

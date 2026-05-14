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
  OVERLAY_REGISTRY_CAPABILITY_IDS,
  OVERLAY_REGISTRY_PROVIDERS,
  OVERLAY_REGISTRY_ROLE_KEYS,
  resolveAiIdentityContract,
} from "@/lib/overlay/overlayRuntimeResolver";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveServicePlanningOrchestrationContext } from "@/lib/requirements/singleChatAgentContext";

/**
 * Overlay 런타임·레지스트리 **읽기 전용** 진단. DB·오케스트레이션 경로에 영향 없음.
 * - `?roles=a,b,c` — 각 문자열에 대해 `resolveAiIdentityContract` 실패 시 `unresolvedRoleKeys`에 포함.
 * - `?projectId=` — 로그인 + `canViewProject` 필요. 서비스 기획 통합 `selectedAgents` 및 마지막 prompt 타임라인 overlay 추출(읽기).
 */
export async function GET(request: NextRequest) {
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
    const recentReadinessEntries = recentTimeline
      .slice(-HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT)
      .map((row) => {
        const extracted = extractOverlayPromptTraceMetadata(row);
        return {
          harnessPromptAssemblyPreview: extracted.harnessPromptAssemblyPreview,
          harnessPromptPreviewDiff: extracted.harnessPromptPreviewDiff,
        };
      });
    harnessPromptApplyReadinessReport = evaluateHarnessPromptApplyReadiness({
      entries: recentReadinessEntries,
      sampleLimit: HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT,
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

  const overlayArchitecturePhase = {
    current: "harness-apply-readiness-preparation-layer" as const,
    enforcementEnabled: false,
    retrievalOrchestrationEnabled: false,
    providerOrchestrationEnabled: false,
    memoryOrchestrationEnabled: false,
    autoPromptAssemblyEnabled: false,
    harnessPromptAssemblyPreviewEnabled: true,
    harnessPromptApplyReadinessEnabled: true,
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
    runtimePolicyEnforcementLayer: false,
  } as const;

  const enforcementStatus = {
    hardBlockingEnabled: false,
    cursorCapabilityBlockingEnabled: false,
    retrievalPolicyEnforcementEnabled: false,
    promptInjectionPolicyEnabled: false,
  } as const;

  return NextResponse.json({
    success: true,
    data: {
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
      overlayArchitecturePhase,
      overlayMaturity,
      enforcementStatus,
      promptTraceOverlayEnabled: true,
      ...(projectOverlay ? { projectOverlay } : {}),
      ...(projectId ? { lastPromptTraceOverlayExtract: lastPromptTraceOverlayExtract ?? null } : {}),
    },
  });
}

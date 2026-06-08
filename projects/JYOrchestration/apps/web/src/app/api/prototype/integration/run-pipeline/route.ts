import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { buildImplementationIntegrationPipelineContext } from "@/lib/prototype/implementationIntegrationPipelineContextBuilder";
import { resolveIntegrationStepsForRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { buildImplementationIntegrationPipelineEligibilityFromSnapshot } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import { runProjectIntegrationPipeline } from "@/lib/prototype/projectIntegrationPipelineService";
import { toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { toImplementationRuntimeSnapshotApiSummary } from "@/lib/prototype/implementationRuntimeSnapshot";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { prisma } from "@/lib/prisma";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";

export const maxDuration = 120;

type Body = Readonly<{
  readonly projectId?: string;
  readonly projectName?: string | null;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationQuickRunV1?: unknown;
  readonly createPullRequest?: boolean;
}>;

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  githubAccessToken: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canEditProject",
        "POST /api/prototype/integration/run-pipeline",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: EXECUTION_SETUP_SELECT,
    });
    const token = String(setupRow?.githubAccessToken ?? "").trim();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "GitHub Access Token이 설정되어 있지 않습니다." },
        { status: 503 },
      );
    }

    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup(setupRow);
    if (!targetRepository?.gitRepoUrl) {
      return NextResponse.json(
        { success: false, message: "GitHub 저장소가 연결되어 있지 않습니다." },
        { status: 400 },
      );
    }

    const projectRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true, name: true },
    });
    const persisted = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const codeTaskPlan =
      parseImplementationCodeTaskPlanV1(body.implementationCodeTaskPlanV1) ??
      parseImplementationCodeTaskPlanV1(persisted.implementationCodeTaskPlanV1);
    const taskList =
      parseImplementationTaskListV1(body.implementationTaskListV1) ??
      parseImplementationTaskListV1(persisted.implementationTaskListV1);
    const runs =
      parseCodeTaskExecutionRunsV1(body.codeTaskExecutionRunsV1) ??
      parseCodeTaskExecutionRunsV1(persisted.codeTaskExecutionRunsV1);
    const quickRun =
      parseImplementationQuickRunV1(body.implementationQuickRunV1) ??
      parseImplementationQuickRunV1(persisted.implementationQuickRunV1);

    const bundle = await getImplementationRuntimeBundle(projectId);
    const selectedCodeTaskIds = bundle.job?.selectedCodeTaskIds ?? quickRun?.selectedCodeTaskIds ?? null;
    const storedIntegrationPlan =
      parseCodeTaskIntegrationPlanV1(persisted.codeTaskIntegrationPlanV1) ?? null;

    const baseBranch = targetRepository.defaultBranch ?? setupRow?.baseBranch ?? "main";
    const summary = buildImplementationExecutionSummaryCounts({
      projectId,
      requirementsState: persisted,
      codeTaskPlan,
      taskList,
      runs,
    });
    const integrationSteps = resolveIntegrationStepsForRuntimeSnapshot({
      requirementsState: persisted,
      codeTaskPlan,
    });
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(
      summary.runtimeSnapshot,
    );
    const pipelineContext = buildImplementationIntegrationPipelineContext({
      projectId,
      trigger: "manual_integration_button",
      baseBranch,
      snapshot: summary.runtimeSnapshot,
      codeTaskPlan,
      integrationSteps,
      createPullRequest: body.createPullRequest !== false,
    });

    const outcome = await runProjectIntegrationPipeline({
      context: pipelineContext,
      eligibility,
      repoUrl: targetRepository.gitRepoUrl,
      githubToken: token,
      codeTaskPlan,
      taskList,
      codeTaskRuns: runs,
      selectedCodeTaskIds,
      storedIntegrationPlan,
      integrationSteps,
      requirementsState: persisted,
    });

    if (!outcome.ok && !outcome.plan) {
      const apiStatus =
        outcome.status === "codetasks_incomplete" ? "codetask_completion_required" : outcome.status;
      return NextResponse.json(
        {
          success: false,
          status: apiStatus,
          previewReady: false,
          message: outcome.userSafeMessage ?? "통합 단계를 실행할 수 없습니다.",
        },
        { status: 400 },
      );
    }

    const plan = outcome.plan;
    if (!plan) {
      return NextResponse.json(
        { success: false, message: outcome.userSafeMessage ?? "통합 단계 실행에 실패했습니다." },
        { status: 400 },
      );
    }

    const timeline = appendPromptTimelineEntries(
      persisted.promptTimeline ?? [],
      outcome.timelineEntries,
    );

    const orchestrationPatch = mergeRequirementsStateJson(persisted, {
      ...(outcome.orchestrationPatch ?? {}),
      ...(outcome.previewRuntimePatch ?? {}),
      codeTaskIntegrationPlanV1: plan,
      promptTimeline: timeline,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { requirementsStateJson: orchestrationPatch as object },
    });

    const postRunSummary = buildImplementationExecutionSummaryCounts({
      projectId,
      requirementsState: orchestrationPatch,
      codeTaskPlan,
      taskList,
      runs,
      previewRuntime: parseImplementationPreviewRuntimeV1(orchestrationPatch.implementationPreviewRuntimeV1) ?? null,
    });

    return NextResponse.json({
      success: outcome.ok,
      status: outcome.status,
      message: outcome.userSafeMessage ?? (outcome.ok ? "통합 Wiring이 완료되었습니다." : "통합 단계 실행에 실패했습니다."),
      integrationBranch: outcome.integrationBranch ?? plan.integrationBranch,
      previewReady: outcome.previewReady ?? false,
      previewUrl: outcome.previewUrl ?? null,
      nextRequiredStep: outcome.nextRequiredStep ?? null,
      plan,
      timeline: outcome.timelineEntries,
      snapshot: toImplementationRuntimeSnapshotApiSummary(postRunSummary.runtimeSnapshot),
      orchestrationPatch: {
        ...(outcome.orchestrationPatch ?? {}),
        codeTaskIntegrationPlanV1: plan,
        promptTimeline: timeline,
      },
    });
  } catch (e) {
    const message = toUserSafeIntegrationErrorMessage(e);
    console.error("[integration/run-pipeline]", e instanceof Error ? e.message : e, e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

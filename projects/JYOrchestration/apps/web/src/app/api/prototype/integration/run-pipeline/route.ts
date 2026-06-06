import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { runIntegrationBranchPipeline } from "@/lib/prototype/implementationIntegrationPipelineService";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
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

    const outcome = await runIntegrationBranchPipeline({
      projectId,
      projectName: body.projectName ?? projectRow?.name ?? null,
      repoUrl: targetRepository.gitRepoUrl,
      baseBranch: targetRepository.baseBranch ?? setupRow?.baseBranch ?? "main",
      githubToken: token,
      codeTaskPlan,
      taskList,
      codeTaskRuns: runs,
      selectedCodeTaskIds,
      createPullRequest: body.createPullRequest !== false,
    });

    const timeline = appendPromptTimelineEntries(
      persisted.promptTimeline ?? [],
      outcome.timeline,
    );

    const orchestrationPatch = mergeRequirementsStateJson(persisted, {
      codeTaskIntegrationPlanV1: outcome.plan,
      promptTimeline: timeline,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { requirementsStateJson: orchestrationPatch as object },
    });

    return NextResponse.json({
      success: outcome.ok,
      message: outcome.message,
      plan: outcome.plan,
      timeline: outcome.timeline,
      orchestrationPatch: {
        codeTaskIntegrationPlanV1: outcome.plan,
        promptTimeline: timeline,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[integration/run-pipeline]", message, e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

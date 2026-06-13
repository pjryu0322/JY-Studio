import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { buildImplementationIntegrationPipelineContext } from "@/lib/prototype/implementationIntegrationPipelineContextBuilder";
import { resolveIntegrationStepsForRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { buildImplementationIntegrationPipelineEligibilityFromSnapshot } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import { summarizeCodeTaskBoardGateFromPlanAndUnits } from "@/lib/prototype/implementationIntegrationBoardGateSummary";
import { findIntegrationStep } from "@/lib/prototype/implementationIntegrationStepMutations";
import {
  evaluateIntegrationPrepareGateFromBoardSummary,
  buildBoardGateMismatchLogFields,
  logIntegrationPrepareStarted,
  isFinalWiringStepReadyForIntegrationButton,
  logIntegrationButtonGateEvaluated,
  evaluateIntegrationButtonGate,
} from "@/lib/prototype/implementationBoardIntegrationGate";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { runProjectIntegrationPipeline } from "@/lib/prototype/projectIntegrationPipelineService";
import { buildProjectIntegrationPipelinePersistState } from "@/lib/prototype/projectIntegrationPipelinePersist";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import { toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import { sanitizeIntegrationPipelineApiResponseMessage } from "@/lib/prototype/implementationIntegrationToastPolicy";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { alignProductionCodeTaskIdsInRequirementsState } from "@/lib/prototype/requirementsStateProductionCodeTaskIdAlign";
import { toImplementationRuntimeSnapshotApiSummary } from "@/lib/prototype/implementationRuntimeSnapshot";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { prisma } from "@/lib/prisma";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import {
  resolveAutoGenerationReadyFromCapabilityJson,
} from "@/lib/prototype/autoGenerationSettingsState";

export const maxDuration = 120;

type Body = Readonly<{
  readonly projectId?: string;
  readonly projectName?: string | null;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationQuickRunV1?: unknown;
  readonly createPullRequest?: boolean;
  readonly boardSelectionSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
}>;

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  githubAccessToken: true,
  githubCapabilityValidation: true,
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

    const capJson = setupRow?.githubCapabilityValidation ?? null;
    if (!resolveAutoGenerationReadyFromCapabilityJson(capJson)) {
      return NextResponse.json(
        {
          success: false,
          message: "자동 생성 기본 연결을 먼저 정상화해 주세요.",
        },
        { status: 403 },
      );
    }

    const projectRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true, name: true },
    });
    const persisted = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const taskList =
      parseImplementationTaskListV1(body.implementationTaskListV1) ??
      parseImplementationTaskListV1(persisted.implementationTaskListV1);
    const mergedForAlign: typeof persisted = {
      ...persisted,
      ...(body.implementationCodeTaskPlanV1 != null
        ? { implementationCodeTaskPlanV1: body.implementationCodeTaskPlanV1 }
        : {}),
      ...(body.codeTaskExecutionRunsV1 != null
        ? { codeTaskExecutionRunsV1: body.codeTaskExecutionRunsV1 }
        : {}),
    };
    const aligned = alignProductionCodeTaskIdsInRequirementsState({
      requirementsState: mergedForAlign,
      taskList,
    });
    const codeTaskPlan = aligned.codeTaskPlan;
    const runs = aligned.runs ?? [];

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
    const serverBoardGate = summarizeCodeTaskBoardGateFromPlanAndUnits({
      codeTaskPlan,
      units: summary.executionUnits,
      runs,
    });
    const clientBoardGate = body.boardSelectionSummary ?? null;
    const boardGateSummary = serverBoardGate;
    if (clientBoardGate) {
      const mismatchFields = buildBoardGateMismatchLogFields({
        client: clientBoardGate,
        server: serverBoardGate,
      });
      if (mismatchFields.summariesMatch === false) {
        console.info(
          JSON.stringify({
            action: "integration_board_gate_client_server_mismatch",
            projectId,
            ...mismatchFields,
          }),
        );
      }
    }

    const boardGateEval = evaluateIntegrationPrepareGateFromBoardSummary(boardGateSummary, {
      projectId,
      blockedDetails: serverBoardGate.blockedDetails,
      runnableCodeTaskIds: serverBoardGate.runnableCodeTaskIds,
    });

    const integrationStepsForGate = resolveIntegrationStepsForRuntimeSnapshot({
      requirementsState: persisted,
      codeTaskPlan,
    });
    const finalWiringStep = findIntegrationStep(integrationStepsForGate, "final_wiring");
    const finalWiringReady = isFinalWiringStepReadyForIntegrationButton(finalWiringStep?.status);
    logIntegrationButtonGateEvaluated({
      projectId,
      summary: boardGateSummary,
      selectedCount: boardGateSummary.selectedRunnableCount,
      verifiedCount: boardGateSummary.integrationReadyCount,
      finalWiringReady,
      blockReason: boardGateEval.ok ? null : "no_integration_ready_units",
      canRun: boardGateEval.ok,
      staleDetected:
        clientBoardGate != null &&
        buildBoardGateMismatchLogFields({ client: clientBoardGate, server: serverBoardGate })
          .summariesMatch === false,
    });

    if (!boardGateEval.ok) {
      return NextResponse.json(
        {
          success: false,
          status: "board_gate_blocked",
          previewReady: false,
          message: boardGateEval.message ?? "통합을 시작할 수 없습니다.",
        },
        { status: 400 },
      );
    }

    const integrationButtonGate = evaluateIntegrationButtonGate({
      summary: boardGateSummary,
      finalWiringReady,
      projectId,
      clientSummary: clientBoardGate,
    });
    if (!integrationButtonGate.canRun) {
      return NextResponse.json(
        {
          success: false,
          status: "board_gate_blocked",
          previewReady: false,
          message: integrationButtonGate.userMessage ?? "통합을 시작할 수 없습니다.",
        },
        { status: 400 },
      );
    }

    const boardGateBlockedDetails = serverBoardGate.blockedDetails;

    const integrationSteps = integrationStepsForGate;
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(
      summary.runtimeSnapshot,
      {
        boardGateSummary,
        boardGateBlockedDetails: boardGateBlockedDetails ?? serverBoardGate.blockedDetails,
      },
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

    const integrationCodeTaskIds = boardGateSummary.integrationReadyCodeTaskIds;

    if (eligibility.canRun) {
      logIntegrationPrepareStarted({
        projectId,
        integrationCodeTaskCount: integrationCodeTaskIds.length,
        integrationCodeTaskIds,
      });
    }

    const outcome = await runProjectIntegrationPipeline({
      context: pipelineContext,
      eligibility,
      repoUrl: targetRepository.gitRepoUrl,
      githubToken: token,
      codeTaskPlan,
      taskList,
      codeTaskRuns: runs,
      integrationCodeTaskIds,
      storedIntegrationPlan,
      integrationSteps,
      requirementsState: persisted,
      githubCapabilityValidation: capJson,
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

    const orchestrationPatch = buildProjectIntegrationPipelinePersistState({
      projectId,
      persisted,
      outcome,
      plan,
    });

    try {
      await prisma.project.update({
        where: { id: projectId },
        data: { requirementsStateJson: orchestrationPatch as object },
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "통합 결과를 저장하지 못했습니다. 다시 시도해 주세요.",
        },
        { status: 500 },
      );
    }

    if (outcome.executionSetupCapabilityPatch) {
      try {
        await prisma.executionSetup.update({
          where: { projectId },
          data: {
            githubCapabilityValidation: outcome.executionSetupCapabilityPatch as object,
          },
        });
      } catch {
        // capability snapshot refresh is best-effort; integration state is already persisted
      }
    }

    const postRunSummary = buildImplementationExecutionSummaryCounts({
      projectId,
      requirementsState: orchestrationPatch,
      codeTaskPlan,
      taskList,
      runs,
      previewRuntime: parseImplementationPreviewRuntimeV1(orchestrationPatch.implementationPreviewRuntimeV1) ?? null,
    });

    const snapshotRefreshLog = buildImplementationExecutionLogTimelineEntry({
      action: "project_integration_pipeline_snapshot_refreshed",
      orchestrationTraceGroup: "project_integration_pipeline",
      fields: { projectId },
    });
    const orchestrationPatchWithSnapshotLog = mergeRequirementsStateJson(orchestrationPatch, {
      promptTimeline: appendPromptTimelineEntries(orchestrationPatch.promptTimeline ?? [], [
        snapshotRefreshLog,
      ]),
    }) as typeof orchestrationPatch;
    await prisma.project.update({
      where: { id: projectId },
      data: { requirementsStateJson: orchestrationPatchWithSnapshotLog as object },
    });

    return NextResponse.json({
      success: outcome.ok,
      status: outcome.status,
      message: sanitizeIntegrationPipelineApiResponseMessage({
        status: outcome.status,
        previewReady: outcome.previewReady,
        userSafeMessage: outcome.userSafeMessage,
        ok: outcome.ok,
      }),
      integrationBranch: outcome.integrationBranch ?? plan.integrationBranch,
      previewReady: outcome.previewReady ?? false,
      previewUrl: outcome.previewUrl ?? null,
      nextRequiredStep: outcome.nextRequiredStep ?? null,
      plan,
      timeline: outcome.timelineEntries,
      snapshot: toImplementationRuntimeSnapshotApiSummary(postRunSummary.runtimeSnapshot),
      orchestrationPatch: {
        ...orchestrationPatchWithSnapshotLog,
        codeTaskIntegrationPlanV1: plan,
      },
    });
  } catch (e) {
    const message = toUserSafeIntegrationErrorMessage(e);
    console.error("[integration/run-pipeline]", e instanceof Error ? e.message : e, e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

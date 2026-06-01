import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { buildGenerateImplementationTaskListFromSeedResultWithLlm } from "@/lib/prototype/implementationTaskListGeneration";
import { resolveQuickDesignLlmServerContext } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettings.server";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationWorkItemPreflightSummaryV1 } from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";

export const maxDuration = 120;

type SyncBody = Readonly<{
  readonly seed?: ImplementationSeedV1 | null;
  readonly existingTaskList?: ImplementationTaskListV1 | null;
  readonly existingCodeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly existingExecutionState?: ImplementationTaskExecutionStateV1 | null;
  readonly existingCursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly existingPreflightSummary?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly existingQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk?: boolean;
  readonly designOk?: boolean;
  readonly previewReady?: boolean;
  readonly forceRefresh?: boolean;
  readonly forceLlm?: boolean;
}>;

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canEditProject", "POST implementation-prep/sync");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json()) as SyncBody;
    const { refinementSettings, providerContext } = await resolveQuickDesignLlmServerContext({
      projectId: pid,
      actorUserId: userId,
    });

    const result = await buildGenerateImplementationTaskListFromSeedResultWithLlm({
      projectId: pid,
      seed: body.seed,
      existingTaskList: body.existingTaskList,
      existingCodeTaskPlan: body.existingCodeTaskPlan,
      existingExecutionState: body.existingExecutionState,
      existingCursorWorkItems: body.existingCursorWorkItems,
      existingPreflightSummary: body.existingPreflightSummary,
      existingQualityGate: body.existingQualityGate,
      priorTimeline: body.priorTimeline,
      projectArtifacts: body.projectArtifacts,
      artifactOrchestrationV1: body.artifactOrchestrationV1,
      envOk: body.envOk === true,
      designOk: body.designOk === true,
      previewReady: body.previewReady === true,
      forceRefresh: body.forceRefresh,
      forceLlm: body.forceLlm,
      refinementSettings,
      providerContext,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.userMessage ?? "구현 준비 산출물을 동기화했습니다.",
      data: result,
    });
  } catch (error) {
    console.error("POST /api/projects/[projectId]/implementation-prep/sync error:", error);
    return NextResponse.json({ success: false, message: "구현 준비 동기화 중 오류가 발생했습니다." }, { status: 500 });
  }
}

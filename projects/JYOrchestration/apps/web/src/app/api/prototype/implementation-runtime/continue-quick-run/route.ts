import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { dispatchDbQueuedAutoAdvanceOnServer } from "@/lib/prototype/implementationDbQueuedExecutionUnitDispatch";
import { dispatchNextExecutionUnitOnServer } from "@/lib/prototype/implementationExecutionUnitDispatchService";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { toImplementationRuntimeSnapshotApiSummary } from "@/lib/prototype/implementationRuntimeSnapshot";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly completedCodeTaskId?: string;
  readonly completedTaskId?: string;
  readonly mode?: string;
};

const DB_QUEUED_MODES = new Set([
  "legacy_db_queued_auto_dispatch",
  "db_queued_auto_dispatch",
  "dispatch_current_queued",
  "recover_missing_server_continuation",
]);

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
        "POST /api/prototype/implementation-runtime/continue-quick-run",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const mode = String(body.mode ?? "").trim();

    if (DB_QUEUED_MODES.has(mode)) {
      const continuation = await dispatchDbQueuedAutoAdvanceOnServer({
        projectId,
        actorUserId: userId,
      });
      if (continuation.orchestrationPatch) {
        await persistTaskCursorOrchestrationToProject({
          projectId,
          orchestrationPatch: continuation.orchestrationPatch,
        });
      }
      return NextResponse.json({
        success: continuation.ok,
        outcome: continuation.outcome,
        nextTaskId: continuation.nextTaskId,
        nextCodeTaskId: continuation.nextCodeTaskId,
        reason: continuation.reason,
        diagnostics: continuation.diagnostics,
        orchestrationPatch: continuation.orchestrationPatch,
        scheduler: "execution_unit",
        mode: mode || "db_queued_auto_dispatch",
      });
    }

    const projectRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const execution = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
    const completedTaskId =
      String(body.completedTaskId ?? "").trim() || execution?.taskId?.trim() || "";
    if (!completedTaskId) {
      return NextResponse.json(
        { success: false, message: "completedTaskId를 확인할 수 없습니다." },
        { status: 400 },
      );
    }

    const continuation = await dispatchNextExecutionUnitOnServer({
      projectId,
      completedTaskId,
      completedCodeTaskId: body.completedCodeTaskId,
      sourceCommitSha: execution?.commitSha,
      actorUserId: userId,
    });

    if (continuation.orchestrationPatch) {
      await persistTaskCursorOrchestrationToProject({
        projectId,
        orchestrationPatch: continuation.orchestrationPatch,
      });
    }

    const rowAfter = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true },
    });
    const stateAfter = parseRequirementsStateJson(rowAfter?.requirementsStateJson) ?? {};
    const summary = buildImplementationExecutionSummaryCounts({
      projectId,
      requirementsState: stateAfter,
      codeTaskPlan: parseImplementationCodeTaskPlanV1(stateAfter.implementationCodeTaskPlanV1) ?? null,
      runs: parseCodeTaskExecutionRunsV1(stateAfter.codeTaskExecutionRunsV1) ?? [],
      previewRuntime: parseImplementationPreviewRuntimeV1(stateAfter.implementationPreviewRuntimeV1) ?? null,
    });

    return NextResponse.json({
      success: continuation.ok,
      outcome: continuation.outcome,
      nextCodeTaskId: continuation.nextCodeTaskId,
      reason: continuation.reason,
      orchestrationPatch: continuation.orchestrationPatch,
      scheduler: "execution_unit",
      mode: mode || "execution_unit",
      snapshot: toImplementationRuntimeSnapshotApiSummary(summary.runtimeSnapshot),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

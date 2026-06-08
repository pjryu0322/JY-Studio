import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { dispatchNextExecutionUnitOnServer } from "@/lib/prototype/implementationExecutionUnitDispatchService";
import { tryDispatchCurrentQueuedQuickRunAfterDbAdvance } from "@/lib/prototype/serverQuickRunContinuationService";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly completedCodeTaskId?: string;
  readonly completedTaskId?: string;
  readonly mode?: string;
};

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

    if (
      mode === "legacy_db_queued_auto_dispatch" ||
      mode === "db_queued_auto_dispatch" ||
      mode === "dispatch_current_queued"
    ) {
      const continuation = await tryDispatchCurrentQueuedQuickRunAfterDbAdvance({ projectId });
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
        scheduler: "legacy_db_queued",
        mode,
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
      nextCodeTaskId: continuation.nextCodeTaskId,
      reason: continuation.reason,
      orchestrationPatch: continuation.orchestrationPatch,
      scheduler: "execution_unit",
      mode: mode || "execution_unit",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

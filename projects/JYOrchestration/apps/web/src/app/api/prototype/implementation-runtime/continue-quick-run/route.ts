import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { continueSelectedCodeTaskQueueAfterAutoGate } from "@/lib/prototype/serverQuickRunContinuationService";
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

    const continuation = await continueSelectedCodeTaskQueueAfterAutoGate({
      projectId,
      completedTaskId,
      completedCodeTaskId: body.completedCodeTaskId,
      sourceCommitSha: execution?.commitSha,
      runId: execution?.cursorRunId,
    });

    return NextResponse.json({
      success: continuation.ok,
      outcome: continuation.outcome,
      nextTaskId: continuation.nextTaskId,
      nextCodeTaskId: continuation.nextCodeTaskId,
      reason: continuation.reason,
      diagnostics: continuation.diagnostics,
      orchestrationPatch: continuation.orchestrationPatch,
      mode: body.mode ?? "recover_missing_server_continuation",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

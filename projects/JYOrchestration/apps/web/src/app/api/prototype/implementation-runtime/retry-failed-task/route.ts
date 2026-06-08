import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prepareFailedExecutionUnitRetry } from "@/lib/prototype/implementationExecutionRetryService";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly codeTaskId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const codeTaskId = String(body.codeTaskId ?? "").trim();
    if (!projectId || !codeTaskId) {
      return NextResponse.json(
        { success: false, message: "projectId와 codeTaskId가 필요합니다." },
        { status: 400 },
      );
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canEditProject",
        "POST /api/prototype/implementation-runtime/retry-failed-task",
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
    const requirementsState = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};

    const result = prepareFailedExecutionUnitRetry({
      projectId,
      requirementsState,
      codeTaskId,
    });

    if (!result.ok) {
      return NextResponse.json({
        success: false,
        message: result.userMessage ?? "재실행을 준비하지 못했습니다.",
      });
    }

    const orchestrationPatch = appendPromptTimelineEntries(
      result.orchestrationPatch ?? {},
      result.timeline,
    );

    await persistTaskCursorOrchestrationToProject({
      projectId,
      orchestrationPatch,
    });

    return NextResponse.json({
      success: true,
      codeTaskId,
      message: "실패 작업 재실행을 준비했습니다. Quick Run으로 이어서 실행할 수 있습니다.",
    });
  } catch (error) {
    console.error("[implementation-runtime/retry-failed-task] POST failed:", error);
    return NextResponse.json(
      { success: false, message: "실패 작업 재실행 준비 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

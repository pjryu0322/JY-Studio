import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  pauseExecutionLoop,
  resumeExecutionLoop,
  runExecutionLoop,
} from "@/lib/executionLoop/runExecutionLoop";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type Body = {
  action?: string;
  taskId?: string;
};

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
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
      await requireProjectPermissionById(pid, userId, "canRunTask", "POST /api/projects/[projectId]/execution-loop");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      body = {};
    }

    const action = String(body.action ?? "").trim().toLowerCase();
    if (action === "pause") {
      pauseExecutionLoop(pid);
      return NextResponse.json({ success: true, message: "실행 루프가 일시정지로 표시되었습니다.", data: {} });
    }
    if (action === "resume") {
      resumeExecutionLoop(pid);
      return NextResponse.json({ success: true, message: "일시정지가 해제되었습니다.", data: {} });
    }

    const singleTaskId = typeof body.taskId === "string" ? body.taskId.trim() : undefined;
    const result = await runExecutionLoop({
      projectId: pid,
      actorUserId: userId,
      singleTaskId: singleTaskId || undefined,
    });
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      data: { steps: result.steps },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/execution-loop error:", error);
    return NextResponse.json({ success: false, message: "실행 루프 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

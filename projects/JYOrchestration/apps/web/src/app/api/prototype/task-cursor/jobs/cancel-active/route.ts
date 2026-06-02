import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { cancelActiveTaskCursorJobsForProject } from "@/lib/prototype/taskCursorExecutionJobRepository";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const projectId = String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canEditProject",
        "POST /api/prototype/task-cursor/jobs/cancel-active",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const cancelledCount = await cancelActiveTaskCursorJobsForProject({
      projectId,
      failureReason: "implementation_session_reset",
      errorMessage: "구현 세션 초기화로 실행 job을 종료했습니다.",
    });

    return NextResponse.json({ success: true, cancelledCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

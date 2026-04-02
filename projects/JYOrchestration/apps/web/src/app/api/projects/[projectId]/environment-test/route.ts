import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { runExecutionLoop } from "@/lib/executionLoop/runExecutionLoop";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  createEnvironmentTestTask,
  getLatestEnvironmentTestTask,
} from "@/lib/service/environmentConnectionTestService";

export async function GET(
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
      await requireProjectPermissionById(pid, userId, "canEditProject", "GET /api/projects/[projectId]/environment-test");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const last = await getLatestEnvironmentTestTask(pid);
    return NextResponse.json({ success: true, data: { last } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/environment-test error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

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
      await requireProjectPermissionById(pid, userId, "canEditProject", "POST /api/projects/[projectId]/environment-test");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const created = await createEnvironmentTestTask({ projectId: pid, actorUserId: userId });
    if (!created.ok) {
      return NextResponse.json({ success: false, message: created.message }, { status: 422 });
    }

    const result = await runExecutionLoop({
      projectId: pid,
      actorUserId: userId,
      singleTaskId: created.taskId,
    });

    const last = await getLatestEnvironmentTestTask(pid);

    return NextResponse.json(
      {
        success: result.ok,
        message: result.message,
        data: {
          taskId: created.taskId,
          steps: result.steps,
          last,
        },
      },
      { status: result.ok ? 200 : 422 }
    );
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/environment-test error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 실행 중 오류가 발생했습니다." }, { status: 500 });
  }
}

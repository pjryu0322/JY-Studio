import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { runExecutionLoop } from "@/lib/executionLoop/runExecutionLoop";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  createEnvironmentStage2TestTask,
  createEnvironmentTestTask,
  getLatestEnvironmentStage2TestTask,
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

    const stage = request.nextUrl.searchParams.get("stage");
    const last =
      stage === "2"
        ? await getLatestEnvironmentStage2TestTask(pid, { viewerUserId: userId })
        : await getLatestEnvironmentTestTask(pid, { viewerUserId: userId });
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

    let runStage2 = false;
    try {
      const ct = request.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const b = (await request.json()) as { stage?: number };
        if (b?.stage === 2) runStage2 = true;
      }
    } catch {
      /* empty body */
    }

    const created = runStage2
      ? await createEnvironmentStage2TestTask({ projectId: pid, actorUserId: userId })
      : await createEnvironmentTestTask({ projectId: pid, actorUserId: userId });
    if (!created.ok) {
      return NextResponse.json({ success: false, message: created.message }, { status: 422 });
    }

    const result = await runExecutionLoop({
      projectId: pid,
      actorUserId: userId,
      singleTaskId: created.taskId,
    });

    const last = runStage2
      ? await getLatestEnvironmentStage2TestTask(pid, { viewerUserId: userId })
      : await getLatestEnvironmentTestTask(pid, { viewerUserId: userId });

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

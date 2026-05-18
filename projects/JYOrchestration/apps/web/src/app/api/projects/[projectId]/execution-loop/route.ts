import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { isExecutionLoopPaused } from "@/lib/executionLoop/loopControllerState";
import {
  pauseExecutionLoop,
  resumeExecutionLoop,
  runExecutionLoop,
} from "@/lib/executionLoop/runExecutionLoop";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { buildTeamRuntimeForExecutionRun } from "@/lib/ai-team-runtime/apiTeamRuntime";
import { prisma } from "@/lib/prisma";

type Body = {
  action?: string;
  taskId?: string;
};

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
      await requireProjectPermissionById(pid, userId, "canRunTask", "GET /api/projects/[projectId]/execution-loop");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { paused: isExecutionLoopPaused(pid) },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/execution-loop error:", error);
    return NextResponse.json({ success: false, message: "실행 루프 상태 조회 중 오류가 발생했습니다." }, { status: 500 });
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
    console.info("[api] POST execution-loop", { projectId: pid, singleTaskId: singleTaskId || null });
    const result = await runExecutionLoop({
      projectId: pid,
      actorUserId: userId,
      singleTaskId: singleTaskId || undefined,
    });

    const latestRun = await prisma.taskExecutionRun.findFirst({
      where: {
        projectId: pid,
        ...(singleTaskId ? { taskId: singleTaskId } : {}),
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    const teamRuntime = await buildTeamRuntimeForExecutionRun(pid, latestRun);

    return NextResponse.json(
      {
        success: result.ok,
        message: result.message,
        data: {
          steps: result.steps,
          teamRuntime,
        },
      },
      { status: result.ok ? 200 : 422 }
    );
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/execution-loop error:", error);
    return NextResponse.json({ success: false, message: "실행 루프 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

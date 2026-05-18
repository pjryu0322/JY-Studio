import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { toTaskExecutionRunListItem } from "@/lib/ai-team-runtime/executionRunListItem";
import {
  loadRequireApprovalBeforeApply,
  loadTeamRuntimeTaskContextMap,
} from "@/lib/ai-team-runtime/apiTeamRuntime";

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
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET /api/projects/[projectId]/execution-runs");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const taskId = request.nextUrl.searchParams.get("taskId")?.trim() || undefined;
    const take = Math.min(200, Math.max(1, parseInt(request.nextUrl.searchParams.get("take") ?? "80", 10) || 80));

    const rows = await prisma.taskExecutionRun.findMany({
      where: { projectId: pid, ...(taskId ? { taskId } : {}) },
      orderBy: { createdAt: "desc" },
      take,
    });

    const [requireApproval, taskById] = await Promise.all([
      loadRequireApprovalBeforeApply(pid),
      loadTeamRuntimeTaskContextMap(
        pid,
        rows.map((r) => r.taskId)
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map((r) =>
        toTaskExecutionRunListItem(r, requireApproval, taskById.get(r.taskId) ?? null)
      ),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/execution-runs error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

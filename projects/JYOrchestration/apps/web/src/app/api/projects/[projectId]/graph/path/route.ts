import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { findProjectGraphPath } from "@/lib/project-graph/projectGraphQuery";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const fromNodeId = request.nextUrl.searchParams.get("fromNodeId")?.trim() ?? "";
    const toNodeId = request.nextUrl.searchParams.get("toNodeId")?.trim() ?? "";
    if (!fromNodeId || !toNodeId) {
      return NextResponse.json(
        { success: false, message: "fromNodeId와 toNodeId가 필요합니다." },
        { status: 400 },
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET /api/projects/[projectId]/graph/path");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const maxDepthRaw = Number(request.nextUrl.searchParams.get("maxDepth") ?? 12);
    const path = await findProjectGraphPath(pid, {
      fromNodeId,
      toNodeId,
      maxDepth: Number.isFinite(maxDepthRaw) ? maxDepthRaw : 12,
    });

    return NextResponse.json({
      success: true,
      message: path.found ? "경로를 찾았습니다." : "경로를 찾지 못했습니다.",
      data: path,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/graph/path error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

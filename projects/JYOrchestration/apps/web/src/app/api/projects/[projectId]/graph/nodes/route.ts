import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { listProjectGraphNodes } from "@/lib/project-graph/projectGraphQuery";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET /api/projects/[projectId]/graph/nodes");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const nodeType = request.nextUrl.searchParams.get("nodeType")?.trim() || undefined;
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 200);

    const nodes = await listProjectGraphNodes(pid, {
      nodeType,
      limit: Number.isFinite(limitRaw) ? limitRaw : 200,
    });

    return NextResponse.json({
      success: true,
      message: "프로젝트 그래프 노드를 조회했습니다.",
      data: { nodes },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/graph/nodes error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

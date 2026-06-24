import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { buildKnowledgeTrace } from "@/lib/project-knowledge/projectKnowledgeTraceService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string; nodeId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { projectId, nodeId } = await context.params;
    const pid = String(projectId ?? "").trim();
    const nid = String(nodeId ?? "").trim();
    if (!pid || !nid) {
      return NextResponse.json({ success: false, message: "projectId와 nodeId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(_request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET knowledge-trace");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const trace = await buildKnowledgeTrace(pid, nid);
    return NextResponse.json({
      success: true,
      data: trace,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET knowledge-trace error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

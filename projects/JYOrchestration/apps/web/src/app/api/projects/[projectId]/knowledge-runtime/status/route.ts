import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { getKnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(_request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET knowledge-runtime status");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const data = await getKnowledgeRuntimeStatusSummary(pid);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET knowledge-runtime status error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

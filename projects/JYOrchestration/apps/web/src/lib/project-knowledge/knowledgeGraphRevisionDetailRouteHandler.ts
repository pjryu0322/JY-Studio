import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { loadKnowledgeGraphRevision } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

export async function respondKnowledgeGraphRevisionDetail(
  request: NextRequest,
  projectId: string,
  revisionId: string,
): Promise<NextResponse> {
  try {
    const pid = String(projectId ?? "").trim();
    const rid = String(revisionId ?? "").trim();
    if (!pid || !rid) {
      return NextResponse.json({ success: false, message: "조회 정보가 부족합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET knowledge-graph revision");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const revision = await loadKnowledgeGraphRevision(pid, rid);
    if (!revision) {
      return NextResponse.json({ success: false, message: "해당 시점 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { revision },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET knowledge-graph revision error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

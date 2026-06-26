import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { buildUserProjectKnowledgeMemoryPreview } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import { loadUserProjectKnowledgeMemoryControlForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";

export async function GET(request: NextRequest) {
  try {
    const projectId = String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(projectId, userId, "canViewProject", "GET user-memory-preview");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const control = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
    const preview = await buildUserProjectKnowledgeMemoryPreview({
      userId,
      targetProjectId: projectId,
      control,
    });

    return NextResponse.json({ success: true, ...preview });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET user-memory-preview error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

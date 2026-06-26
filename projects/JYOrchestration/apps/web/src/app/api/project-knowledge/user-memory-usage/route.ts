import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  sanitizeUserProjectKnowledgeMemoryUsageSummaryForApi,
  summarizeUserProjectKnowledgeMemoryUsage,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import { loadUserProjectKnowledgeMemoryUsageStateForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence";

export async function GET(request: NextRequest) {
  try {
    const projectId = String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(projectId, userId, "canViewProject", "GET user-memory-usage");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const state = await loadUserProjectKnowledgeMemoryUsageStateForProject(projectId);
    const summary = sanitizeUserProjectKnowledgeMemoryUsageSummaryForApi(
      summarizeUserProjectKnowledgeMemoryUsage({ state, limit: 10 }),
    );

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET user-memory-usage error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

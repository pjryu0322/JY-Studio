import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { loadPlanningDatabaseSettingsForProject } from "@/lib/planning/planningDatabaseSettingsService";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    try {
      await requireProjectPermission(pid, userId, "canViewProject", "GET planning/database-settings");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
    const settings = await loadPlanningDatabaseSettingsForProject(pid);
    return NextResponse.json({ success: true, data: { settings } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET planning/database-settings error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

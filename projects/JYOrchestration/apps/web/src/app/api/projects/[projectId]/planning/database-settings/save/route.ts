import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  defaultPlanningDatabaseSettingsV1,
  parsePlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import { savePlanningDatabaseSettingsForProject } from "@/lib/planning/planningDatabaseSettingsService";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    try {
      await requireProjectPermission(pid, userId, "canEditProject", "POST planning/database-settings/save");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const settingsRaw = body?.settings ?? body;
    const parsed = parsePlanningDatabaseSettingsV1(settingsRaw) ?? defaultPlanningDatabaseSettingsV1();
    const password = typeof body?.password === "string" ? body.password : undefined;
    const settings = await savePlanningDatabaseSettingsForProject({
      projectId: pid,
      settings: parsed,
      password,
    });
    return NextResponse.json({ success: true, data: { settings } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST planning/database-settings/save error:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

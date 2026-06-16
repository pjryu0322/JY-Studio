import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  defaultPlanningDatabaseSettingsV1,
  parsePlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import {
  loadPlanningDatabaseSettingsForProject,
  resolvePlanningPostgresPassword,
  savePlanningDatabaseSettingsForProject,
} from "@/lib/planning/planningDatabaseSettingsService";
import { testPlanningPostgresConnection } from "@/lib/planning/planningPostgresConnectionTest";

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
      await requireProjectPermission(pid, userId, "canEditProject", "POST planning/database-settings/test");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const settingsRaw = body?.settings ?? body;
    const parsed =
      parsePlanningDatabaseSettingsV1(settingsRaw) ?? (await loadPlanningDatabaseSettingsForProject(pid));
    const passwordFromBody = typeof body?.password === "string" ? body.password.trim() : "";
    const password = passwordFromBody || (await resolvePlanningPostgresPassword(pid));

    const test = await testPlanningPostgresConnection({ settings: parsed, password: password || null });
    const nowIso = new Date().toISOString();
    const nextSettings = {
      ...parsed,
      connectionStatus: test.connectionStatus,
      lastCheckedAt: nowIso,
      lastErrorMessage: test.ok ? null : test.message,
    };
    await savePlanningDatabaseSettingsForProject({
      projectId: pid,
      settings: nextSettings,
      password: passwordFromBody || undefined,
    });
    return NextResponse.json({
      success: test.ok,
      data: { settings: nextSettings, message: test.message },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST planning/database-settings/test error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}

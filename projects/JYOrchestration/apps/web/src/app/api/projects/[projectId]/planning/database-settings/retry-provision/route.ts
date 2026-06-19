import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { retryImplementationSchemaProvision } from "@/lib/planning/retryImplementationSchemaProvision.server";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(_request);
    if (userId instanceof NextResponse) return userId;
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    try {
      await requireProjectPermission(pid, userId, "canEditProject", "POST planning/database-settings/retry-provision");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
    const result = await retryImplementationSchemaProvision(pid);
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      data: { settings: result.settings },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json({ success: false, message: "저장소 준비 재시도 중 오류가 발생했습니다." }, { status: 500 });
  }
}

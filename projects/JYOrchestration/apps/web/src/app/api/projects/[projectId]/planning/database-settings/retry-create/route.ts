import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

/** @deprecated Per-project CREATE DATABASE removed; schema is created on Quick Design confirm. */
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
      await requireProjectPermission(pid, userId, "canEditProject", "POST planning/database-settings/retry-create");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
    return NextResponse.json({
      success: false,
      message:
        "프로젝트별 Database 생성은 사용하지 않습니다. Quick Design 확정 시 Runtime Database 안에 프로젝트 schema가 생성됩니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json({ success: false, message: "다시 시도 중 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

/** Project users do not run connection tests; platform admin verifies jyorchestration + jyprojects. */
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
      await requireProjectPermission(pid, userId, "canEditProject", "POST planning/database-settings/test");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }
    return NextResponse.json({
      success: false,
      message:
        "프로젝트 환경설정에서는 연결 테스트를 제공하지 않습니다. Quick Design 확정 시 jyprojects에 프로젝트 schema가 자동 생성됩니다. DB 점검은 플랫폼 관리자 설정에서 진행합니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST planning/database-settings/test error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}

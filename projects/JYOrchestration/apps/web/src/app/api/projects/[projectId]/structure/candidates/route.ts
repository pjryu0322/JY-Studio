import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { listStructureCandidates } from "@/lib/project-structure/projectStructureQuery";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET /api/projects/[projectId]/structure/candidates");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const lifecycleStatus = request.nextUrl.searchParams.get("lifecycle")?.trim() || undefined;
    const syncFromEvents = request.nextUrl.searchParams.get("sync") === "true";

    const data = await listStructureCandidates(pid, { lifecycleStatus, syncFromEvents });

    return NextResponse.json({
      success: true,
      message: "구조 후보를 조회했습니다.",
      data,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET structure/candidates error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

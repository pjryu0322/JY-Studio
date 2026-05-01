import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { listProjectPrototypeRuns } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId 쿼리가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/prototype-runs/list");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const runs = listProjectPrototypeRuns(projectId);
  return NextResponse.json({
    success: true,
    data: {
      runs: runs.map((r) => ({
        id: r.id,
        status: r.status,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        previewUrl: r.previewUrl,
      })),
    },
  });
}

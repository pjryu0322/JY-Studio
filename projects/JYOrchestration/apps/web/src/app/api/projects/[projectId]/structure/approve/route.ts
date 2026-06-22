import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { approveStructureCandidates } from "@/lib/project-structure/projectStructureReview";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canGenerateTask", "POST /api/projects/[projectId]/structure/approve");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => null)) as { candidateIds?: string[] } | null;
    const candidateIds = Array.isArray(body?.candidateIds) ? body.candidateIds : [];
    if (candidateIds.length === 0) {
      return NextResponse.json({ success: false, message: "candidateIds가 필요합니다." }, { status: 400 });
    }

    const result = await approveStructureCandidates({
      projectId: pid,
      candidateIds,
      actorId: userId,
    });

    return NextResponse.json({
      success: true,
      message: "구조 후보를 승인했습니다.",
      data: result,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST structure/approve error:", error);
    return NextResponse.json({ success: false, message: "승인 중 오류가 발생했습니다." }, { status: 500 });
  }
}

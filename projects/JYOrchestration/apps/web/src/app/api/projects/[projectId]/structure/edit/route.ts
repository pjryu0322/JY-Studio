import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { editStructureCandidate } from "@/lib/project-structure/projectStructureReview";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canGenerateTask", "PATCH /api/projects/[projectId]/structure/edit");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => null)) as {
      candidateId?: string;
      title?: string;
      summary?: string;
    } | null;
    const candidateId = String(body?.candidateId ?? "").trim();
    if (!candidateId) {
      return NextResponse.json({ success: false, message: "candidateId가 필요합니다." }, { status: 400 });
    }

    const candidate = await editStructureCandidate({
      projectId: pid,
      candidateId,
      title: body?.title,
      summary: body?.summary,
      actorId: userId,
    });

    return NextResponse.json({
      success: true,
      message: "구조 후보를 수정했습니다.",
      data: { candidate },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    const msg = error instanceof Error ? error.message : "";
    if (msg === "CANDIDATE_NOT_FOUND" || msg === "TITLE_REQUIRED") {
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }
    console.error("PATCH structure/edit error:", error);
    return NextResponse.json({ success: false, message: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

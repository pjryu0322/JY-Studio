import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { mergeStructureCandidates } from "@/lib/project-structure/projectStructureReview";
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
      await requireProjectPermissionById(pid, userId, "canGenerateTask", "POST /api/projects/[projectId]/structure/merge");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => null)) as {
      sourceCandidateId?: string;
      targetCandidateId?: string;
    } | null;
    const sourceCandidateId = String(body?.sourceCandidateId ?? "").trim();
    const targetCandidateId = String(body?.targetCandidateId ?? "").trim();
    if (!sourceCandidateId || !targetCandidateId) {
      return NextResponse.json(
        { success: false, message: "sourceCandidateId와 targetCandidateId가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await mergeStructureCandidates({
      projectId: pid,
      sourceCandidateId,
      targetCandidateId,
      mergedByUserId: userId,
    });

    return NextResponse.json({
      success: true,
      message: "구조 후보를 병합했습니다.",
      data: result,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    const msg = error instanceof Error ? error.message : "";
    if (msg === "MERGE_SAME_CANDIDATE" || msg === "CANDIDATE_NOT_FOUND") {
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }
    console.error("POST structure/merge error:", error);
    return NextResponse.json({ success: false, message: "병합 중 오류가 발생했습니다." }, { status: 500 });
  }
}

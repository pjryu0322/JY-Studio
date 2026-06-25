import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runProjectReferenceBackfill } from "@/lib/project-knowledge/projectKnowledgeReferenceBackfillService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(_request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canEditProject", "POST knowledge/reference/backfill");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const result = await runProjectReferenceBackfill(pid);
    return NextResponse.json({
      success: true,
      message: "참조 메타데이터 보완을 실행했습니다.",
      data: {
        graphNodesScanned: result.graphNodes.scanned,
        graphNodesUpdated: result.graphNodes.updated,
        revisionsScanned: result.revisions.scanned,
        revisionsUpdated: result.revisions.updated,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST knowledge/reference/backfill error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

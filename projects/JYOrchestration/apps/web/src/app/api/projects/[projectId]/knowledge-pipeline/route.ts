import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  getLatestKnowledgePipelineRun,
  listKnowledgePipelineRuns,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? 20);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(100, Math.floor(n));
}

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
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET knowledge-pipeline");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const [latestRun, recentRuns] = await Promise.all([
      getLatestKnowledgePipelineRun(pid),
      listKnowledgePipelineRuns(pid, limit),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        run: latestRun,
        latestRun,
        recentRuns,
      },
    });
  } catch (error) {
    console.error("GET knowledge-pipeline error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

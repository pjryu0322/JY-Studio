import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { isPromptTimelineDebugServer } from "@/lib/debug/promptTimelineDebug";
import { getPromptTimelineEntries } from "@/lib/debug/promptTimelineStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

export async function GET(request: NextRequest, segmentData: { params: Promise<{ projectId: string }> }) {
  try {
    if (!isPromptTimelineDebugServer()) {
      return NextResponse.json({ success: false, message: "프롬프트 타임라인은 이 환경에서 비활성화되어 있습니다." }, { status: 404 });
    }

    const { projectId: rawId } = await segmentData.params;
    const projectId = String(rawId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/projects/[projectId]/debug/prompt-timeline");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const entries = getPromptTimelineEntries(projectId);
    return NextResponse.json({ success: true, data: { entries } });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/debug/prompt-timeline error:", error);
    return NextResponse.json({ success: false, message: "프롬프트 타임라인 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

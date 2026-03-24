import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireExecutionPipelineRead } from "@/lib/service/projectAccessGuard";
import { getProjectObservabilitySnapshot } from "@/lib/service/executionService";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "projectId가 필요합니다." },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireExecutionPipelineRead(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const data = await getProjectObservabilitySnapshot(projectId);
    if (!data) {
      return NextResponse.json(
        { success: false, message: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/project/summary error:", error);
    return NextResponse.json(
      { success: false, message: "실행 요약을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { getProjectObservabilitySnapshot } from "@/lib/service/executionService";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "projectId? ?????." },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(projectId, userId, "canViewExecution", "GET /api/project/summary");
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
        { success: false, message: "????? ?? ? ????." },
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
      { success: false, message: "?? ??? ???? ? ??? ??????." },
      { status: 500 }
    );
  }
}

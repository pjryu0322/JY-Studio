import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { executeFeaturePlanningPlannerTurn } from "@/lib/featurePlanning/featurePlanningPlannerTurnExecution";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type Body = {
  projectId?: string;
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!projectId || !message) {
      return NextResponse.json({ success: false, message: "projectId와 message가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canEditProject", "POST /api/feature-planning/chat");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const result = await executeFeaturePlanningPlannerTurn({ projectId, message });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND" ? 404 : result.code === "NO_SLOTS" || result.code === "BAD_INPUT" ? 400 : 200;
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
          ...(result.messages ? { data: { messages: result.messages } } : {}),
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        artifact: result.artifact,
        slots: result.artifact.slots,
        messages: result.messages,
        plannerMeta: result.plannerMeta,
      },
    });
  } catch (error) {
    console.error("POST /api/feature-planning/chat error:", error);
    return NextResponse.json({ success: false, message: "채팅 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

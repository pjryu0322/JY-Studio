import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { testImplementationLlmProviderConnection } from "@/lib/prototype/implementationLlmProviderConfig.server";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { projectId } = await ctx.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermissionById(pid, userId, "canEditProject", "POST implementation-llm-provider/test");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const out = await testImplementationLlmProviderConnection({
      projectId: pid,
      actorUserId: String(userId),
    });

    return NextResponse.json({
      success: out.ok,
      message: out.message,
      data: { model: out.model, providerSource: out.providerSource },
    });
  } catch (error) {
    console.error("POST implementation-llm-provider/test error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pollAiMemberActionsOnce, pollAiMemberActionsOnceForProject } from "@/lib/ai-member/aiMemberActionDispatcher";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireDispatchAiMemberActionPermission } from "@/lib/service/aiMemberActionService";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type Body = { projectId?: string };

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.AI_ACTION_DISPATCH_RUN_ONCE_SECRET?.trim();
    const headerSecret = request.headers.get("x-ai-dispatch-secret")?.trim();

    if (secret && headerSecret === secret) {
      const body = (await request.json().catch(() => ({}))) as Body;
      const projectId = String(body.projectId ?? "").trim();
      const instanceId = `run-once-secret:${Date.now()}`;
      const result = projectId
        ? await pollAiMemberActionsOnceForProject(projectId, instanceId)
        : await pollAiMemberActionsOnce(instanceId);
      return NextResponse.json({ success: true, data: { result } });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "projectId가 필요합니다. 전역 실행은 AI_ACTION_DISPATCH_RUN_ONCE_SECRET + x-ai-dispatch-secret 헤더를 사용하세요.",
        },
        { status: 400 }
      );
    }
    await requireDispatchAiMemberActionPermission(projectId, userId, "POST /api/ai-member-actions/dispatch/run-once");
    const instanceId = `run-once-user:${userId}:${Date.now()}`;
    const result = await pollAiMemberActionsOnceForProject(projectId, instanceId);
    return NextResponse.json({ success: true, data: { result } });
  } catch (error) {
    if (error instanceof ProjectAccessDeniedError) {
      return rbacErrorResponse(error) ?? NextResponse.json({ success: false, message: error.message }, { status: 403 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/ai-member-actions/dispatch/run-once error:", error);
    return NextResponse.json(
      { success: false, message: "run-once 실행 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runCodeTaskGithubPollingTick } from "@/lib/prototype/implementationCodeTaskGithubPollingService";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as { readonly projectId?: string };
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canViewProject",
        "POST /api/prototype/implementation/github-polling/tick",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const result = await runCodeTaskGithubPollingTick({ projectId });
    return NextResponse.json({
      success: true,
      checkedCount: result.checkedCount,
      passedCount: result.passedCount,
      retryCount: result.retryCount,
      failedCount: result.failedCount,
      orchestrationPatch: result.orchestrationPatch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

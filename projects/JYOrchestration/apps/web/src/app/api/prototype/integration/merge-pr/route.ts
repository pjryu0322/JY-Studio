import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { canMergeIntegrationPullRequest } from "@/lib/prototype/implementationIntegrationConflict";
import { mergeIntegrationPullRequestWithUserApproval } from "@/lib/prototype/githubIntegrationPullRequestService";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

type Body = Readonly<{ readonly projectId?: string }>;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canEditProject",
        "POST /api/prototype/integration/merge-pr",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const projectRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const plan = parseCodeTaskIntegrationPlanV1(state.codeTaskIntegrationPlanV1);
    if (!plan || !canMergeIntegrationPullRequest(plan)) {
      return NextResponse.json(
        {
          success: false,
          message: "통합 PR이 준비되지 않았거나 merge 조건을 만족하지 않습니다.",
        },
        { status: 400 },
      );
    }

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: { githubAccessToken: true },
    });
    const token = String(setupRow?.githubAccessToken ?? "").trim();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "GitHub Access Token이 설정되어 있지 않습니다." },
        { status: 503 },
      );
    }

    const merge = await mergeIntegrationPullRequestWithUserApproval({
      pullRequestUrl: String(plan.pullRequestUrl ?? ""),
      githubToken: token,
    });

    return NextResponse.json({
      success: merge.ok,
      message: merge.message,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

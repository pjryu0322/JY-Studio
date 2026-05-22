import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  bindExistingGithubRepository,
  createAndBindGithubRepository,
  prepareGitRepositoryProvisioning,
} from "@/lib/git-provisioning/gitRepositoryProvisioningService";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type ProvisionBody = {
  readonly action?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly private?: boolean;
  readonly confirmExistingRepo?: boolean;
  readonly confirmHighRiskExistingRepo?: boolean;
};

function requireOwnerAndRepo(body: ProvisionBody): { owner: string; repo: string } | NextResponse {
  const owner = String(body.owner ?? "").trim();
  const repo = String(body.repo ?? "").trim();
  if (!owner || !repo) {
    return NextResponse.json(
      {
        success: false,
        message: owner ? "GitHub repository name is required." : "GitHub owner is required.",
      },
      { status: 400 }
    );
  }
  return { owner, repo };
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canEditProject",
        "POST /api/projects/[projectId]/git-repository/provision"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    let body: ProvisionBody = {};
    try {
      body = (await request.json()) as ProvisionBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const action = String(body.action ?? "").trim();

    if (action === "prepare") {
      const ids = requireOwnerAndRepo(body);
      if (ids instanceof NextResponse) return ids;
      const result = await prepareGitRepositoryProvisioning({
        projectId: pid,
        actorUserId: userId,
        owner: ids.owner,
        repo: ids.repo,
      });
      return NextResponse.json({ success: result.ok, data: result });
    }

    if (action === "create_and_bind") {
      const ids = requireOwnerAndRepo(body);
      if (ids instanceof NextResponse) return ids;
      const result = await createAndBindGithubRepository({
        projectId: pid,
        actorUserId: userId,
        owner: ids.owner,
        repo: ids.repo,
        private: body.private !== false,
      });
      return NextResponse.json({ success: result.ok, data: result }, { status: result.ok ? 200 : 400 });
    }

    if (action === "analyze_existing") {
      const ids = requireOwnerAndRepo(body);
      if (ids instanceof NextResponse) return ids;
      const result = await bindExistingGithubRepository({
        projectId: pid,
        actorUserId: userId,
        owner: ids.owner,
        repo: ids.repo,
        mode: "analyze_only",
      });
      return NextResponse.json({ success: result.ok, data: result });
    }

    if (action === "bind_existing") {
      const ids = requireOwnerAndRepo(body);
      if (ids instanceof NextResponse) return ids;
      const result = await bindExistingGithubRepository({
        projectId: pid,
        actorUserId: userId,
        owner: ids.owner,
        repo: ids.repo,
        mode: "connect_existing",
        confirmExistingRepo: body.confirmExistingRepo === true,
        confirmHighRiskExistingRepo: body.confirmHighRiskExistingRepo === true,
      });
      return NextResponse.json({ success: result.ok, data: result }, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "action은 prepare | create_and_bind | analyze_existing | bind_existing 중 하나여야 합니다.",
      },
      { status: 400 }
    );
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST git-repository/provision error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

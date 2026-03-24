import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  createPullRequestForGitChangeRequest,
  syncPullRequestStatus,
} from "@/lib/service/githubPullRequestService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type Body = {
  gitChangeRequestId?: string;
  action?: string;
  /** MANUAL_PUSH 프로젝트에서도 PR 생성 허용 */
  relaxAutoPushPolicy?: boolean;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

/**
 * GitHub PR 생성·동기화 (git 반영·push 이후).
 * POST { gitChangeRequestId, action: "create" | "sync", relaxAutoPushPolicy? }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return jsonError("INVALID_JSON", "요청 본문이 올바른 JSON이 아닙니다.", 400);
    }

    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
    const action = String(body.action ?? "create").trim().toLowerCase();

    if (!gitChangeRequestId) {
      return jsonError("INVALID_REQUEST", "gitChangeRequestId가 필요합니다.", 400);
    }

    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { projectId: true },
    });
    if (!gcr) {
      return jsonError("NOT_FOUND", "GitChangeRequest를 찾을 수 없습니다.", 404);
    }

    try {
      await requireProjectPermissionById(gcr.projectId, userId, "canRun", "POST /api/task/git-pr");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    if (action === "sync") {
      const r = await syncPullRequestStatus({ gitChangeRequestId, actorUserId: userId });
      if (!r.ok) {
        return jsonError(r.code, r.message, r.httpStatus ?? 400);
      }
      return NextResponse.json({
        success: true,
        message: "PR 상태를 동기화했습니다.",
        data: {
          pullRequestState: r.data.pullRequestState,
          reviewStatus: r.data.reviewStatus,
          mergedAt: r.data.mergedAt?.toISOString() ?? null,
          pullRequestUrl: r.data.pullRequestUrl,
        },
      });
    }

    if (action !== "create") {
      return jsonError(
        "INVALID_ACTION",
        'action은 "create" 또는 "sync" 이어야 합니다.',
        400
      );
    }

    const r = await createPullRequestForGitChangeRequest({
      gitChangeRequestId,
      relaxAutoPushPolicy: body.relaxAutoPushPolicy === true,
      actorUserId: userId,
    });
    if (!r.ok) {
      return jsonError(r.code, r.message, r.httpStatus ?? 400);
    }

    return NextResponse.json({
      success: true,
      message: "Pull Request를 생성했습니다.",
      data: r.data,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/git-pr error:", error);
    return jsonError("INTERNAL_ERROR", "GitHub PR 처리 중 오류가 발생했습니다.", 500);
  }
}

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
  /** MANUAL_PUSH ?�로?�트?�서??PR ?�성 ?�용 */
  relaxAutoPushPolicy?: boolean;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

/**
 * GitHub PR ?�성·?�기??(git 반영·push ?�후).
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
      return jsonError("INVALID_JSON", "?�청 본문???�바�?JSON???�닙?�다.", 400);
    }

    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
    const action = String(body.action ?? "create").trim().toLowerCase();

    if (!gitChangeRequestId) {
      return jsonError("INVALID_REQUEST", "gitChangeRequestId가 ?�요?�니??", 400);
    }

    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { projectId: true },
    });
    if (!gcr) {
      return jsonError("NOT_FOUND", "GitChangeRequest�?찾을 ???�습?�다.", 404);
    }

    try {
      await requireProjectPermissionById(gcr.projectId, userId, "canViewExecution", "POST /api/task/git-pr");
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
        message: "PR ?�태�??�기?�했?�니??",
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
        'action?� "create" ?�는 "sync" ?�어???�니??',
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
      message: "Pull Request�??�성?�습?�다.",
      data: r.data,
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/git-pr error:", error);
    return jsonError("INTERNAL_ERROR", "GitHub PR 처리 �??�류가 발생?�습?�다.", 500);
  }
}

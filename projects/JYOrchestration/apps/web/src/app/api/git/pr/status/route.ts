import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { syncPullRequestStatus } from "@/lib/service/githubPullRequestService";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

/**
 * GitHub PR 상태 수동 동기화 (GET).
 * GET /api/git/pr/status?gitChangeRequestId=...
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const gitChangeRequestId =
      request.nextUrl.searchParams.get("gitChangeRequestId")?.trim() || "";
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
      await requireProjectOwnedByUser(gcr.projectId, userId, "GET /api/git/pr/status");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const r = await syncPullRequestStatus({
      gitChangeRequestId,
      actorUserId: userId,
    });
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
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/git/pr/status error:", error);
    return jsonError("INTERNAL_ERROR", "PR 상태 동기화 중 오류가 발생했습니다.", 500);
  }
}

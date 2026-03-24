import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { syncPullRequestStatus } from "@/lib/service/githubPullRequestService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

/**
 * GitHub PR ?? ?? ??? (GET).
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
      return jsonError("INVALID_REQUEST", "gitChangeRequestId? ?????.", 400);
    }

    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { projectId: true },
    });
    if (!gcr) {
      return jsonError("NOT_FOUND", "GitChangeRequest? ?? ? ????.", 404);
    }

    try {
      await requireProjectPermissionById(
        gcr.projectId,
        userId,
        "canViewExecution",
        "GET /api/git/pr/status"
      );
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
      message: "PR ??? ???????.",
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
    return jsonError("INTERNAL_ERROR", "PR ?? ??? ? ??? ??????.", 500);
  }
}

import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  GIT_GATE_ERROR_CODES,
  approveGitChangeRequest,
} from "@/lib/service/executionService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type Body = { gitChangeRequestId?: string };

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as Body;
    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
    if (!gitChangeRequestId) {
      return jsonError(
        GIT_GATE_ERROR_CODES.INVALID_REQUEST,
        "gitChangeRequestId가 ?�요?�니??",
        400
      );
    }

    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { projectId: true },
    });
    if (!gcr) {
      return jsonError(
        GIT_GATE_ERROR_CODES.NOT_FOUND,
        "?�??Git 반영 ?�청??찾을 ???�습?�다.",
        404
      );
    }

    try {
      await requireProjectPermissionById(gcr.projectId, userId, "canReviewGit", "POST /api/git/approve");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const result = await approveGitChangeRequest({
      gitChangeRequestId,
      actorUserId: userId,
    });

    if (!result.ok) {
      return jsonError(result.code, result.message, result.httpStatus);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.data,
        updatedAt: result.data.updatedAt.toISOString(),
      },
      message: "Git 반영 ?�청???�인?�었?�니??",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/git/approve error:", error);
    return jsonError(
      GIT_GATE_ERROR_CODES.INVALID_REQUEST,
      "?�인 처리 �??�류가 발생?�습?�다.",
      500
    );
  }
}

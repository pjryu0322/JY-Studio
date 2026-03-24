import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  GIT_GATE_ERROR_CODES,
  rejectGitChangeRequest,
} from "@/lib/service/executionService";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type Body = { gitChangeRequestId?: string; reason?: string | null };

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
        "gitChangeRequestId가 필요합니다.",
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
        "대상 Git 반영 요청을 찾을 수 없습니다.",
        404
      );
    }

    try {
      await requireProjectPermissionById(gcr.projectId, userId, "canApprove", "POST /api/git/reject");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const result = await rejectGitChangeRequest({
      gitChangeRequestId,
      actorUserId: userId,
      reason: body.reason,
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
      message: "Git 반영 요청이 반려되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/git/reject error:", error);
    return jsonError(
      GIT_GATE_ERROR_CODES.INVALID_REQUEST,
      "반려 처리 중 오류가 발생했습니다.",
      500
    );
  }
}

import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  GIT_GATE_ERROR_CODES,
  approveGitChangeRequest,
} from "@/lib/service/executionService";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";

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
      await requireProjectOwnedByUser(gcr.projectId, userId, "POST /api/git/approve");
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
      message: "Git 반영 요청이 승인되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/git/approve error:", error);
    return jsonError(
      GIT_GATE_ERROR_CODES.INVALID_REQUEST,
      "승인 처리 중 오류가 발생했습니다.",
      500
    );
  }
}

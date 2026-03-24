import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { enqueueExecution } from "@/lib/service/executionQueue";
import type { GitApplyExecutionPayload } from "@/lib/service/executionWorker";
import {
  GIT_APPLY_ERROR_CODES,
  listGitChangeRequestsForProject,
  serializeGitChangeRequestList,
  validateGitApplyPostEligibility,
} from "@/lib/service/executionService";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean; simulateFailure?: boolean };
  retry?: boolean;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

/** Git 요청 목록 (self-healing 필드 포함). git-request와 동일 projectId 조회이며 필드만 확장. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return jsonError(
        GIT_APPLY_ERROR_CODES.INVALID_REQUEST,
        "projectId가 필요합니다.",
        400
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectOwnedByUser(projectId, userId, "GET /api/task/git-apply");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const requests = await listGitChangeRequestsForProject(projectId, userId);

    return NextResponse.json({
      success: true,
      data: serializeGitChangeRequestList(requests),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/task/git-apply error:", error);
    return jsonError(
      GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
      "Git 반영 요청 목록 조회 중 오류가 발생했습니다.",
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as ApplyGitRequestBody;
    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
    if (!gitChangeRequestId) {
      return jsonError(
        GIT_APPLY_ERROR_CODES.INVALID_REQUEST,
        "gitChangeRequestId가 필요합니다.",
        400
      );
    }

    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: {
        projectId: true,
        taskId: true,
        status: true,
        retryCount: true,
        lastError: true,
        project: { select: { gitApprovalMode: true, gitPushMode: true } },
      },
    });
    if (!gcr) {
      return jsonError(
        GIT_APPLY_ERROR_CODES.INVALID_REQUEST,
        "대상 Git 반영 요청을 찾을 수 없습니다.",
        404
      );
    }

    try {
      await requireProjectOwnedByUser(gcr.projectId, userId, "POST /api/task/git-apply");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const modeStr = String(body.mode ?? "mock").trim() || "mock";
    const isRetry = body.retry === true;

    const policyErr = validateGitApplyPostEligibility({
      isRetry,
      gitApprovalMode: gcr.project.gitApprovalMode,
      status: gcr.status,
    });
    if (policyErr) {
      return jsonError(policyErr.code, policyErr.message, policyErr.httpStatus);
    }

    const payload: GitApplyExecutionPayload = {
      gitChangeRequestId,
      mode: modeStr,
      options: body.options,
      retry: isRetry,
      actorUserId: userId,
    };

    const enq = await enqueueExecution({
      projectId: gcr.projectId,
      type: "git-apply",
      payload,
    });

    if (!enq.queued) {
      return jsonError(
        GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
        `실행 큐 등록 실패: ${enq.reason}`,
        500
      );
    }

    return NextResponse.json({
      success: true,
      queued: true,
      jobId: enq.jobId,
      message: "Git 반영 작업이 큐에 등록되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/git-apply error:", error);
    return jsonError(
      GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
      "Git 반영 실행 중 오류가 발생했습니다.",
      500
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  applyGitChangeFromApiBody,
  GIT_APPLY_ERROR_CODES,
  listGitChangeRequestsForProject,
  serializeGitChangeRequestList,
  validateGitApplyPostEligibility,
} from "@/lib/service/executionService";
import { appendGitApplyAuditTrail } from "@/lib/service/taskHistoryService";
import {
  requireExecutionPipelineRead,
  requireGitApply,
} from "@/lib/service/projectAccessGuard";

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

    const userId = getCurrentUserIdFromRequest(request);
    try {
      await requireExecutionPipelineRead(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const requests = await listGitChangeRequestsForProject(projectId);

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
    const userId = getCurrentUserIdFromRequest(request);
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
        project: { select: { gitApprovalMode: true } },
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
      await requireGitApply(gcr.projectId, userId);
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
    const retryCountBeforeApply = gcr.retryCount;
    const lastErrorBeforeApply = gcr.lastError;

    const result = await applyGitChangeFromApiBody(body);

    const afterRow = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: {
        applyStartedAt: true,
        applyStatus: true,
        branchName: true,
        applyLog: true,
        retryCount: true,
        lastError: true,
      },
    });

    if (afterRow) {
      await appendGitApplyAuditTrail({
        actorUserId: userId,
        projectId: gcr.projectId,
        taskId: gcr.taskId,
        mode: result.ok ? String(result.data.mode) : modeStr,
        isRetry,
        retryCountBeforeApply,
        lastErrorBeforeApply,
        afterRow,
        applyOk: result.ok,
        errorCode: result.ok ? undefined : result.code,
      });
    }

    if (!result.ok) {
      return jsonError(result.code, result.message, result.httpStatus);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.data.id,
        branchName: result.data.branchName,
        applyStatus: result.data.applyStatus,
        applyLog: result.data.applyLog,
        applyStartedAt: result.data.applyStartedAt?.toISOString() ?? null,
        applyFinishedAt: result.data.applyFinishedAt?.toISOString() ?? null,
        lastRetryAt: result.data.lastRetryAt?.toISOString() ?? null,
        retryCount: result.data.retryCount,
        lastError: result.data.lastError,
        mode: result.data.mode,
      },
      message: result.message,
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

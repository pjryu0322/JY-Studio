import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { enqueueExecution } from "@/lib/service/executionQueue";
import type { GitApplyExecutionPayload } from "@/lib/service/executionWorker";
import { processExecutionJobById } from "@/lib/service/executionWorker";
import {
  GIT_APPLY_ERROR_CODES,
  listGitChangeRequestsForProject,
  serializeGitChangeRequestList,
  validateGitApplyPostEligibility,
} from "@/lib/service/executionService";
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

    await processExecutionJobById(enq.jobId);

    const jobRow = await prisma.executionJob.findUnique({
      where: { id: enq.jobId },
    });
    if (!jobRow) {
      return jsonError(
        GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
        "실행 작업을 찾을 수 없습니다.",
        500
      );
    }

    if (jobRow.status === "RUNNING" || jobRow.status === "PENDING") {
      return jsonError(
        GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
        "실행 작업이 완료되지 않았습니다.",
        500
      );
    }

    const stored = jobRow.result as
      | {
          ok: true;
          data: {
            id: string;
            branchName: string | null;
            applyStatus: string | null;
            applyLog: string | null;
            applyStartedAt: string | null;
            applyFinishedAt: string | null;
            lastRetryAt: string | null;
            retryCount: number;
            lastError: string | null;
            mode: string;
          };
          message: string;
          githubPr?: {
            phase: string;
            message?: string;
            code?: string;
            pullRequestUrl?: string;
            pullRequestNumber?: number;
          };
        }
      | {
          ok: false;
          code: string;
          message: string;
          httpStatus: number;
        }
      | null;

    if (!stored || typeof stored !== "object") {
      return jsonError(
        GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
        jobRow.error ?? "실행 결과가 없습니다.",
        500
      );
    }

    if (!stored.ok) {
      return jsonError(stored.code, stored.message, stored.httpStatus);
    }

    const githubPr = stored.githubPr;
    const prWarning =
      githubPr?.phase === "failed"
        ? `Git 반영은 완료되었지만 PR 생성에 실패했습니다. 원인: ${githubPr.message ?? "알 수 없음"}${githubPr.code ? ` (${githubPr.code})` : ""}`
        : undefined;

    const d = stored.data;
    return NextResponse.json({
      success: true,
      queued: true,
      jobId: enq.jobId,
      data: {
        id: d.id,
        branchName: d.branchName,
        applyStatus: d.applyStatus,
        applyLog: d.applyLog,
        applyStartedAt: d.applyStartedAt,
        applyFinishedAt: d.applyFinishedAt,
        lastRetryAt: d.lastRetryAt,
        retryCount: d.retryCount,
        lastError: d.lastError,
        mode: d.mode,
        projectGitApprovalMode: gcr.project.gitApprovalMode,
        projectGitPushMode: gcr.project.gitPushMode,
      },
      message: stored.message,
      ...(githubPr ? { githubPr } : {}),
      ...(prWarning ? { prWarning } : {}),
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

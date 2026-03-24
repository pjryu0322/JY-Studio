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
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean; simulateFailure?: boolean };
  retry?: boolean;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

/** Git ?�청 목록 (self-healing ?�드 ?�함). git-request?� ?�일 projectId 조회?�며 ?�드�??�장. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return jsonError(
        GIT_APPLY_ERROR_CODES.INVALID_REQUEST,
        "projectId가 ?�요?�니??",
        400
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(projectId, userId, "canViewExecution", "GET /api/task/git-apply");
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
      "Git 반영 ?�청 목록 조회 �??�류가 발생?�습?�다.",
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
        "gitChangeRequestId가 ?�요?�니??",
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
        "?�??Git 반영 ?�청??찾을 ???�습?�다.",
        404
      );
    }

    try {
      await requireProjectPermissionById(gcr.projectId, userId, "canApplyGit", "POST /api/task/git-apply");
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
        `?�행 ???�록 ?�패: ${enq.reason}`,
        500
      );
    }

    return NextResponse.json({
      success: true,
      queued: true,
      jobId: enq.jobId,
      message: "Git 반영 ?�업???�에 ?�록?�었?�니??",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/git-apply error:", error);
    return jsonError(
      GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
      "Git 반영 ?�행 �??�류가 발생?�습?�다.",
      500
    );
  }
}

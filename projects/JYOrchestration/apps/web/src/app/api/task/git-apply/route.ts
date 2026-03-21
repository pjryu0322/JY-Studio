import { NextRequest, NextResponse } from "next/server";
import {
  applyGitChangeFromApiBody,
  GIT_APPLY_ERROR_CODES,
  listGitChangeRequestsForProject,
  serializeGitChangeRequestList,
} from "@/lib/service/executionService";

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

    const requests = await listGitChangeRequestsForProject(projectId);

    return NextResponse.json({
      success: true,
      data: serializeGitChangeRequestList(requests),
    });
  } catch (error) {
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
    const body = (await request.json()) as ApplyGitRequestBody;
    const result = await applyGitChangeFromApiBody(body);

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
    console.error("POST /api/task/git-apply error:", error);
    return jsonError(
      GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
      "Git 반영 실행 중 오류가 발생했습니다.",
      500
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildApplyLogForMode,
  buildPlannedGitFlow,
  parseExecutionMode,
  type ExecutionMode,
} from "@/lib/git-apply/execution";
import { validateExecutionPrecheck } from "@/lib/git-apply/precheck";
import {
  appendSelfHealingSuccessFooter,
  buildRetryApplyLogSection,
  buildRetryPlan,
  MAX_GIT_APPLY_RETRY_COUNT,
  mergeRetryPrefixWithBody,
  shouldRetryGitApply,
} from "@/lib/git-apply/retry";
import {
  executeCursorForGitChangeRequest,
  formatCursorApplyLogFailure,
  formatCursorApplyLogSuccess,
} from "@/lib/execution/cursorExecutor";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean; simulateFailure?: boolean };
  retry?: boolean;
};

const ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  GIT_CHANGE_REQUEST_NOT_FOUND: "GIT_CHANGE_REQUEST_NOT_FOUND",
  INVALID_STATUS: "INVALID_STATUS",
  EXECUTION_PRECHECK_FAILED: "EXECUTION_PRECHECK_FAILED",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  CURSOR_EXECUTION_FAILED: "CURSOR_EXECUTION_FAILED",
  RETRY_NOT_ALLOWED: "RETRY_NOT_ALLOWED",
  RETRY_LIMIT_EXCEEDED: "RETRY_LIMIT_EXCEEDED",
} as const;

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

function buildBranchName(taskId: string): string {
  return `task-${taskId.slice(0, 8)}`;
}

function completionMessage(mode: ExecutionMode): string {
  switch (mode) {
    case "mock":
      return "Git 반영(mock) 완료";
    case "cursor":
      return "Cursor 실행 인터페이스(스텁) 처리 완료";
    case "git":
      return "Git 실행 파이프라인 완료";
    default:
      return "실행 완료";
  }
}

/** Git 요청 목록 (self-healing 필드 포함). git-request와 동일 projectId 조회이며 필드만 확장. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return jsonError(
        ERROR_CODES.INVALID_REQUEST,
        "projectId가 필요합니다.",
        400
      );
    }

    const requests = await prisma.gitChangeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        taskRunId: true,
        status: true,
        requestNote: true,
        files: true,
        diffText: true,
        commitMessage: true,
        applyStatus: true,
        applyLog: true,
        branchName: true,
        applyStartedAt: true,
        applyFinishedAt: true,
        retryCount: true,
        lastError: true,
        lastRetryAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: requests.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        applyStartedAt: item.applyStartedAt?.toISOString() ?? null,
        applyFinishedAt: item.applyFinishedAt?.toISOString() ?? null,
        lastRetryAt: item.lastRetryAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("GET /api/task/git-apply error:", error);
    return jsonError(
      ERROR_CODES.EXECUTION_FAILED,
      "Git 반영 요청 목록 조회 중 오류가 발생했습니다.",
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApplyGitRequestBody;
    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
    const mode = parseExecutionMode(body.mode);
    const requestedPush = Boolean(body.options?.push);
    const simulateCursorFailure = Boolean(body.options?.simulateFailure);
    const isRetry = body.retry === true;

    if (!gitChangeRequestId) {
      return jsonError(
        ERROR_CODES.INVALID_REQUEST,
        "gitChangeRequestId가 필요합니다.",
        400
      );
    }

    if (mode === null) {
      return jsonError(
        ERROR_CODES.INVALID_REQUEST,
        'mode는 "mock" | "cursor" | "git" 중 하나여야 합니다.',
        400
      );
    }

    const found = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: {
        id: true,
        status: true,
        taskId: true,
        projectId: true,
        commitMessage: true,
        files: true,
        diffText: true,
        applyStatus: true,
        applyLog: true,
        retryCount: true,
        lastError: true,
        lastRetryAt: true,
      },
    });

    if (!found) {
      return jsonError(
        ERROR_CODES.GIT_CHANGE_REQUEST_NOT_FOUND,
        "대상 GitChangeRequest를 찾을 수 없습니다.",
        404
      );
    }

    if (isRetry) {
      if (!shouldRetryGitApply(found)) {
        if (found.applyStatus !== "FAILED") {
          return jsonError(
            ERROR_CODES.RETRY_NOT_ALLOWED,
            "재시도는 applyStatus가 FAILED인 요청만 가능합니다.",
            400
          );
        }
        if (found.retryCount >= MAX_GIT_APPLY_RETRY_COUNT) {
          return jsonError(
            ERROR_CODES.RETRY_LIMIT_EXCEEDED,
            `재시도는 최대 ${MAX_GIT_APPLY_RETRY_COUNT}회까지 가능합니다.`,
            400
          );
        }
        return jsonError(
          ERROR_CODES.RETRY_NOT_ALLOWED,
          "재시도할 수 없는 상태입니다.",
          400
        );
      }
    } else {
      if (found.status !== "REQUESTED") {
        return jsonError(
          ERROR_CODES.INVALID_STATUS,
          "status가 REQUESTED인 요청만 실행할 수 있습니다.",
          400
        );
      }
      if (found.applyStatus === "FAILED") {
        return jsonError(
          ERROR_CODES.RETRY_NOT_ALLOWED,
          "실패한 요청은 retry=true로 재시도해 주세요.",
          400
        );
      }
      if (found.applyStatus === "DONE") {
        return jsonError(
          ERROR_CODES.RETRY_NOT_ALLOWED,
          "이미 반영이 완료된 요청입니다.",
          400
        );
      }
    }

    const nextRetryCount = isRetry ? found.retryCount + 1 : found.retryCount;
    const retryPlan = isRetry ? buildRetryPlan(nextRetryCount) : null;
    if (isRetry && !retryPlan) {
      return jsonError(
        ERROR_CODES.RETRY_LIMIT_EXCEEDED,
        "재시도 플랜을 생성할 수 없습니다.",
        400
      );
    }

    const rawCommit =
      found.commitMessage?.trim() ||
      `feat: apply task ${found.taskId}`;
    const executionCommitMessage = retryPlan
      ? `${rawCommit} ${retryPlan.commitMessageSuffix}`.trim()
      : rawCommit;

    const precheck = validateExecutionPrecheck(mode, {
      taskId: found.taskId,
      commitMessage: executionCommitMessage,
      files: found.files,
      diffText: found.diffText,
    });

    if (!precheck.ok) {
      await prisma.gitChangeRequest.update({
        where: { id: found.id },
        data: {
          applyStatus: "FAILED",
          applyLog: `[PRECHECK_FAILED] ${precheck.message}`,
          applyFinishedAt: new Date(),
          lastError: precheck.message,
        },
      });
      return jsonError(
        ERROR_CODES.EXECUTION_PRECHECK_FAILED,
        precheck.message,
        400
      );
    }

    const branchName = buildBranchName(found.taskId);
    const startedAt = new Date();

    let retryLogPrefix: string | null = null;
    let lastRetryAtForRecord: Date | null = null;

    if (isRetry && retryPlan) {
      lastRetryAtForRecord = startedAt;
      retryLogPrefix = buildRetryApplyLogSection({
        tag: retryPlan.logTag,
        retryCountAfterIncrement: nextRetryCount,
        lastRetryAt: lastRetryAtForRecord,
        previousApplyLog: found.applyLog,
        previousLastError: found.lastError,
      });
    }

    await prisma.gitChangeRequest.update({
      where: { id: found.id },
      data: {
        applyStatus: "APPLYING",
        branchName,
        applyStartedAt: startedAt,
        ...(isRetry && retryPlan && lastRetryAtForRecord
          ? {
              retryCount: nextRetryCount,
              lastRetryAt: lastRetryAtForRecord,
            }
          : {}),
      },
    });

    try {
      let applyLog: string;

      if (mode === "cursor") {
        const cursorResult = await executeCursorForGitChangeRequest({
          taskId: found.taskId,
          files: found.files,
          diffText: found.diffText,
          commitMessage: executionCommitMessage,
          simulateFailure: simulateCursorFailure,
        });

        if (!cursorResult.success) {
          const errText =
            cursorResult.error?.trim() || "Cursor 실행에 실패했습니다.";
          const failApplyLog = mergeRetryPrefixWithBody(
            retryLogPrefix,
            formatCursorApplyLogFailure(
              buildPlannedGitFlow(branchName, executionCommitMessage),
              cursorResult
            )
          );
          await prisma.gitChangeRequest.update({
            where: { id: found.id },
            data: {
              applyStatus: "FAILED",
              applyLog: failApplyLog,
              applyFinishedAt: new Date(),
              lastError: errText,
            },
          });
          return jsonError(
            ERROR_CODES.CURSOR_EXECUTION_FAILED,
            errText,
            500
          );
        }

        applyLog = formatCursorApplyLogSuccess(
          buildPlannedGitFlow(branchName, executionCommitMessage),
          cursorResult
        );
      } else {
        applyLog = await buildApplyLogForMode({
          mode,
          branchName,
          commitMessage: executionCommitMessage,
          taskId: found.taskId,
          projectId: found.projectId,
          files: found.files,
          diffText: found.diffText,
          requestedPush,
        });
      }

      applyLog = mergeRetryPrefixWithBody(retryLogPrefix, applyLog);
      const finalRetryCount = isRetry ? nextRetryCount : found.retryCount;
      applyLog = appendSelfHealingSuccessFooter(applyLog, finalRetryCount);

      const finishedAt = new Date();

      const updated = await prisma.gitChangeRequest.update({
        where: { id: found.id },
        data: {
          applyStatus: "DONE",
          applyLog,
          applyFinishedAt: finishedAt,
          lastError: null,
        },
        select: {
          id: true,
          branchName: true,
          applyStatus: true,
          applyLog: true,
          applyStartedAt: true,
          applyFinishedAt: true,
          retryCount: true,
          lastError: true,
          lastRetryAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...updated,
          mode,
          applyStartedAt: updated.applyStartedAt?.toISOString() ?? null,
          applyFinishedAt: updated.applyFinishedAt?.toISOString() ?? null,
          lastRetryAt: updated.lastRetryAt?.toISOString() ?? null,
        },
        message: completionMessage(mode),
      });
    } catch (innerError) {
      console.error("POST /api/task/git-apply pipeline error:", innerError);
      const failMsg =
        innerError instanceof Error
          ? innerError.message
          : "실행 단계에서 오류가 발생했습니다.";
      const bodyLog = `[EXECUTION_FAILED] ${failMsg}`;
      const failApplyLog = mergeRetryPrefixWithBody(retryLogPrefix, bodyLog);
      await prisma.gitChangeRequest.update({
        where: { id: found.id },
        data: {
          applyStatus: "FAILED",
          applyLog: failApplyLog,
          applyFinishedAt: new Date(),
          lastError: failMsg,
        },
      });
      return jsonError(
        ERROR_CODES.EXECUTION_FAILED,
        "Git 반영 실행 중 오류가 발생했습니다.",
        500
      );
    }
  } catch (error) {
    console.error("POST /api/task/git-apply error:", error);
    return jsonError(
      ERROR_CODES.EXECUTION_FAILED,
      "Git 반영 실행 중 오류가 발생했습니다.",
      500
    );
  }
}

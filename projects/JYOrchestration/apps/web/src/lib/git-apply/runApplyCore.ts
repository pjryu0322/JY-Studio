/**
 * Git apply POST 본문 처리 (기존 route.ts 인라인 로직과 동일).
 * API 라우트는 이 모듈에만 위임한다.
 */
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
  isManualGitApprovalMode,
  MAX_GIT_APPLY_RETRY_COUNT,
  mergeRetryPrefixWithBody,
  shouldRetryGitApply,
} from "@/lib/git-apply/retry";
import {
  executeCursorForGitChangeRequest,
  formatCursorApplyLogFailure,
  formatCursorApplyLogSuccess,
} from "@/lib/execution/cursorExecutor";

export const GIT_APPLY_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  GIT_CHANGE_REQUEST_NOT_FOUND: "GIT_CHANGE_REQUEST_NOT_FOUND",
  INVALID_STATUS: "INVALID_STATUS",
  APPROVAL_GATE_PENDING: "APPROVAL_GATE_PENDING",
  APPROVAL_NOT_GRANTED: "APPROVAL_NOT_GRANTED",
  EXECUTION_PRECHECK_FAILED: "EXECUTION_PRECHECK_FAILED",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  CURSOR_EXECUTION_FAILED: "CURSOR_EXECUTION_FAILED",
  RETRY_NOT_ALLOWED: "RETRY_NOT_ALLOWED",
  RETRY_LIMIT_EXCEEDED: "RETRY_LIMIT_EXCEEDED",
} as const;

export type RunGitApplyCoreBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean; simulateFailure?: boolean };
  retry?: boolean;
};

export type RunGitApplyCoreOk = {
  ok: true;
  data: {
    id: string;
    branchName: string | null;
    applyStatus: string | null;
    applyLog: string | null;
    applyStartedAt: Date | null;
    applyFinishedAt: Date | null;
    retryCount: number;
    lastError: string | null;
    lastRetryAt: Date | null;
    mode: ExecutionMode;
  };
  message: string;
};

export type RunGitApplyCoreErr = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type RunGitApplyCoreResult = RunGitApplyCoreOk | RunGitApplyCoreErr;

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

export async function runGitApplyCoreFromBody(
  body: RunGitApplyCoreBody
): Promise<RunGitApplyCoreResult> {
  const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
  const mode = parseExecutionMode(body.mode);
  const requestedPush = Boolean(body.options?.push);
  const simulateCursorFailure = Boolean(body.options?.simulateFailure);
  const isRetry = body.retry === true;

  if (!gitChangeRequestId) {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.INVALID_REQUEST,
      message: "gitChangeRequestId가 필요합니다.",
      httpStatus: 400,
    };
  }

  if (mode === null) {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.INVALID_REQUEST,
      message: 'mode는 "mock" | "cursor" | "git" 중 하나여야 합니다.',
      httpStatus: 400,
    };
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
      project: { select: { gitApprovalMode: true } },
    },
  });

  if (!found) {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.GIT_CHANGE_REQUEST_NOT_FOUND,
      message: "대상 GitChangeRequest를 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  const gitApprovalMode = found.project.gitApprovalMode;
  const manualApproval = isManualGitApprovalMode(gitApprovalMode);

  if (isRetry) {
    if (!shouldRetryGitApply(found, gitApprovalMode)) {
      if (found.applyStatus !== "FAILED") {
        return {
          ok: false,
          code: GIT_APPLY_ERROR_CODES.RETRY_NOT_ALLOWED,
          message: "재시도는 applyStatus가 FAILED인 요청만 가능합니다.",
          httpStatus: 400,
        };
      }
      if (found.retryCount >= MAX_GIT_APPLY_RETRY_COUNT) {
        return {
          ok: false,
          code: GIT_APPLY_ERROR_CODES.RETRY_LIMIT_EXCEEDED,
          message: `재시도는 최대 ${MAX_GIT_APPLY_RETRY_COUNT}회까지 가능합니다.`,
          httpStatus: 400,
        };
      }
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.RETRY_NOT_ALLOWED,
        message: "재시도할 수 없는 상태입니다.",
        httpStatus: 400,
      };
    }
  } else {
    if (found.status === "APPROVAL_REQUIRED") {
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.APPROVAL_NOT_GRANTED,
        message:
          "승인 대기 중입니다. 검토자가 승인한 뒤에만 Git 반영을 실행할 수 있습니다.",
        httpStatus: 403,
      };
    }
    if (found.status === "REJECTED") {
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.APPROVAL_NOT_GRANTED,
        message:
          "반려된 요청입니다. 수동 승인 모드에서는 승인 재요청 후 검토를 받아 주세요.",
        httpStatus: 403,
      };
    }
    if (manualApproval) {
      if (found.status !== "APPROVED") {
        return {
          ok: false,
          code: GIT_APPLY_ERROR_CODES.INVALID_STATUS,
          message: "승인(APPROVED)된 요청만 Git 반영을 실행할 수 있습니다.",
          httpStatus: 400,
        };
      }
    } else if (found.status !== "REQUESTED") {
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.INVALID_STATUS,
        message:
          "자동 반영 모드에서는 status가 REQUESTED인 요청만 Git 반영을 실행할 수 있습니다.",
        httpStatus: 400,
      };
    }
    if (found.applyStatus === "FAILED") {
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.RETRY_NOT_ALLOWED,
        message: "실패한 요청은 retry=true로 재시도해 주세요.",
        httpStatus: 400,
      };
    }
    if (found.applyStatus === "DONE") {
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.RETRY_NOT_ALLOWED,
        message: "이미 반영이 완료된 요청입니다.",
        httpStatus: 400,
      };
    }
  }

  const nextRetryCount = isRetry ? found.retryCount + 1 : found.retryCount;
  const retryPlan = isRetry ? buildRetryPlan(nextRetryCount) : null;
  if (isRetry && !retryPlan) {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.RETRY_LIMIT_EXCEEDED,
      message: "재시도 플랜을 생성할 수 없습니다.",
      httpStatus: 400,
    };
  }

  const rawCommit =
    found.commitMessage?.trim() || `feat: apply task ${found.taskId}`;
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
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.EXECUTION_PRECHECK_FAILED,
      message: precheck.message,
      httpStatus: 400,
    };
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
        return {
          ok: false,
          code: GIT_APPLY_ERROR_CODES.CURSOR_EXECUTION_FAILED,
          message: errText,
          httpStatus: 500,
        };
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
        status: "DONE",
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

    return {
      ok: true,
      data: {
        id: updated.id,
        branchName: updated.branchName,
        applyStatus: updated.applyStatus,
        applyLog: updated.applyLog,
        applyStartedAt: updated.applyStartedAt,
        applyFinishedAt: updated.applyFinishedAt,
        retryCount: updated.retryCount,
        lastError: updated.lastError,
        lastRetryAt: updated.lastRetryAt,
        mode,
      },
      message: completionMessage(mode),
    };
  } catch (innerError) {
    console.error("runGitApplyCoreFromBody pipeline error:", innerError);
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
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.EXECUTION_FAILED,
      message: "Git 반영 실행 중 오류가 발생했습니다.",
      httpStatus: 500,
    };
  }
}

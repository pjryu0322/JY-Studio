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
  isAutoGitPushMode,
  isManualGitApprovalMode,
  MAX_GIT_APPLY_RETRY_COUNT,
  mergeRetryPrefixWithBody,
  shouldRetryGitApply,
} from "@/lib/git-apply/retry";
import {
  executeCursorForGitChangeRequest,
  extractGcrFilePaths,
  formatCursorApplyLogFailure,
  formatCursorApplyLogSuccess,
} from "@/lib/execution/cursorExecutor";
import { formatGithubFollowUpBlock } from "@/lib/integration/githubIntegrationHints";
import {
  serializeCursorExecutionPayload,
  type CursorExecutionPayload,
} from "@/lib/integration/cursorExecutionTypes";
import { isExecutionSafeMode } from "@/lib/production/safeMode";
import { maybeAutoCreateGithubPullRequest } from "@/lib/service/githubPullRequestService";

export const GIT_APPLY_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  GIT_CHANGE_REQUEST_NOT_FOUND: "GIT_CHANGE_REQUEST_NOT_FOUND",
  INVALID_STATUS: "INVALID_STATUS",
  APPROVAL_GATE_PENDING: "APPROVAL_GATE_PENDING",
  APPROVAL_NOT_GRANTED: "APPROVAL_NOT_GRANTED",
  SAFE_MODE_FORBIDS_REAL_GIT: "SAFE_MODE_FORBIDS_REAL_GIT",
  GIT_PROJECT_APPLY_BUSY: "GIT_PROJECT_APPLY_BUSY",
  GIT_APPLY_ALREADY_IN_PROGRESS: "GIT_APPLY_ALREADY_IN_PROGRESS",
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
  /** push 성공 후 GitHub PR 자동 생성 시도 결과 (시도 없으면 skipped) */
  githubPr?: {
    phase: "skipped" | "ok" | "failed";
    pullRequestUrl?: string;
    pullRequestNumber?: number;
    code?: string;
    message?: string;
  };
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

  if (isExecutionSafeMode() && mode === "git") {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.SAFE_MODE_FORBIDS_REAL_GIT,
      message:
        "안전 모드(JY_SAFE_MODE)가 켜져 있어 실제 Git 반영 모드(git)는 사용할 수 없습니다. mock 또는 cursor를 사용하세요. (cursor는 안전 모드에서 CLI·웹훅 없이 드라이 런됩니다.)",
      httpStatus: 403,
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
      project: {
        select: {
          gitApprovalMode: true,
          gitPushMode: true,
          repoUrl: true,
          defaultBranch: true,
        },
      },
      taskRun: {
        select: {
          taskPromptId: true,
          taskPrompt: { select: { promptText: true } },
        },
      },
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

  /** 승인 게이트·GCR 상태만 (push와 무관) */
  const gitApprovalMode = found.project.gitApprovalMode;
  const manualApproval = isManualGitApprovalMode(gitApprovalMode);

  /** 원격 push 시도 여부만 (승인과 무관; gitPushMode + 명시 options.push) */
  const pushOpt = body.options?.push;
  const autoPushDefault = isAutoGitPushMode(found.project.gitPushMode);
  const requestedPush =
    pushOpt === false ? false : autoPushDefault || Boolean(pushOpt);

  const otherApplying = await prisma.gitChangeRequest.findFirst({
    where: {
      projectId: found.projectId,
      applyStatus: "APPLYING",
      id: { not: found.id },
    },
    select: { id: true },
  });
  if (otherApplying) {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.GIT_PROJECT_APPLY_BUSY,
      message:
        "이 프로젝트에서 다른 Git 반영이 이미 진행 중입니다. 완료된 뒤 다시 시도해 주세요.",
      httpStatus: 409,
    };
  }

  if (!isRetry && found.applyStatus === "APPLYING") {
    return {
      ok: false,
      code: GIT_APPLY_ERROR_CODES.GIT_APPLY_ALREADY_IN_PROGRESS,
      message: "이 Git 반영 요청은 이미 실행 중입니다. 중복 실행할 수 없습니다.",
      httpStatus: 409,
    };
  }

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
          "승인 생략(NO_APPROVAL) 모드에서는 status가 REQUESTED인 요청만 Git 반영을 실행할 수 있습니다.",
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
      const taskPromptId = found.taskRun.taskPromptId;
      const promptText = found.taskRun.taskPrompt?.promptText ?? "";
      const filePaths = extractGcrFilePaths(found.files);
      const cursorPayload: CursorExecutionPayload = {
        taskId: found.taskId,
        taskPromptId,
        projectId: found.projectId,
        branchName,
        prompt: promptText,
        context: {
          repoUrl: found.project.repoUrl ?? undefined,
          defaultBranch: found.project.defaultBranch ?? undefined,
          ...(filePaths.length > 0 ? { files: filePaths } : {}),
          diffText: found.diffText,
          commitMessage: executionCommitMessage,
        },
      };
      const payloadJson = serializeCursorExecutionPayload(cursorPayload);

      const cursorResult = await executeCursorForGitChangeRequest(
        cursorPayload,
        {
          simulateFailure: simulateCursorFailure,
          commitMessageForKeyword: executionCommitMessage,
          gcrFiles: found.files,
        }
      );

      if (!cursorResult.success) {
        const errText =
          cursorResult.error?.trim() || "Cursor 실행에 실패했습니다.";
        const lastErrorLine = cursorResult.code
          ? `${errText} (${cursorResult.code})`
          : errText;
        const failApplyLog = mergeRetryPrefixWithBody(
          retryLogPrefix,
          formatCursorApplyLogFailure(
            buildPlannedGitFlow(branchName, executionCommitMessage),
            payloadJson,
            cursorResult
          )
        );
        await prisma.gitChangeRequest.update({
          where: { id: found.id },
          data: {
            applyStatus: "FAILED",
            applyLog: failApplyLog,
            applyFinishedAt: new Date(),
            lastError: lastErrorLine,
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
        payloadJson,
        cursorResult
      );
      applyLog = [
        applyLog,
        ...formatGithubFollowUpBlock({
          branchName,
          projectRepoUrl: found.project.repoUrl,
          defaultBranch: found.project.defaultBranch,
        }),
      ].join("\n");
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
      if (mode === "git") {
        applyLog = [
          applyLog,
          ...formatGithubFollowUpBlock({
            branchName,
            projectRepoUrl: found.project.repoUrl,
            defaultBranch: found.project.defaultBranch,
          }),
        ].join("\n");
      }
    }

    applyLog = mergeRetryPrefixWithBody(retryLogPrefix, applyLog);
    const finalRetryCount = isRetry ? nextRetryCount : found.retryCount;
    applyLog = appendSelfHealingSuccessFooter(applyLog, finalRetryCount);

    const finishedAt = new Date();

    await prisma.gitChangeRequest.update({
      where: { id: found.id },
      data: {
        status: "DONE",
        applyStatus: "DONE",
        applyLog,
        applyFinishedAt: finishedAt,
        lastError: null,
      },
    });

    const prOutcome = await maybeAutoCreateGithubPullRequest({
      mode,
      requestedPush,
      applyLog,
      gitPushMode: found.project.gitPushMode,
      gitChangeRequestId: found.id,
    });

    const updated = await prisma.gitChangeRequest.findUnique({
      where: { id: found.id },
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

    if (!updated) {
      return {
        ok: false,
        code: GIT_APPLY_ERROR_CODES.GIT_CHANGE_REQUEST_NOT_FOUND,
        message: "Git 반영 후 레코드를 다시 읽지 못했습니다.",
        httpStatus: 500,
      };
    }

    let githubPr: RunGitApplyCoreOk["githubPr"];
    if (prOutcome.kind === "skipped") {
      githubPr = { phase: "skipped" };
    } else if (prOutcome.kind === "created") {
      githubPr = {
        phase: "ok",
        pullRequestUrl: prOutcome.pullRequestUrl,
        pullRequestNumber: prOutcome.pullRequestNumber,
      };
    } else {
      githubPr = {
        phase: "failed",
        code: prOutcome.code,
        message: prOutcome.message,
      };
    }

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
      githubPr,
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

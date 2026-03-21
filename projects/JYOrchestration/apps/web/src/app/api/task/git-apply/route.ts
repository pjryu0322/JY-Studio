import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildApplyLogForMode,
  buildPlannedGitFlow,
  parseExecutionMode,
  type ExecutionMode,
} from "@/lib/git-apply/execution";
import { validateExecutionPrecheck } from "@/lib/git-apply/precheck";
import {
  executeCursorForGitChangeRequest,
  formatCursorApplyLogSuccess,
} from "@/lib/execution/cursorExecutor";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean };
};

const ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  GIT_CHANGE_REQUEST_NOT_FOUND: "GIT_CHANGE_REQUEST_NOT_FOUND",
  INVALID_STATUS: "INVALID_STATUS",
  EXECUTION_PRECHECK_FAILED: "EXECUTION_PRECHECK_FAILED",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  CURSOR_EXECUTION_FAILED: "CURSOR_EXECUTION_FAILED",
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApplyGitRequestBody;
    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();
    const mode = parseExecutionMode(body.mode);
    const requestedPush = Boolean(body.options?.push);

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
      },
    });

    if (!found) {
      return jsonError(
        ERROR_CODES.GIT_CHANGE_REQUEST_NOT_FOUND,
        "대상 GitChangeRequest를 찾을 수 없습니다.",
        404
      );
    }

    if (found.status !== "REQUESTED") {
      return jsonError(
        ERROR_CODES.INVALID_STATUS,
        "status가 REQUESTED인 요청만 실행할 수 있습니다.",
        400
      );
    }

    const precheck = validateExecutionPrecheck(mode, {
      taskId: found.taskId,
      commitMessage: found.commitMessage,
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
    const safeCommitMessage = found.commitMessage || `feat: apply task ${found.taskId}`;

    await prisma.gitChangeRequest.update({
      where: { id: found.id },
      data: {
        applyStatus: "APPLYING",
        branchName,
        applyStartedAt: startedAt,
      },
    });

    try {
      let applyLog: string;

      if (mode === "cursor") {
        const cursorResult = await executeCursorForGitChangeRequest({
          taskId: found.taskId,
          files: found.files,
          diffText: found.diffText,
          commitMessage: found.commitMessage,
        });

        if (!cursorResult.success) {
          const errText =
            cursorResult.error?.trim() || "Cursor 실행에 실패했습니다.";
          await prisma.gitChangeRequest.update({
            where: { id: found.id },
            data: {
              applyStatus: "FAILED",
              applyLog: `[CURSOR_FAILED] ${errText}`,
              applyFinishedAt: new Date(),
            },
          });
          return jsonError(
            ERROR_CODES.CURSOR_EXECUTION_FAILED,
            errText,
            500
          );
        }

        applyLog = formatCursorApplyLogSuccess(
          buildPlannedGitFlow(branchName, safeCommitMessage),
          cursorResult
        );
      } else {
        applyLog = await buildApplyLogForMode({
          mode,
          branchName,
          commitMessage: safeCommitMessage,
          taskId: found.taskId,
          projectId: found.projectId,
          files: found.files,
          diffText: found.diffText,
          requestedPush,
        });
      }

      const finishedAt = new Date();

      const updated = await prisma.gitChangeRequest.update({
        where: { id: found.id },
        data: {
          applyStatus: "DONE",
          applyLog,
          applyFinishedAt: finishedAt,
        },
        select: {
          id: true,
          branchName: true,
          applyStatus: true,
          applyLog: true,
          applyStartedAt: true,
          applyFinishedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...updated,
          mode,
          applyStartedAt: updated.applyStartedAt?.toISOString() ?? null,
          applyFinishedAt: updated.applyFinishedAt?.toISOString() ?? null,
        },
        message: completionMessage(mode),
      });
    } catch (innerError) {
      console.error("POST /api/task/git-apply pipeline error:", innerError);
      const failMsg =
        innerError instanceof Error
          ? innerError.message
          : "실행 단계에서 오류가 발생했습니다.";
      await prisma.gitChangeRequest.update({
        where: { id: found.id },
        data: {
          applyStatus: "FAILED",
          applyLog: `[EXECUTION_FAILED] ${failMsg}`,
          applyFinishedAt: new Date(),
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildApplyLogForMode,
  parseExecutionMode,
  type ExecutionMode,
} from "@/lib/git-apply/execution";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
  mode?: string;
  options?: { push?: boolean };
};

function buildBranchName(taskId: string): string {
  return `task-${taskId.slice(0, 8)}`;
}

function completionMessage(mode: ExecutionMode): string {
  switch (mode) {
    case "mock":
      return "Git 반영(mock) 완료";
    case "cursor":
      return "Cursor 실행 파이프라인(스텁) 완료";
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
      return NextResponse.json(
        { success: false, message: "gitChangeRequestId가 필요합니다." },
        { status: 400 }
      );
    }

    if (mode === null) {
      return NextResponse.json(
        {
          success: false,
          message: 'mode는 "mock" | "cursor" | "git" 중 하나여야 합니다.',
        },
        { status: 400 }
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
      return NextResponse.json(
        { success: false, message: "대상 GitChangeRequest를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (found.status !== "REQUESTED") {
      return NextResponse.json(
        { success: false, message: "status가 REQUESTED인 요청만 실행할 수 있습니다." },
        { status: 400 }
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

    const applyLog = await buildApplyLogForMode({
      mode,
      branchName,
      commitMessage: safeCommitMessage,
      taskId: found.taskId,
      projectId: found.projectId,
      files: found.files,
      diffText: found.diffText,
      requestedPush,
    });

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
  } catch (error) {
    console.error("POST /api/task/git-apply error:", error);
    return NextResponse.json(
      { success: false, message: "Git 반영 실행 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

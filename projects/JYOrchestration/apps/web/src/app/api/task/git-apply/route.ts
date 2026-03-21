import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
};

function buildBranchName(taskId: string): string {
  return `task-${taskId.slice(0, 8)}`;
}

function buildStructuredApplyLog(params: {
  branchName: string;
  commitMessage: string;
}): string {
  const { branchName, commitMessage } = params;
  return [
    "[START]",
    `git checkout -b ${branchName}`,
    "apply diff...",
    `git add -A`,
    `git commit -m '${commitMessage}'`,
    `git push origin ${branchName}  (mock — 실제 push 미실행)`,
    "[END]",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApplyGitRequestBody;
    const gitChangeRequestId = String(body.gitChangeRequestId ?? "").trim();

    if (!gitChangeRequestId) {
      return NextResponse.json(
        { success: false, message: "gitChangeRequestId가 필요합니다." },
        { status: 400 }
      );
    }

    const found = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: {
        id: true,
        status: true,
        taskId: true,
        commitMessage: true,
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

    const applyLog = buildStructuredApplyLog({
      branchName,
      commitMessage: safeCommitMessage,
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
        applyStartedAt: updated.applyStartedAt?.toISOString() ?? null,
        applyFinishedAt: updated.applyFinishedAt?.toISOString() ?? null,
      },
      message: "Git 반영(mock) 완료",
    });
  } catch (error) {
    console.error("POST /api/task/git-apply error:", error);
    return NextResponse.json(
      { success: false, message: "Git 반영(mock) 실행 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

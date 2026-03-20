import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ApplyGitRequestBody = {
  gitChangeRequestId?: string;
};

function buildApplyLog(taskId: string, commitMessage: string | null): string {
  const safeMessage = commitMessage || `feat: apply task ${taskId}`;
  return [
    `git checkout -b task-${taskId.slice(0, 8)}`,
    "apply diff",
    `git commit -m '${safeMessage}'`,
    `git push origin task-${taskId.slice(0, 8)}`,
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

    await prisma.gitChangeRequest.update({
      where: { id: found.id },
      data: { applyStatus: "APPLYING" },
    });

    const applyLog = buildApplyLog(found.taskId, found.commitMessage);

    const updated = await prisma.gitChangeRequest.update({
      where: { id: found.id },
      data: {
        applyStatus: "DONE",
        applyLog,
      },
      select: {
        id: true,
        applyStatus: true,
        applyLog: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
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

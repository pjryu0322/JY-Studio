import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import {
  requireProjectMember,
  requireTaskPromptCreate,
} from "@/lib/service/projectAccessGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

type CreateTaskPromptBody = {
  taskId?: string;
};

function buildTaskExecutionPrompt(task: {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  projectSpecUploadId: string;
}) {
  return `# Task 실행 프롬프트

## 작업명
${task.name}

## 목표
${task.description || "Task 설명이 비어 있으므로, ProjectSpec 문맥을 기준으로 작업 목표를 구체화하세요."}

## 수정 범위 제한
- 프로젝트 범위: projects/JYOrchestration 내부만 수정
- 다른 모노레포 프로젝트 수정 금지
- 루트 설정 변경 금지

## 완료 기준
- Task 요구사항을 충족하는 코드 변경
- 타입/린트 오류 없음
- 변경 영향 범위 최소화

## 고정 제약
- projectId: ${task.projectId}
- projectSpecUploadId: ${task.projectSpecUploadId}
- taskId: ${task.id}
- OpenAI/Cursor/Git 자동 실행 기능 추가 금지`;
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "projectId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const userId = getCurrentUserIdFromRequest(request);
    try {
      await requireProjectMember(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const prompts = await prisma.taskPrompt.findMany({
      where: { projectId },
      orderBy: [{ taskId: "asc" }, { version: "desc" }],
      distinct: ["taskId"],
      select: {
        id: true,
        taskId: true,
        projectId: true,
        promptText: true,
        version: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: prompts.map((prompt) => ({
        ...prompt,
        createdAt: prompt.createdAt.toISOString(),
        updatedAt: prompt.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/task/prompt error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Task 프롬프트 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
    const body = (await request.json()) as CreateTaskPromptBody;
    const taskId = String(body.taskId ?? "").trim();
    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "taskId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        name: true,
        description: true,
        projectId: true,
        projectSpecUploadId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: "대상 Task를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    try {
      await requireTaskPromptCreate(task.projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const promptText = buildTaskExecutionPrompt(task);
    const { saved, nextVersion, isRevision } = await prisma.$transaction(async (tx) => {
      const latest = await tx.taskPrompt.findFirst({
        where: { taskId: task.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;
      const isRevision = nextVersion > 1;

      await tx.taskPrompt.updateMany({
        where: { taskId: task.id, status: "READY" },
        data: { status: "UPDATED" },
      });

      const created = await tx.taskPrompt.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          promptText,
          version: nextVersion,
          status: "READY",
        },
        select: {
          id: true,
          taskId: true,
          projectId: true,
          promptText: true,
          version: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { saved: created, nextVersion, isRevision };
    });

    try {
      await appendTaskHistory({
        projectId: task.projectId,
        taskId: task.id,
        actorType: TaskHistoryActorType.USER,
        actorId: userId,
        eventType: isRevision
          ? TaskHistoryEventType.PROMPT_REVISED
          : TaskHistoryEventType.PROMPT_CREATED,
        summary: isRevision
          ? `프롬프트 개정 (v${nextVersion})`
          : `프롬프트 생성 (v${nextVersion})`,
        detailJson: {
          promptVersion: nextVersion,
          promptText,
          status: saved.status,
        },
      });
    } catch (historyError) {
      console.error("Task prompt history append failed:", historyError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: saved.id,
        taskId: saved.taskId,
        projectId: saved.projectId,
        promptText: saved.promptText,
        version: saved.version,
        status: saved.status,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      },
      message: "Task 실행 프롬프트가 생성되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/prompt error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Task 프롬프트 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

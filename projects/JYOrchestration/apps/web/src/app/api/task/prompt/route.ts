import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
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

const DEMO_APP_ROOT = "apps/web/src/app/note-demo";
const DEMO_COMPONENTS = "apps/web/src/components/note-demo";

function formatSpecContext(parsedJson: unknown): string {
  if (parsedJson == null || typeof parsedJson !== "object") {
    return "(ProjectSpec 요약 없음 — Task 설명만 따르세요.)";
  }
  const p = parsedJson as Record<string, unknown>;
  const overview = typeof p.projectOverview === "string" ? p.projectOverview.trim() : "";
  const features = Array.isArray(p.mainFeatures)
    ? p.mainFeatures.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
  const constraints = Array.isArray(p.constraints)
    ? p.constraints.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
  const lines: string[] = [];
  if (overview) {
    lines.push(`- 제품·아이디어 요약: ${overview.slice(0, 800)}`);
  }
  if (features.length > 0) {
    lines.push(`- 기능·문장 목록:\n${features.map((f) => `  - ${f}`).join("\n")}`);
  }
  if (constraints.length > 0) {
    lines.push(`- 제약·주의:\n${constraints.map((c) => `  - ${c}`).join("\n")}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(ProjectSpec 필드가 비어 있습니다.)";
}

function buildTaskExecutionPrompt(
  task: {
    id: string;
    name: string;
    description: string | null;
    projectId: string;
    projectSpecUploadId: string;
  },
  specContext: string
) {
  return `# Task 실행 프롬프트 (Cursor에서 그대로 실행 가능하도록 작성됨)

## 작업명
${task.name}

## 이번 Task에서 할 일
${task.description || "Task 설명이 비어 있으면, 아래 ProjectSpec 요약과 작업명만으로 목표를 구체화하세요."}

## ProjectSpec 맥락 (사용자가 올린 아이디어에서 추출)
${specContext}

## 구현 위치 (이 저장소 기준)
- 데모·샘플 UI는 Next.js App Router 아래에 둡니다: \`${DEMO_APP_ROOT}/\`
- 재사용 컴포넌트: \`${DEMO_COMPONENTS}/\` (없으면 생성)
- JYOrchestration 본체(프로젝트 목록·권한·Git 파이프라인)는 깨지지 않게 두고, 위 경로에 **메모 앱 UI·로직**을 만듭니다.

## 수정 범위 제한
- 모노레포에서 **projects/JYOrchestration** 아래만 변경 (다른 프로젝트 디렉터리 수정 금지)
- 루트 package.json·타 프로젝트 건드리지 않기
- “오케스트레이션 자동 실행기” 같은 메타 기능은 새로 넣지 않기

## 완료 기준 (반드시 확인)
- \`pnpm\` / \`npm\` 기준으로 **타입 오류·린트 오류 없음**
- 로그인·저장이 요구된 Task면: **입력 검증**(빈 비밀번호, 저장 실패 시 사용자 메시지)까지 포함
- 새 페이지는 \`${DEMO_APP_ROOT}/page.tsx\`에서 라우팅 가능하게 연결

## 메타 (시스템 ID — 삭제 금지)
- projectId: ${task.projectId}
- projectSpecUploadId: ${task.projectSpecUploadId}
- taskId: ${task.id}
`;
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

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
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
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
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

    const specUpload = task
      ? await prisma.projectSpecUpload.findUnique({
          where: { id: task.projectSpecUploadId },
          select: { parsedJson: true },
        })
      : null;

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

    const specContext = formatSpecContext(specUpload?.parsedJson ?? null);
    const promptText = buildTaskExecutionPrompt(task, specContext);
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

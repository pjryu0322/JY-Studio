import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import {
  requireProjectPermissionById,
  requireTaskPermission,
} from "@/lib/service/taskOwnershipGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import {
  formatSpecContextFromParsedJson,
  formatSpecContextFromWorkspaceMarkdown,
} from "@/lib/project-spec/taskSpecContextFormat";

type CreateTaskPromptBody = {
  taskId?: string;
};

const DEMO_APP_ROOT = "apps/web/src/app/note-demo";
const DEMO_COMPONENTS = "apps/web/src/components/note-demo";

function buildTaskExecutionPrompt(
  task: {
    id: string;
    name: string;
    description: string | null;
    projectId: string;
    projectSpecUploadId: string | null;
    sourceSpecVersionId: string | null;
  },
  specContext: string
) {
  return `# Task ?�행 ?�롬?�트 (Cursor?�서 그�?�??�행 가?�하?�록 ?�성??

## ?�업�?
${task.name}

## ?�번 Task?�서 ????
${task.description || "Task ?�명??비어 ?�으�? ?�래 ProjectSpec ?�약�??�업명만?�로 목표�?구체?�하?�요."}

## ProjectSpec 맥락 (?�용?��? ?�린 ?�이?�어?�서 추출)
${specContext}

## 구현 ?�치 (???�?�소 기�?)
- ?�모·?�플 UI??Next.js App Router ?�래???�니?? \`${DEMO_APP_ROOT}/\`
- ?�사??컴포?�트: \`${DEMO_COMPONENTS}/\` (?�으�??�성)
- JYOrchestration 본체(?�로?�트 목록·권한·Git ?�이?�라????깨�?지 ?�게 ?�고, ??경로??**메모 ??UI·로직**??만듭?�다.

## ?�정 범위 ?�한
- 모노?�포?�서 **projects/JYOrchestration** ?�래�?변�?(?�른 ?�로?�트 ?�렉?�리 ?�정 금�?)
- 루트 package.json·?� ?�로?�트 건드리�? ?�기
- ?�오케?�트?�이???�동 ?�행기�?같�? 메�? 기능?� ?�로 ?��? ?�기

## ?�료 기�? (반드???�인)
- \`pnpm\` / \`npm\` 기�??�로 **?�???�류·린트 ?�류 ?�음**
- 로그?�·�??�이 ?�구??Task�? **?�력 검�?*(�?비�?번호, ?�???�패 ???�용??메시지)까�? ?�함
- ???�이지??\`${DEMO_APP_ROOT}/page.tsx\`?�서 ?�우??가?�하�??�결

## 메�? (?�스??ID ????�� 금�?)
- projectId: ${task.projectId}
- projectSpecUploadId: ${task.projectSpecUploadId ?? "(없음 — 워크스페이스 Spec)"}
- sourceSpecVersionId: ${task.sourceSpecVersionId ?? "(없음)"}
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
          message: "projectId가 ?�요?�니??",
        },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(projectId, userId, "canViewProject", "GET /api/task/prompt");
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
        message: "Task ?�롬?�트 조회 �??�류가 발생?�습?�다.",
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
          message: "taskId가 ?�요?�니??",
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
        sourceSpecVersionId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: "?�??Task�?찾을 ???�습?�다.",
        },
        { status: 404 }
      );
    }

    try {
      await requireTaskPermission(task.id, userId, "canCreatePrompt", "POST /api/task/prompt");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let specContext: string;
    if (task.projectSpecUploadId) {
      const specUpload = await prisma.projectSpecUpload.findUnique({
        where: { id: task.projectSpecUploadId },
        select: { parsedJson: true },
      });
      specContext = formatSpecContextFromParsedJson(specUpload?.parsedJson ?? null);
    } else if (task.sourceSpecVersionId) {
      const ver = await prisma.projectSpecVersion.findUnique({
        where: { id: task.sourceSpecVersionId },
        select: { markdown: true },
      });
      specContext = formatSpecContextFromWorkspaceMarkdown(ver?.markdown ?? null);
    } else {
      specContext = formatSpecContextFromParsedJson(null);
    }
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
          ? `?�롬?�트 개정 (v${nextVersion})`
          : `?�롬?�트 ?�성 (v${nextVersion})`,
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
      message: "Task ?�행 ?�롬?�트가 ?�성?�었?�니??",
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
        message: "Task ?�롬?�트 ?�성 �??�류가 발생?�습?�다.",
      },
      { status: 500 }
    );
  }
}

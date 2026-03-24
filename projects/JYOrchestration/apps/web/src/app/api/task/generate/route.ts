import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  beginnerFriendlyTaskTitle,
  orderFeaturesForImplementation,
} from "@/lib/project-spec/mockSpecExtract";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";
import { TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";

type GenerateTaskBody = {
  projectSpecUploadId?: string;
};

function toTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function buildMockTasks(parsedJson: unknown) {
  const parsed = (parsedJson ?? {}) as Record<string, unknown>;
  const projectOverview =
    typeof parsed.projectOverview === "string" ? parsed.projectOverview.trim() : "";
  const mainFeatures = orderFeaturesForImplementation(toTextArray(parsed.mainFeatures));
  const constraints = toTextArray(parsed.constraints);

  const taskSeeds: Array<{ name: string; description: string }> = [];

  if (projectOverview) {
    taskSeeds.push({
      name: "① 아이디어·화면 범위 잡기",
      description: `무엇을 만들지 한눈에 보이게 정리합니다. 개요: ${projectOverview.slice(0, 220)}`,
    });
  }

  if (mainFeatures.length > 0) {
    mainFeatures.forEach((feature, index) => {
      taskSeeds.push({
        name: beginnerFriendlyTaskTitle(feature, index),
        description: `다음 요구를 구현합니다: ${feature}`,
      });
    });
  }

  if (constraints.length > 0) {
    constraints.forEach((constraint, index) => {
      taskSeeds.push({
        name: `주의할 점 반영 ${index + 1}`,
        description: `요구사항에 맞게 반영: ${constraint}`,
      });
    });
  }

  if (taskSeeds.length === 0) {
    taskSeeds.push(
      {
        name: "① 만들 제품 범위 정하기",
        description: "ProjectSpec에 무엇을 만들지 적어 두었는지 확인하고, 화면 단위로 나눕니다.",
      },
      {
        name: "② 핵심 화면·기능 만들기",
        description: "사용자가 가장 먼저 쓰는 화면과 동작부터 구현합니다.",
      },
      {
        name: "③ 저장·오류 처리 다듬기",
        description: "데이터가 남는지, 잘못 입력했을 때 안내가 있는지 확인합니다.",
      }
    );
  }

  return taskSeeds;
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
      await requireProjectOwnedByUser(projectId, userId, "GET /api/task/generate");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        projectId: true,
        projectSpecUploadId: true,
        name: true,
        description: true,
        status: true,
        order: true,
        parentTaskId: true,
        taskKind: true,
        changeReason: true,
        createdAt: true,
        updatedAt: true,
        histories: {
          where: {
            eventType: TaskHistoryEventType.AUTO_HEALING_AUTO_RUN_TRIGGERED,
          },
          select: { eventType: true, detailJson: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: tasks.map((task) => {
        const { histories, ...rest } = task;
        return {
          ...rest,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          histories: histories.map((h) => ({
            eventType: h.eventType,
            detailJson: h.detailJson ?? undefined,
          })),
        };
      }),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/task/generate error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Task 목록 조회 중 오류가 발생했습니다.",
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
    const body = (await request.json()) as GenerateTaskBody;
    const projectSpecUploadId = String(body.projectSpecUploadId ?? "").trim();
    if (!projectSpecUploadId) {
      return NextResponse.json(
        {
          success: false,
          message: "projectSpecUploadId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const upload = await prisma.projectSpecUpload.findUnique({
      where: { id: projectSpecUploadId },
      select: {
        id: true,
        projectId: true,
        parsedJson: true,
        project: { select: { ownerUserId: true } },
      },
    });

    if (!upload) {
      return NextResponse.json(
        {
          success: false,
          message: "대상 ProjectSpecUpload를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (!upload.parsedJson) {
      return NextResponse.json(
        {
          success: false,
          message: "parsedJson이 없어 Task를 생성할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    try {
      await requireProjectOwnedByUser(upload.projectId, userId, "POST /api/task/generate");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const taskSeeds = buildMockTasks(upload.parsedJson);

    await prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          projectSpecUploadId: upload.id,
        },
      });

      await tx.task.createMany({
        data: taskSeeds.map((seed, index) => ({
          projectId: upload.projectId,
          ownerUserId: upload.project.ownerUserId,
          projectSpecUploadId: upload.id,
          name: seed.name,
          description: seed.description,
          status: "TODO",
          order: index + 1,
        })),
      });
    });

    const tasks = await prisma.task.findMany({
      where: { projectSpecUploadId: upload.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        projectId: true,
        projectSpecUploadId: true,
        name: true,
        description: true,
        status: true,
        order: true,
        parentTaskId: true,
        taskKind: true,
        changeReason: true,
        createdAt: true,
        updatedAt: true,
        histories: {
          where: {
            eventType: TaskHistoryEventType.AUTO_HEALING_AUTO_RUN_TRIGGERED,
          },
          select: { eventType: true, detailJson: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        count: tasks.length,
        items: tasks.map((task) => {
          const { histories, ...rest } = task;
          return {
            ...rest,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            histories: histories.map((h) => ({
              eventType: h.eventType,
              detailJson: h.detailJson ?? undefined,
            })),
          };
        }),
      },
      message: "Task가 생성되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/generate error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Task 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

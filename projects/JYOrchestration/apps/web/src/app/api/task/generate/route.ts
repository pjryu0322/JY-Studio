import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  beginnerFriendlyTaskTitle,
  orderFeaturesForImplementation,
} from "@/lib/project-spec/mockSpecExtract";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
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
      name: "�?� �??이�??�?�·�??면 �?�?? �?�기",
      description: `무�??�? �?�?��? �??�??�?� 보이�? �?리�?��??�?�. �?�??: ${projectOverview.slice(0, 220)}`,
    });
  }

  if (mainFeatures.length > 0) {
    mainFeatures.forEach((feature, index) => {
      taskSeeds.push({
        name: beginnerFriendlyTaskTitle(feature, index),
        description: `�?��? �??구를 구�??�?��??�?�: ${feature}`,
      });
    });
  }

  if (constraints.length > 0) {
    constraints.forEach((constraint, index) => {
      taskSeeds.push({
        name: `주�?�?� 점 �?�?� ${index + 1}`,
        description: `�??구�?��?��?� �?�? �?�?�: ${constraint}`,
      });
    });
  }

  if (taskSeeds.length === 0) {
    taskSeeds.push(
      {
        name: "�?� �?�?� �?�?? �?�?? �?�??기",
        description: "ProjectSpec�?� 무�??�? �?�?��? 적�?� �?��??�??�? �??인�??고, �??면 �?��??�? �??�??�??�?�.",
      },
      {
        name: "�?� �?��?� �??면·기�?� �?�?�기",
        description: "�?��?��?��? �?�?� 먼�? �?��?? �??면과 �?�??�?�?� 구�??�?��??�?�.",
      },
      {
        name: "�?� �?�?�·�?��? �?리 �?��?�기",
        description: "데이�?��? �?��??�?, �??못 �??력�??�? �?? �??�?��? �??�??�? �??인�?��??�?�.",
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
          message: "projectId�? �??�??�?��??�?�.",
        },
        { status: 400 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(
        projectId,
        userId,
        "canGenerateTask",
        "GET /api/task/generate"
      );
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
        message: "Task 목록 조�?? �? �?��?�? �?�?��??�?��??�?�.",
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
          message: "projectSpecUploadId�? �??�??�?��??�?�.",
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
          message: "�??�?� ProjectSpecUpload를 찾�? �?? �??�?��??�?�.",
        },
        { status: 404 }
      );
    }

    if (!upload.parsedJson) {
      return NextResponse.json(
        {
          success: false,
          message: "parsedJson이 �??�?� Task를 �?��?��?� �?? �??�?��??�?�.",
        },
        { status: 400 }
      );
    }

    try {
      await requireProjectPermissionById(
        upload.projectId,
        userId,
        "canGenerateTask",
        "POST /api/task/generate"
      );
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
      message: "Task�? �?��?��?�??�?��??�?�.",
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
        message: "Task �?��?� �? �?��?�? �?�?��??�?��??�?�.",
      },
      { status: 500 }
    );
  }
}

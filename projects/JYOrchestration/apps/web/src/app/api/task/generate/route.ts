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

void beginnerFriendlyTaskTitle;
void orderFeaturesForImplementation;

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
  void request;
  return NextResponse.json(
    {
      success: false,
      message:
        "업로드 기반 Task 생성 API는 비활성화되었습니다. Project Spec 워크스페이스에서 스펙을 확정한 뒤 Task Draft 생성을 사용하세요.",
      code: "LEGACY_UPLOAD_FLOW_DISABLED",
    },
    { status: 410 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  requireExecutionPipelineRead,
  requireTaskGenerate,
} from "@/lib/service/projectAccessGuard";

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
  const mainFeatures = toTextArray(parsed.mainFeatures);
  const constraints = toTextArray(parsed.constraints);

  const taskSeeds: Array<{ name: string; description: string }> = [];

  if (projectOverview) {
    taskSeeds.push({
      name: "프로젝트 초기 구조 설계",
      description: `ProjectOverview 기반 초기 설계: ${projectOverview.slice(0, 180)}`,
    });
  }

  if (mainFeatures.length > 0) {
    mainFeatures.forEach((feature, index) => {
      taskSeeds.push({
        name: `핵심 기능 구현 ${index + 1}`,
        description: `Feature 반영 작업: ${feature}`,
      });
    });
  }

  if (constraints.length > 0) {
    constraints.forEach((constraint, index) => {
      taskSeeds.push({
        name: `제약조건 반영 ${index + 1}`,
        description: `Constraint 반영 작업: ${constraint}`,
      });
    });
  }

  if (taskSeeds.length === 0) {
    taskSeeds.push(
      {
        name: "프로젝트 초기 구조 설계",
        description: "ProjectSpec 기반 초기 구조를 정의합니다.",
      },
      {
        name: "핵심 기능 구현",
        description: "ProjectSpec에 명시된 핵심 기능 구현 범위를 정리합니다.",
      },
      {
        name: "제약조건 반영",
        description: "ProjectSpec 제약조건을 개발 계획에 반영합니다.",
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

    const userId = getCurrentUserIdFromRequest(request);
    await requireExecutionPipelineRead(projectId, userId);

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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: tasks.map((task) => ({
        ...task,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
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
    const userId = getCurrentUserIdFromRequest(request);
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

    await requireTaskGenerate(upload.projectId, userId);

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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        count: tasks.length,
        items: tasks.map((task) => ({
          ...task,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        })),
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

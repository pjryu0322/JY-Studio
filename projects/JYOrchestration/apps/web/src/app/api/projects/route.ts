import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

type ApiFailure = {
  success: false;
  message: string;
  data: null;
};

function ok<T>(message: string, data: T, status = 200) {
  const payload: ApiSuccess<T> = { success: true, message, data };
  return NextResponse.json(payload, { status });
}

function fail(message: string, status: number) {
  const payload: ApiFailure = { success: false, message, data: null };
  return NextResponse.json(payload, { status });
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return ok("프로젝트 목록 조회에 성공했습니다.", projects);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return fail("프로젝트 목록 조회 중 오류가 발생했습니다.", 500);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error("POST /api/projects invalid json:", error);
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }

  try {
    const payload = (body ?? {}) as Record<string, unknown>;
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "").trim() || null;
    const projectType = String(payload.projectType ?? "web-service").trim();
    const repoUrl = String(payload.repoUrl ?? "").trim() || null;
    const defaultBranch = String(payload.defaultBranch ?? "main").trim() || "main";

    if (!name) {
      return fail("프로젝트명은 필수입니다.", 400);
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        projectType,
        repoUrl,
        defaultBranch,
        status: "ACTIVE",
      },
    });

    return ok("프로젝트가 생성되었습니다.", project, 201);
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return fail("프로젝트 생성 중 오류가 발생했습니다.", 500);
  }
}

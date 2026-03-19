import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "프로젝트 목록 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const description = body.description ? String(body.description) : null;
    const projectType = String(body.projectType || "web-service").trim();
    const repoUrl = body.repoUrl ? String(body.repoUrl) : null;
    const defaultBranch = body.defaultBranch
      ? String(body.defaultBranch)
      : "main";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "프로젝트명은 필수입니다.",
        },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "프로젝트 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
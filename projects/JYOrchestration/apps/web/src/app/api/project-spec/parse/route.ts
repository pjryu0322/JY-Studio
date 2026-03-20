import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ParseRequestBody = {
  projectSpecUploadId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ParseRequestBody;
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
    });

    if (!upload) {
      return NextResponse.json(
        {
          success: false,
          message: "대상 업로드 레코드를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const contentText = (upload.contentText || "").trim();
    if (!contentText) {
      const failed = await prisma.projectSpecUpload.update({
        where: { id: projectSpecUploadId },
        data: {
          parseStatus: "FAILED",
          parsedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          data: {
            id: failed.id,
            parseStatus: failed.parseStatus,
            parsedAt: failed.parsedAt?.toISOString() ?? null,
            hasParsedJson: false,
          },
          message: "파싱할 원문(contentText)이 없어 mock parsing에 실패했습니다.",
        },
        { status: 400 }
      );
    }

    const projectOverview = contentText.slice(0, 200);
    const parsedJson = {
      projectOverview,
      mainFeatures: [] as string[],
      constraints: [] as string[],
      techStack: [] as string[],
    };

    const updated = await prisma.projectSpecUpload.update({
      where: { id: projectSpecUploadId },
      data: {
        parsedJson,
        parseStatus: "SUCCESS",
        parsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        parseStatus: updated.parseStatus,
        parsedAt: updated.parsedAt?.toISOString() ?? null,
        hasParsedJson: Boolean(updated.parsedJson),
      },
      message: "ProjectSpec mock parsing이 완료되었습니다.",
    });
  } catch (error) {
    console.error("POST /api/project-spec/parse error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "mock parsing 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

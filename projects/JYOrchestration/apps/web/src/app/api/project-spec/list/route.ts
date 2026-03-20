import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function mapUploadRecord(record: {
  id: string;
  projectId: string;
  sourceType: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  contentText: string | null;
  status: string;
  createdAt: Date;
}) {
  const contentStored = Boolean(record.contentText && record.contentText.trim().length > 0);
  return {
    id: record.id,
    projectId: record.projectId,
    originalFileName: record.originalFileName,
    fileType: record.fileType || "application/octet-stream",
    fileSize: record.fileSize,
    sourceType: record.sourceType,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    contentStored,
  };
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

    const uploads = await prisma.projectSpecUpload.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: uploads.map(mapUploadRecord),
    });
  } catch (error) {
    console.error("GET /api/project-spec/list error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "업로드 메타데이터 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

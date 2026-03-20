import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function mapUploadRecord(record: {
  id: string;
  projectId: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: record.id,
    projectId: record.projectId,
    fileName: record.originalFileName,
    fileType: record.fileType || "application/octet-stream",
    fileSize: record.fileSize,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const queryProjectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    const formData = await request.formData();
    const file = formData.get("file");
    const formProjectId = String(formData.get("projectId") ?? "").trim();
    const projectId = formProjectId || queryProjectId;

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "업로드할 파일이 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "projectId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const saved = await prisma.projectSpecUpload.create({
      data: {
        projectId,
        originalFileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
      },
    });

    return NextResponse.json({
      success: true,
      data: mapUploadRecord(saved),
      message: "ProjectSpec 업로드 메타데이터가 등록되었습니다.",
    });
  } catch (error) {
    console.error("POST /api/project-spec/upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "업로드 요청 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

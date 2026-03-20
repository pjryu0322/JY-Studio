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

function inferSourceType(file: File) {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (name.endsWith(".md") || type.includes("markdown")) {
    return "MARKDOWN";
  }
  if (name.endsWith(".docx")) {
    return "DOCX";
  }
  if (name.endsWith(".doc")) {
    return "DOC";
  }
  if (type.startsWith("text/")) {
    return "TEXT";
  }
  return "UNKNOWN";
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

    const sourceType = inferSourceType(file);
    let contentText: string | null = null;

    // Save raw text only for markdown/text files in this phase.
    if (sourceType === "MARKDOWN" || sourceType === "TEXT") {
      try {
        contentText = await file.text();
      } catch (error) {
        console.error("Failed to read source text from upload:", error);
      }
    }

    const saved = await prisma.projectSpecUpload.create({
      data: {
        projectId,
        sourceType,
        originalFileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        contentText,
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

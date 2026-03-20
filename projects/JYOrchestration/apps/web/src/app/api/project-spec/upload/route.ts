import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "업로드할 파일이 필요합니다.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
      },
      message: "업로드 API 뼈대가 정상 동작했습니다.",
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

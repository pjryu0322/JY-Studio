import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_UPLOAD_FLOW_DISABLED",
      message: "업로드 이력 조회 API는 비활성화되었습니다.",
      data: [],
    },
    { status: 410 }
  );
}

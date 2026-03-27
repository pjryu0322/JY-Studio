import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_UPLOAD_FLOW_DISABLED",
      message: "업로드 기반 Project Spec API는 비활성화되었습니다.",
    },
    { status: 410 }
  );
}

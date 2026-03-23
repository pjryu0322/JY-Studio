import { NextResponse } from "next/server";
import { isExecutionSafeMode } from "@/lib/production/safeMode";

/** 클라이언트 배너용 공개 런타임 플래그 (비밀 값 없음). */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      executionSafeMode: isExecutionSafeMode(),
    },
  });
}

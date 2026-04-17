import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { pingOpenAiModelsList } from "@/lib/project/requirementsAiFacilitatorOpenAI";

/**
 * 요구사항 화면용: OpenAI API 키 존재 및 최소 네트워크 검증(모델 목록 1건).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireSessionUserId(request);
    if (gate instanceof NextResponse) {
      return gate;
    }

    const ping = await pingOpenAiModelsList();
    if (!ping.ok) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          code: ping.code,
          message: ping.message,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        code: "OK",
        message: "OpenAI API에 연결되었습니다.",
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/requirements/ai-connection error:", error);
    return NextResponse.json(
      { success: false, message: "연결 상태 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { listMessengerPromptTimelineEntriesForUser } from "@/lib/debug/promptTimelineStore";

/** 로그인 사용자 본인의 메신저 등 OpenAI 호출 타임라인(DB). */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const entries = await listMessengerPromptTimelineEntriesForUser(userId);
    return NextResponse.json({ success: true, data: { entries } });
  } catch (error) {
    console.error("GET /api/me/debug/prompt-timeline error:", error);
    return NextResponse.json({ success: false, message: "프롬프트 타임라인 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

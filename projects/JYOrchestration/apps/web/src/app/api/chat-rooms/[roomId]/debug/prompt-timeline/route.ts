import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { listMessengerPromptTimelineEntriesForRoom } from "@/lib/debug/promptTimelineStore";
import { assertChatRoomAccess, ChatRoomAccessError } from "@/lib/service/chatRoomService";

export async function GET(request: NextRequest, segmentData: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId: rawId } = await segmentData.params;
    const roomId = String(rawId ?? "").trim();
    if (!roomId) {
      return NextResponse.json({ success: false, message: "roomId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await assertChatRoomAccess(roomId, userId);
    } catch (e) {
      if (e instanceof ChatRoomAccessError) {
        return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
      }
      throw e;
    }

    const entries = await listMessengerPromptTimelineEntriesForRoom(roomId);
    return NextResponse.json({ success: true, data: { entries } });
  } catch (error) {
    console.error("GET /api/chat-rooms/[roomId]/debug/prompt-timeline error:", error);
    return NextResponse.json({ success: false, message: "프롬프트 타임라인 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

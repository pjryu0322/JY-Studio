import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { assertChatRoomAccess, ChatRoomAccessError, clearChatRoomConversation } from "@/lib/service/chatRoomService";

export async function POST(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    await assertChatRoomAccess(roomId, userId);
    await clearChatRoomConversation(roomId, userId);
    return NextResponse.json({ success: true, data: { cleared: true } });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("POST clear-conversation", e);
    return NextResponse.json({ success: false, message: "대화 초기화에 실패했습니다." }, { status: 500 });
  }
}

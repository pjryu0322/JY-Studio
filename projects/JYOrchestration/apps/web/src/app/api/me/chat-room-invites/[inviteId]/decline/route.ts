import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { declineChatRoomMemberInvite } from "@/lib/service/chatRoomMemberInviteService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ inviteId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const { inviteId } = await context.params;
    const id = String(inviteId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "inviteId가 필요합니다." }, { status: 400 });
    }
    const result = await declineChatRoomMemberInvite({ inviteId: id, sessionUserId: userId });
    if (!result.ok) {
      return NextResponse.json({ success: false, message: "참여 요청을 찾을 수 없거나 이미 처리되었습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "참여 요청을 거절했습니다." });
  } catch (error) {
    console.error("POST chat-room-invites decline error:", error);
    return NextResponse.json({ success: false, message: "거절 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { ChatRoomAccessError, leaveChatRoomAsMember } from "@/lib/service/chatRoomService";

export async function POST(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    const result = await leaveChatRoomAsMember(roomId, userId);
    return NextResponse.json({
      success: true,
      message: "대화방에서 나갔습니다.",
      data: { roomDeleted: result.roomDeleted },
    });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    if (e instanceof Error && e.message === "PROJECT_LINKED_CANNOT_LEAVE_ALONE") {
      return NextResponse.json(
        {
          success: false,
          message: "프로젝트에 연결된 대화방에서는 혼자 남은 상태로 나갈 수 없습니다. 개설자에게 삭제를 요청하거나 프로젝트 연결을 해제해 주세요.",
        },
        { status: 400 }
      );
    }
    if (e instanceof Error && e.message === "NOT_A_MEMBER") {
      return NextResponse.json({ success: false, message: "참여 멤버가 아닙니다." }, { status: 400 });
    }
    console.error("POST /api/chat-rooms/[roomId]/leave", e);
    return NextResponse.json({ success: false, message: "나가기 처리에 실패했습니다." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { buildMessengerTranscriptForLlm } from "@/lib/messenger/chatMessageToRequirementsMessage";
import {
  assertChatRoomAccess,
  ChatRoomAccessError,
  executeMessengerAiTurnForRoom,
  listChatMessages,
  messengerRoomShouldRunAiAfterUserMessage,
} from "@/lib/service/chatRoomService";

export async function POST(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    const room = await assertChatRoomAccess(roomId, userId);
    const rows = await listChatMessages(roomId, userId);
    const transcript = buildMessengerTranscriptForLlm(rows);
    if (transcript.length === 0) {
      return NextResponse.json({ success: false, message: "먼저 메시지를 입력해 주세요." }, { status: 400 });
    }
    const last = transcript[transcript.length - 1];
    if (last.role !== "user") {
      return NextResponse.json({ success: false, message: "AI 응답을 이어가려면 사용자 메시지가 마지막이어야 합니다." }, { status: 400 });
    }
    let lastUserText = "";
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.senderType === "USER") {
        lastUserText = r.content;
        break;
      }
    }
    if (!messengerRoomShouldRunAiAfterUserMessage(room, lastUserText)) {
      return NextResponse.json(
        {
          success: false,
          message:
            room.aiParticipationMode === "NONE"
              ? "이 방은 AI 응답 없이 메모만 작성하는 모드입니다."
              : "이 방은 @@AI기획자 또는 @@기획자가 있을 때만 AI가 응답합니다.",
        },
        { status: 400 }
      );
    }
    const result = await executeMessengerAiTurnForRoom(roomId, userId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, data: { code: result.code } },
        { status: result.code === "NO_KEY" ? 400 : 502 }
      );
    }
    return NextResponse.json({ success: true, data: { model: result.model } });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("POST ai-turn", e);
    return NextResponse.json({ success: false, message: "AI 응답을 생성하지 못했습니다." }, { status: 500 });
  }
}

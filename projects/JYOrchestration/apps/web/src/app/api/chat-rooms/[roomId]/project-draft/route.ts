import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { runMessengerProjectDraft } from "@/lib/messenger/messengerLlm";
import { assertChatRoomAccess, ChatRoomAccessError, listChatMessages, saveProjectFromChatDraft } from "@/lib/service/chatRoomService";

export async function POST(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    const room = await assertChatRoomAccess(roomId, userId);
    const rows = await listChatMessages(roomId, userId);
    const lines = rows
      .filter((r) => r.senderType !== "SYSTEM")
      .map((r) => {
        const who = r.senderType === "USER" ? "사용자" : "AI";
        return `[${who}] ${r.content.trim()}`;
      });
    const transcript = lines.join("\n\n");
    if (!transcript.trim()) {
      return NextResponse.json({ success: false, message: "대화 내용이 없습니다." }, { status: 400 });
    }
    const draft = await runMessengerProjectDraft({
      userId,
      transcript,
      logContext: { roomId: room.id, roomTitle: room.title, projectId: room.projectId },
    });
    if (!draft.ok) {
      return NextResponse.json(
        { success: false, message: draft.message, data: { code: draft.code } },
        { status: draft.code === "NO_KEY" ? 400 : 502 }
      );
    }
    const row = await saveProjectFromChatDraft({ roomId, userId, payload: draft.payload });
    return NextResponse.json({
      success: true,
      data: {
        draftId: row.id,
        payload: draft.payload,
        model: draft.model,
      },
    });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("POST project-draft", e);
    return NextResponse.json({ success: false, message: "프로젝트 초안을 만들지 못했습니다." }, { status: 500 });
  }
}

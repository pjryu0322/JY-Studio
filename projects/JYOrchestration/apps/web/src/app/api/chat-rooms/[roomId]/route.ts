import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { parseMessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import {
  ChatRoomAccessError,
  deleteChatRoomForOwner,
  getChatRoomDetail,
  updateChatRoomTitle,
  updateMessengerRoomAiParticipation,
} from "@/lib/service/chatRoomService";

export async function GET(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    const { room, members } = await getChatRoomDetail(roomId, userId);
    return NextResponse.json({
      success: true,
      data: {
        room: {
          id: room.id,
          title: room.title,
          type: room.type,
          ownerUserId: room.ownerUserId,
          aiParticipationMode: room.aiParticipationMode,
          projectId: room.projectId,
          lastMessagePreview: room.lastMessagePreview,
          updatedAt: room.updatedAt.toISOString(),
        },
        members: members.map((m) => ({
          id: m.id,
          memberType: m.memberType,
          userId: m.userId,
          aiMemberId: m.aiMemberId,
          displayName: m.displayName,
          role: m.role,
        })),
      },
    });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("GET /api/chat-rooms/[roomId]", e);
    return NextResponse.json({ success: false, message: "대화방을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "요청 형식 오류" }, { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;
  const hasTitleKey = Object.prototype.hasOwnProperty.call(o, "title");
  const titleTrimmed = hasTitleKey ? String(o.title ?? "").trim().replace(/\s+/g, " ") : "";
  const hasModeKey = Object.prototype.hasOwnProperty.call(o, "aiParticipationMode");
  const mode = hasModeKey ? parseMessengerAiMode(o.aiParticipationMode) : null;

  if (!hasTitleKey && !hasModeKey) {
    return NextResponse.json({ success: false, message: "title 또는 aiParticipationMode를 보내 주세요." }, { status: 400 });
  }
  if (hasTitleKey && !titleTrimmed) {
    return NextResponse.json({ success: false, message: "대화방 제목을 입력해 주세요." }, { status: 400 });
  }
  if (hasModeKey && mode === null) {
    return NextResponse.json({ success: false, message: "aiParticipationMode 값이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    if (hasTitleKey) {
      await updateChatRoomTitle({ roomId, userId, title: titleTrimmed });
    }
    if (hasModeKey && mode !== null) {
      await updateMessengerRoomAiParticipation({ roomId, userId, nextMode: mode });
    }
    const { room, members } = await getChatRoomDetail(roomId, userId);
    return NextResponse.json({
      success: true,
      data: {
        room: {
          id: room.id,
          title: room.title,
          type: room.type,
          ownerUserId: room.ownerUserId,
          aiParticipationMode: room.aiParticipationMode,
          projectId: room.projectId,
          lastMessagePreview: room.lastMessagePreview,
          updatedAt: room.updatedAt.toISOString(),
        },
        members: members.map((m) => ({
          id: m.id,
          memberType: m.memberType,
          userId: m.userId,
          aiMemberId: m.aiMemberId,
          displayName: m.displayName,
          role: m.role,
        })),
      },
    });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    if (e instanceof Error && e.message === "PROJECT_LINKED") {
      return NextResponse.json(
        { success: false, message: "프로젝트에 연결된 대화방은 AI 참여 방식을 바꿀 수 없습니다." },
        { status: 400 }
      );
    }
    if (e instanceof Error && e.message === "TITLE_TOO_LONG") {
      return NextResponse.json({ success: false, message: "제목은 200자 이내로 입력해 주세요." }, { status: 400 });
    }
    if (e instanceof Error && e.message === "TITLE_EMPTY") {
      return NextResponse.json({ success: false, message: "대화방 제목을 입력해 주세요." }, { status: 400 });
    }
    console.error("PATCH /api/chat-rooms/[roomId]", e);
    return NextResponse.json({ success: false, message: "설정을 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    await deleteChatRoomForOwner(roomId, userId);
    return NextResponse.json({ success: true, message: "대화방이 삭제되었습니다." });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    if (e instanceof Error && e.message === "PROJECT_LINKED") {
      return NextResponse.json(
        { success: false, message: "프로젝트에 연결된 대화방은 삭제할 수 없습니다." },
        { status: 400 }
      );
    }
    console.error("DELETE /api/chat-rooms/[roomId]", e);
    return NextResponse.json({ success: false, message: "대화방을 삭제하지 못했습니다." }, { status: 500 });
  }
}

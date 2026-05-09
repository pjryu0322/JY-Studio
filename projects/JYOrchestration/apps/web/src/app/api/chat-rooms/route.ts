import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { parseMessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import { createMessengerChatRoom, createMessengerGroupChatRoom, listChatRoomsForUser } from "@/lib/service/chatRoomService";

export async function GET(request: Request) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  try {
    const rooms = await listChatRoomsForUser(userId);
    return NextResponse.json({
      success: true,
      data: {
        rooms: rooms.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          aiParticipationMode: r.aiParticipationMode,
          lastMessagePreview: r.lastMessagePreview,
          updatedAt: r.updatedAt.toISOString(),
          projectId: r.projectId,
          isOwner: r.ownerUserId === userId,
        })),
      },
    });
  } catch (e) {
    console.error("GET /api/chat-rooms", e);
    return NextResponse.json({ success: false, message: "대화방 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const o = (body ?? {}) as Record<string, unknown>;
  const roomTypeRaw = String(o.roomType ?? "").trim().toUpperCase();
  const title = typeof o.title === "string" ? o.title : null;
  const participantRaw = o.participantUserIds;
  const participantUserIds = Array.isArray(participantRaw)
    ? participantRaw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  try {
    if (roomTypeRaw === "GROUP") {
      const groupMode = parseMessengerAiMode(o.aiParticipationMode) ?? "NONE";
      if (groupMode !== "NONE") {
        return NextResponse.json(
          { success: false, message: "친구 Chat 방은 AI 참여 없음(NONE)만 지원합니다." },
          { status: 400 }
        );
      }
      if (participantUserIds.length === 0) {
        return NextResponse.json({ success: false, message: "함께할 친구를 한 명 이상 선택해 주세요." }, { status: 400 });
      }
      const { room } = await createMessengerGroupChatRoom(userId, { participantUserIds, title });
      return NextResponse.json(
        {
          success: true,
          message: "대화방이 생성되었습니다.",
          data: {
            id: room.id,
            title: room.title,
            type: room.type,
            aiParticipationMode: room.aiParticipationMode,
            updatedAt: room.updatedAt.toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const roomType = roomTypeRaw === "SOLO" || roomTypeRaw === "DIRECT" ? (roomTypeRaw as "SOLO" | "DIRECT") : null;
    const mode = parseMessengerAiMode(o.aiParticipationMode);
    const resolvedMode = mode ?? "AUTO";
    const resolvedType = roomType ?? (resolvedMode === "NONE" ? "SOLO" : "DIRECT");
    if (resolvedMode === "NONE" && resolvedType !== "SOLO") {
      return NextResponse.json({ success: false, message: "혼자 메모 방은 roomType SOLO 여야 합니다." }, { status: 400 });
    }
    if (resolvedMode !== "NONE" && resolvedType !== "DIRECT") {
      return NextResponse.json({ success: false, message: "AI 참여 방은 roomType DIRECT 여야 합니다." }, { status: 400 });
    }
    const { room } = await createMessengerChatRoom(userId, {
      roomType: resolvedType,
      aiParticipationMode: resolvedMode,
      title,
    });
    return NextResponse.json(
      {
        success: true,
        message: "대화방이 생성되었습니다.",
        data: {
          id: room.id,
          title: room.title,
          type: room.type,
          aiParticipationMode: room.aiParticipationMode,
          updatedAt: room.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_ROOM_SHAPE") {
      return NextResponse.json({ success: false, message: "roomType과 aiParticipationMode 조합이 올바르지 않습니다." }, { status: 400 });
    }
    if (e instanceof Error && e.message === "PARTICIPANTS_REQUIRED") {
      return NextResponse.json({ success: false, message: "함께할 친구를 한 명 이상 지정해 주세요." }, { status: 400 });
    }
    if (e instanceof Error && e.message === "INVALID_PARTICIPANT") {
      return NextResponse.json(
        { success: false, message: "선택한 사용자를 찾을 수 없거나 비활성 계정입니다." },
        { status: 400 }
      );
    }
    if (e instanceof Error && e.message === "TOO_MANY_PARTICIPANTS") {
      return NextResponse.json({ success: false, message: "한 번에 초대할 수 있는 인원 수를 초과했습니다." }, { status: 400 });
    }
    console.error("POST /api/chat-rooms", e);
    return NextResponse.json({ success: false, message: "대화방을 만들지 못했습니다." }, { status: 500 });
  }
}

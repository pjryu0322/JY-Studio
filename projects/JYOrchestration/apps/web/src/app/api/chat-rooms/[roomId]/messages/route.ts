import { NextResponse } from "next/server";
import { getPlatformAiMemberById } from "@/lib/ai/platformAiMembers";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { chatMessagesToRequirementsMessages } from "@/lib/messenger/chatMessageToRequirementsMessage";
import { messengerMentionTokensFromText } from "@/lib/messenger/messengerAiParticipation";
import { MESSENGER_DEFAULT_AI_CATALOG_KEY } from "@/lib/messenger/messengerConstants";
import { prisma } from "@/lib/prisma";
import {
  appendChatMessage,
  assertChatRoomAccess,
  ChatRoomAccessError,
  executeMessengerAiTurnForRoom,
  listChatMessages,
  messengerRoomShouldRunAiAfterUserMessage,
} from "@/lib/service/chatRoomService";

export async function GET(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;
  try {
    const rows = await listChatMessages(roomId, userId);
    const messages = chatMessagesToRequirementsMessages(rows);
    return NextResponse.json({ success: true, data: { messages } });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("GET messages", e);
    return NextResponse.json({ success: false, message: "메시지를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
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
  const kind = String(o.kind ?? "user").trim().toLowerCase();
  const content = String(o.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ success: false, message: "메시지 내용이 필요합니다." }, { status: 400 });
  }
  try {
    if (kind === "ai_work_note_summary") {
      if (content.length > 50_000) {
        return NextResponse.json({ success: false, message: "요약 본문이 너무 깁니다." }, { status: 400 });
      }
      const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
      const msg = await appendChatMessage({
        roomId,
        userId,
        senderType: "AI",
        senderId: MESSENGER_DEFAULT_AI_CATALOG_KEY,
        senderName: ai?.name ?? "AI 기획자",
        content,
        metadata: { source: "work_note_summarize" },
      });
      return NextResponse.json({
        success: true,
        data: {
          message: {
            id: msg.id,
            createdAt: msg.createdAt.toISOString(),
          },
        },
      });
    }

    const u = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, name: true } });
    const displayName = String(u?.nickname ?? u?.name ?? "나").trim() || "나";
    const mentionTokens = messengerMentionTokensFromText(content);
    const msg = await appendChatMessage({
      roomId,
      userId,
      senderType: "USER",
      senderId: userId,
      senderName: displayName,
      content,
      metadata:
        mentionTokens.length > 0
          ? { mentions: mentionTokens as unknown as string[], source: "user_compose" }
          : { source: "user_compose" },
    });
    const room = await assertChatRoomAccess(roomId, userId);
    let aiRan = false;
    let aiError: string | null = null;
    if (messengerRoomShouldRunAiAfterUserMessage(room, content)) {
      const aiResult = await executeMessengerAiTurnForRoom(roomId, userId);
      if (aiResult.ok) {
        aiRan = true;
      } else {
        aiError = aiResult.message;
      }
    }
    return NextResponse.json({
      success: true,
      data: {
        message: {
          id: msg.id,
          createdAt: msg.createdAt.toISOString(),
        },
        aiRan,
        ...(aiError ? { aiError } : {}),
      },
    });
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("POST messages", e);
    return NextResponse.json({ success: false, message: "메시지를 저장하지 못했습니다." }, { status: 500 });
  }
}

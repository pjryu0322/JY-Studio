import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { ChatRoomAccessError } from "@/lib/service/chatRoomService";
import {
  createChatRoomMemberInvite,
  listPendingChatRoomMemberInvites,
} from "@/lib/service/chatRoomMemberInviteService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const { roomId } = await context.params;
    const data = await listPendingChatRoomMemberInvites(String(roomId ?? ""), userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("GET member-invites error:", error);
    return NextResponse.json({ success: false, message: "참여 요청 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const { roomId } = await context.params;
    const body = (await request.json()) as { inviteeUserId?: string };
    const inviteeUserId = String(body.inviteeUserId ?? "").trim();
    if (!inviteeUserId) {
      return NextResponse.json({ success: false, message: "inviteeUserId가 필요합니다." }, { status: 400 });
    }

    const result = await createChatRoomMemberInvite({
      roomId: String(roomId ?? ""),
      inviterUserId: userId,
      inviteeUserId,
    });

    if (result.outcome === "NOT_FRIEND") {
      return NextResponse.json({
        success: false,
        outcome: result.outcome,
        message: "친구 목록에 있는 사용자에게만 참여 요청을 보낼 수 있습니다.",
      }, { status: 400 });
    }
    if (result.outcome === "ALREADY_MEMBER") {
      return NextResponse.json({
        success: true,
        outcome: result.outcome,
        message: "이미 이 대화방에 참여 중입니다.",
      });
    }
    if (result.outcome === "INVITE_PENDING") {
      return NextResponse.json({
        success: true,
        outcome: result.outcome,
        message: "이미 참여 요청을 보냈습니다.",
      });
    }

    return NextResponse.json({
      success: true,
      outcome: result.outcome,
      message: "참여 요청을 보냈습니다.",
      data: { inviteId: result.inviteId },
    });
  } catch (error) {
    if (error instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 403 });
    }
    if (error instanceof Error && error.message === "PROJECT_LINKED") {
      return NextResponse.json({ success: false, message: "프로젝트에 연결된 대화방은 초대할 수 없습니다." }, { status: 400 });
    }
    console.error("POST member-invites error:", error);
    return NextResponse.json({ success: false, message: "참여 요청 중 오류가 발생했습니다." }, { status: 500 });
  }
}

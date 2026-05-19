import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { addMessengerFriend, listMessengerFriends, removeMessengerFriend } from "@/lib/service/messengerFriendService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const data = await listMessengerFriends(userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/me/messenger-friends error:", error);
    return NextResponse.json({ success: false, message: "친구 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const body = (await request.json()) as { friendUserId?: string; userIds?: string[] };

    const batch = Array.isArray(body.userIds) ? body.userIds : [];
    if (batch.length) {
      const added = [];
      for (const id of batch) {
        const row = await addMessengerFriend(userId, String(id ?? ""));
        if (row) added.push(row);
      }
      return NextResponse.json({ success: true, data: added });
    }

    const friendUserId = String(body.friendUserId ?? "").trim();
    if (!friendUserId) {
      return NextResponse.json({ success: false, message: "friendUserId가 필요합니다." }, { status: 400 });
    }
    const row = await addMessengerFriend(userId, friendUserId);
    if (!row) {
      return NextResponse.json({ success: false, message: "친구로 추가할 수 없는 사용자입니다." }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error("POST /api/me/messenger-friends error:", error);
    return NextResponse.json({ success: false, message: "친구 추가 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const { searchParams } = new URL(request.url);
    const friendUserId = String(searchParams.get("friendUserId") ?? "").trim();
    if (!friendUserId) {
      return NextResponse.json({ success: false, message: "friendUserId가 필요합니다." }, { status: 400 });
    }
    await removeMessengerFriend(userId, friendUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/me/messenger-friends error:", error);
    return NextResponse.json({ success: false, message: "친구 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}

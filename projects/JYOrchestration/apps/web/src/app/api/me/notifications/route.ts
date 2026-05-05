import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { listMyPlatformNotifications } from "@/lib/service/projectMemberInviteService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const { searchParams } = new URL(request.url);
    const takeRaw = searchParams.get("take");
    const take = Math.min(50, Math.max(1, Number(takeRaw) || 30));
    const items = await listMyPlatformNotifications(userId, take);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("GET /api/me/notifications error:", error);
    return NextResponse.json({ success: false, message: "알림을 불러오지 못했습니다." }, { status: 500 });
  }
}

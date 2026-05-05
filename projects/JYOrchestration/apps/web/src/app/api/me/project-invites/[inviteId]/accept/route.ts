import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { acceptProjectMemberInvite } from "@/lib/service/projectMemberInviteService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ inviteId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const { inviteId } = await context.params;
    const id = String(inviteId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "inviteId가 필요합니다." }, { status: 400 });
    }
    const result = await acceptProjectMemberInvite({ inviteId: id, sessionUserId: userId });
    if (!result.ok) {
      return NextResponse.json({ success: false, message: "초대를 찾을 수 없거나 이미 처리되었습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, projectId: result.projectId, message: "프로젝트에 참여했습니다." });
  } catch (error) {
    console.error("POST .../accept error:", error);
    return NextResponse.json({ success: false, message: "수락 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

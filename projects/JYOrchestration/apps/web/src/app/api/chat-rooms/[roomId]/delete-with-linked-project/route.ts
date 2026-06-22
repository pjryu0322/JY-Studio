import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { deleteChatRoomWithLinkedProject } from "@/lib/messenger/chatRoomDeleteWithLinkedProjectService";

export async function POST(request: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { roomId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const confirmDeleteLinkedProjectData =
    (body as Record<string, unknown>)?.confirmDeleteLinkedProjectData === true;

  try {
    const result = await deleteChatRoomWithLinkedProject({
      roomId,
      userId,
      confirmDeleteLinkedProjectData,
    });
    if (!result.ok) {
      const status = result.message.includes("권한") ? 403 : 400;
      return NextResponse.json({ success: false, ...result }, { status });
    }
    return NextResponse.json({ success: true, data: result, message: result.message });
  } catch (e) {
    console.error("POST /api/chat-rooms/[roomId]/delete-with-linked-project", e);
    return NextResponse.json(
      {
        success: false,
        ok: false,
        roomDeleted: false,
        linkedProjectReset: false,
        message: "삭제 중 문제가 발생했습니다. 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

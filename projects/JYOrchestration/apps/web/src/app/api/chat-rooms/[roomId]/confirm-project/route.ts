import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { ChatRoomAccessError, confirmProjectFromChatRoom } from "@/lib/service/chatRoomService";

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
  const name = String(o.name ?? "").trim();
  const description = o.description === null || o.description === undefined ? null : String(o.description);
  const requirementsSeedFromDraft = o.requirementsSeedFromDraft === false ? false : true;
  if (!name) {
    return NextResponse.json({ success: false, message: "프로젝트 이름이 필요합니다." }, { status: 400 });
  }
  try {
    const result = await confirmProjectFromChatRoom({
      roomId,
      userId,
      projectName: name,
      projectDescription: description,
      requirementsSeedFromDraft,
    });
    return NextResponse.json({
      success: true,
      message: "프로젝트가 생성되었습니다.",
      data: result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_DRAFT") {
      return NextResponse.json({ success: false, message: "먼저「프로젝트로 정리하기」로 초안을 만들어 주세요." }, { status: 400 });
    }
    if (msg === "NAME_REQUIRED") {
      return NextResponse.json({ success: false, message: "프로젝트 이름이 필요합니다." }, { status: 400 });
    }
    if (e instanceof ChatRoomAccessError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("POST confirm-project", e);
    return NextResponse.json({ success: false, message: "프로젝트를 만들지 못했습니다." }, { status: 500 });
  }
}

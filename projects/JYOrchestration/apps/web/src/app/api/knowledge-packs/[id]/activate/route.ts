import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { activateKnowledgePack } from "@/lib/knowledge-packs/knowledgePackDbService";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();
  if (isStaticKnowledgePackId(packId)) {
    return NextResponse.json({ ok: false, message: "정적 seed는 활성화 대상이 아닙니다." }, { status: 400 });
  }
  try {
    const pack = await activateKnowledgePack(packId, userId);
    return NextResponse.json({ ok: true, pack });
  } catch (e) {
    const msg = e instanceof Error && e.message === "NOT_FOUND" ? "찾을 수 없습니다." : e instanceof Error ? e.message : "실패";
    const code = e instanceof Error && e.message === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status: code });
  }
}

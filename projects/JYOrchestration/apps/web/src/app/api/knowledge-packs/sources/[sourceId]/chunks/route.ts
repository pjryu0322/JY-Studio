import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { listChunksForSource } from "@/lib/knowledge-packs/knowledgePackChunkService";
import { isVirtualKnowledgePackSourceId, parseKnowledgePackSourceRouteId } from "@/lib/knowledge-packs/knowledgePackSourceRouteUtils";

type RouteCtx = { params: Promise<{ sourceId: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { sourceId } = await ctx.params;
  const sid = parseKnowledgePackSourceRouteId(sourceId);
  if (isVirtualKnowledgePackSourceId(sid)) {
    return NextResponse.json({ ok: true, knowledgePackId: "", chunks: [] });
  }

  const { searchParams } = new URL(request.url);
  const take = Number(searchParams.get("take") ?? "200") || 200;

  try {
    const data = await listChunksForSource(userId, sid, take);
    if (!data) return NextResponse.json({ ok: false, message: "찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, message: "청크 조회 실패" }, { status: 500 });
  }
}

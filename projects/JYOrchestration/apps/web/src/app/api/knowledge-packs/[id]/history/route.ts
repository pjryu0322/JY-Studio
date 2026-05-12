import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { listPackHistory } from "@/lib/knowledge-packs/knowledgePackDbService";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();
  if (isStaticKnowledgePackId(packId)) {
    return NextResponse.json({
      ok: true,
      items: [],
      message: "플랫폼 seed 지식팩은 별도 DB 이력이 없습니다.",
    });
  }
  const items = await listPackHistory(packId, userId);
  return NextResponse.json({ ok: true, items });
}

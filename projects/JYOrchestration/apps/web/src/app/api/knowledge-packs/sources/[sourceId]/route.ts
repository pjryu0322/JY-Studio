import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { isVirtualKnowledgePackSourceId, parseKnowledgePackSourceRouteId } from "@/lib/knowledge-packs/knowledgePackSourceRouteUtils";
import { disableKnowledgePackSource } from "@/lib/knowledge-packs/knowledgePackSourceService";

type RouteCtx = { params: Promise<{ sourceId: string }> };

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { sourceId } = await ctx.params;
  const sid = parseKnowledgePackSourceRouteId(sourceId);
  if (isVirtualKnowledgePackSourceId(sid)) {
    return NextResponse.json({ ok: false, message: "플랫폼 기본 참고 링크는 비활성화할 수 없습니다." }, { status: 400 });
  }
  const r = await disableKnowledgePackSource(userId, sid);
  if (!r.ok) {
    return NextResponse.json({ ok: false, message: r.message }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

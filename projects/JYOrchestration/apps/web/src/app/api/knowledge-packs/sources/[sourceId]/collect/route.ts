import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { chunkAndSaveKnowledgePackSource } from "@/lib/knowledge-packs/knowledgePackChunkService";
import { collectKnowledgePackSource } from "@/lib/knowledge-packs/knowledgePackSourceCollector";
import { isVirtualKnowledgePackSourceId, parseKnowledgePackSourceRouteId } from "@/lib/knowledge-packs/knowledgePackSourceRouteUtils";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ sourceId: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { sourceId } = await ctx.params;
  const sid = parseKnowledgePackSourceRouteId(sourceId);
  if (isVirtualKnowledgePackSourceId(sid)) {
    return NextResponse.json({ ok: false, message: "기본 지식팩의 참고 링크는 서버에서 수집하지 않습니다." }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = (await request.json()) as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const rechunkOnly = Boolean(body.rechunkOnly);
  const skipChunk = body.chunk === false;

  try {
    if (rechunkOnly) {
      const ch = await chunkAndSaveKnowledgePackSource(userId, sid, { runCollectIfEmpty: false });
      if (!ch.ok) return NextResponse.json({ ok: false, message: ch.message }, { status: 400 });
      return NextResponse.json({ ok: true, step: "chunk", chunkCount: ch.chunkCount });
    }

    const c = await collectKnowledgePackSource(userId, sid);
    if (!c.ok) return NextResponse.json({ ok: false, message: c.message }, { status: 400 });

    if (skipChunk) {
      return NextResponse.json({ ok: true, step: "collect", plainLength: c.plainLength, warnings: c.warnings });
    }

    const ch = await chunkAndSaveKnowledgePackSource(userId, sid, { runCollectIfEmpty: false });
    if (!ch.ok) return NextResponse.json({ ok: false, message: ch.message, collect: { plainLength: c.plainLength, warnings: c.warnings } }, { status: 400 });
    return NextResponse.json({
      ok: true,
      step: "collect_and_chunk",
      plainLength: c.plainLength,
      warnings: c.warnings,
      chunkCount: ch.chunkCount,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "수집·청크 처리 실패" }, { status: 500 });
  }
}

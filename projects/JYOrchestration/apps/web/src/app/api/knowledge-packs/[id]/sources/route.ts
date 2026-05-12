import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { createKnowledgePackSource, listKnowledgePackSources } from "@/lib/knowledge-packs/knowledgePackSourceService";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();
  try {
    const sources = await listKnowledgePackSources(userId, packId);
    return NextResponse.json({ ok: true, sources });
  } catch {
    return NextResponse.json({ ok: false, message: "원천자료 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const r = await createKnowledgePackSource(userId, packId, {
    sourceType: String(body.sourceType ?? "URL"),
    title: String(body.title ?? ""),
    url: body.url != null ? String(body.url) : undefined,
    rawText: body.rawText != null ? String(body.rawText) : undefined,
    description: body.description != null ? String(body.description) : undefined,
    isOfficial: Boolean(body.isOfficial),
    ragEnabled: body.ragEnabled !== false,
  });

  if (!r.ok) {
    const code = r.message.includes("찾을 수 없") || r.message.includes("권한") ? 404 : 400;
    return NextResponse.json({ ok: false, message: r.message }, { status: code });
  }
  return NextResponse.json({ ok: true, id: r.id });
}

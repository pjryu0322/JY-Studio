import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { cloneStaticSeedKnowledgePackForUser } from "@/lib/knowledge-packs/knowledgePackCloneService";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();

  const r = await cloneStaticSeedKnowledgePackForUser(userId, packId);
  if (!r.ok) {
    return NextResponse.json({ ok: false, message: r.message }, { status: r.httpStatus });
  }
  return NextResponse.json({
    ok: true,
    packId: r.packId,
    message: r.message,
  });
}

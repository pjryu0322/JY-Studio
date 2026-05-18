import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { getHistoryWithPackNames } from "@/lib/knowledge-packs/knowledgePackDbService";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { searchParams } = new URL(request.url);
  const packId = searchParams.get("packId")?.trim() || undefined;
  const action = searchParams.get("action")?.trim() || undefined;
  const actorType = searchParams.get("actorType")?.trim() || undefined;
  const items = await getHistoryWithPackNames(userId, { packId, action, actorType });
  return NextResponse.json({ ok: true, items });
}

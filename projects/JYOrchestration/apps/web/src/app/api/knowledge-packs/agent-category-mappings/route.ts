import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { listAgentMappings, upsertAgentMappings } from "@/lib/knowledge-packs/knowledgePackDbService";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  void request;
  const mappings = await listAgentMappings();
  return NextResponse.json({ ok: true, mappings });
}

export async function PUT(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { mappings?: unknown };
  try {
    body = (await request.json()) as { mappings?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  const raw = body.mappings;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, message: "mappings 배열이 필요합니다." }, { status: 400 });
  }
  const rows = raw.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      agentRole: String(o.agentRole ?? "").trim(),
      category: String(o.category ?? "").trim(),
      enabled: Boolean(o.enabled),
      usageMode: String(o.usageMode ?? "REFERENCE").trim(),
      priority: Number(o.priority ?? 0),
    };
  });
  for (const r of rows) {
    if (!r.agentRole || !r.category) {
      return NextResponse.json({ ok: false, message: "agentRole, category은 필수입니다." }, { status: 400 });
    }
  }
  await upsertAgentMappings(rows);
  const mappings = await listAgentMappings();
  return NextResponse.json({ ok: true, mappings });
}

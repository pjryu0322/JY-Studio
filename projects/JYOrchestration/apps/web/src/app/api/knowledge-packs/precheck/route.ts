import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { parseKnowledgePackPrecheckRequestBody } from "@/lib/knowledge-packs/knowledgePackPrecheckHttpBody";
import { precheckKnowledgePackRegistration } from "@/lib/knowledge-packs/knowledgePackPrecheckService";

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const parsed = parseKnowledgePackPrecheckRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  try {
    const result = await precheckKnowledgePackRegistration(parsed.input);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, message: "사전점검 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

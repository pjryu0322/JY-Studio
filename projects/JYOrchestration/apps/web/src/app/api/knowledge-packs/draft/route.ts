import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { parseKnowledgePackDraftRequestBody } from "@/lib/knowledge-packs/knowledgePackDraftHttpBody";
import { generateKnowledgePackDraft } from "@/lib/knowledge-packs/knowledgePackDraftService";

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const parsed = parseKnowledgePackDraftRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  try {
    const result = await generateKnowledgePackDraft(parsed.input, { userId });
    const { provider, mode, fallbackUsed, diagnostics, ...draft } = result;
    return NextResponse.json({
      ok: true,
      draft,
      provider,
      mode,
      fallbackUsed: fallbackUsed ?? false,
      diagnostics: diagnostics ?? [],
    });
  } catch {
    return NextResponse.json({ ok: false, message: "초안 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

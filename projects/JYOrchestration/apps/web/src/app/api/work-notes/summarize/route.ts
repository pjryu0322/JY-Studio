import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workNoteHtmlToPlainForSummary } from "@/lib/worknote/workNoteHtmlPlain";
import { runWorkNoteSummarizeLlm } from "@/lib/worknote/runWorkNoteSummarizeLlm";

const MAX_HTML = 400_000;
const MAX_PLAIN = 120_000;

type Body = { projectId?: string; contentHtml?: string };

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const projectId = String(body.projectId ?? "").trim();
    const contentHtml = typeof body.contentHtml === "string" ? body.contentHtml : "";
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (contentHtml.length > MAX_HTML) {
      return NextResponse.json({ success: false, message: "메모 본문이 너무 깁니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/work-notes/summarize");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const plain = workNoteHtmlToPlainForSummary(contentHtml, MAX_PLAIN);
    if (!plain.trim()) {
      return NextResponse.json({ success: false, message: "요약할 텍스트가 없습니다." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." },
        { status: 200 },
      );
    }

    const model = resolveOpenAiModelFromEnv();
    const gen = await runWorkNoteSummarizeLlm({ apiKey, model, plainText: plain });
    if (!gen.ok) {
      return NextResponse.json({ success: false, code: gen.code, message: gen.message }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: gen.summary,
        requestType: gen.requestType,
        priority: gen.priority,
        ...(gen.priorityReason ? { priorityReason: gen.priorityReason } : {}),
      },
    });
  } catch (error) {
    console.error("POST /api/work-notes/summarize error:", error);
    return NextResponse.json({ success: false, message: "요약 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

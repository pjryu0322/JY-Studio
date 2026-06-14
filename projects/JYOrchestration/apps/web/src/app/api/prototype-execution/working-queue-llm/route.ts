import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { resolveImplementationIntentWithLlm } from "@/lib/prototype/implementationIntentResolverLLM";
import type { ImplementationIntentResolverInput } from "@/lib/prototype/implementationIntentResolverTypes";
import { analyzeImplementationPreviewFeedbackWithLlm } from "@/lib/prototype/implementationPreviewFeedbackAnalyzerLLM";
import type { ImplementationPreviewFeedbackAnalyzerInput } from "@/lib/prototype/implementationPreviewFeedbackTypes";

type Body = Readonly<{
  projectId?: string;
  mode?: "intent" | "preview_feedback";
  payload?: unknown;
}>;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canViewProject",
        "POST /api/prototype-execution/working-queue-llm",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const mode = body.mode;
    if (mode === "intent") {
      const payload = body.payload as ImplementationIntentResolverInput;
      const out = await resolveImplementationIntentWithLlm(payload);
      return NextResponse.json({ success: true, data: out });
    }

    if (mode === "preview_feedback") {
      const payload = body.payload as ImplementationPreviewFeedbackAnalyzerInput;
      const out = await analyzeImplementationPreviewFeedbackWithLlm(payload);
      return NextResponse.json({ success: true, data: out });
    }

    return NextResponse.json({ success: false, message: "mode가 필요합니다." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/prototype-execution/working-queue-llm error:", error);
    return NextResponse.json({ success: false, message: "Working Queue LLM 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { extractMentionedAI } from "@/lib/service-design/serviceDesignMentionExtract";
import { implementationModeTurnConfig } from "@/lib/workspace-turn/implementationModeTurnConfig";
import { runWorkspaceTurn } from "@/lib/workspace-turn/workspaceTurnOrchestrator";
import type { ImplementationTurnContext } from "@/lib/workspace-turn/workspaceTurnTypes";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  userMessage?: string;
  userMessageId?: string;
  mentionedAI?: string | null;
  envOk?: boolean;
  requirementsStateJson?: unknown;
};

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
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-execution/implementation-turn");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." },
        { status: 200 },
      );
    }

    const userMessage = String(body.userMessage ?? "").trim();
    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    const userMessageId = String(body.userMessageId ?? "").trim() || `m-turn-${Date.now()}`;
    const envOk = Boolean(body.envOk);
    const mentionedFromBody =
      body.mentionedAI == null || body.mentionedAI === ""
        ? null
        : String(body.mentionedAI).trim() || null;
    const mentionedAI = mentionedFromBody ?? extractMentionedAI(userMessage);

    const context: ImplementationTurnContext = {
      requirementsStateJson: body.requirementsStateJson ?? {},
      envOk,
    };

    const result = await runWorkspaceTurn({
      config: implementationModeTurnConfig,
      apiKey,
      input: {
        projectId,
        projectName: String(body.projectName ?? "").trim(),
        projectDescription: String(body.projectDescription ?? "").trim(),
        userMessage,
        userMessageId,
        mentionedAI,
        envOk,
        context,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        mode: result.mode,
        assistantMessage: result.modelResult.assistantMessage,
        responderLabel: result.modelResult.responderLabel,
        modelResult: result.modelResult,
        statePatch: result.statePatch,
        timelineEntries: result.timelineEntries,
        source: result.source,
      },
    });
  } catch (error) {
    console.error("POST /api/prototype-execution/implementation-turn error:", error);
    return NextResponse.json({ success: false, message: "구현 단계 응답 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

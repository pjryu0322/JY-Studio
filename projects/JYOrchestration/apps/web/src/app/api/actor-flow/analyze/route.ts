import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { runActorFlowAnalyzeOpenAI } from "@/lib/actor-flow/actorFlowAnalyzerOpenAI";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  userMessage?: string;
  latestAiQuestion?: string;
  currentState?: RequirementsServiceFlowV1 | null;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const userMessage = String(body.userMessage ?? "").trim();
    const latestAiQuestion = String(body.latestAiQuestion ?? "").trim();
    const currentState = (body.currentState ?? null) as RequirementsServiceFlowV1 | null;

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/actor-flow/analyze");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const result = await runActorFlowAnalyzeOpenAI({
      projectName,
      projectDescription,
      userMessage,
      latestAiQuestion,
      currentFlow: currentState,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.code === "NO_KEY" ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedFlow: result.updatedFlow,
        aiReply: result.aiReply,
        nextQuestion: result.nextQuestion,
        openQuestions: result.openQuestions,
        completion: result.completion,
      },
      meta: { model: result.model },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/actor-flow/analyze error:", error);
    return NextResponse.json({ success: false, message: "Actor/Flow 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}


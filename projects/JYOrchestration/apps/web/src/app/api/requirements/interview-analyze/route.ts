import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runInterviewAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { problemInterviewStateFromAnalyzerWireInput } from "@/lib/requirements/problemInterview";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  userMessage?: string;
  latestAiQuestion?: string;
  currentInterviewState?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const userMessage = String(body.userMessage ?? "").trim();
    const latestAiQuestion = String(body.latestAiQuestion ?? "").trim();
    const nowIso = new Date().toISOString();
    const currentInterviewState = problemInterviewStateFromAnalyzerWireInput(body.currentInterviewState, nowIso);

    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/interview-analyze");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) return denied;
        throw error;
      }
    }

    const result = await runInterviewAnalyzeOpenAI({
      projectName,
      projectDescription,
      userMessage,
      latestAiQuestion,
      currentInterviewState,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.code === "NO_KEY" ? 503 : 502 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      const s = result.payload.slots;
      console.log(
        "[problemInterview-analyzer]",
        `user="${userMessage.slice(0, 120).replace(/\s+/g, " ")}"`,
        `slots=${JSON.stringify(s)}`,
        `next=${JSON.stringify(result.payload.nextBestSlot)}`,
        `confidence=${result.payload.confidence}`
      );
    }

    return NextResponse.json({
      success: true,
      data: result.payload,
      meta: { model: result.model },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/interview-analyze error:", error);
    return NextResponse.json({ success: false, message: "인터뷰 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}

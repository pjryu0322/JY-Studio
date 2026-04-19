import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runRequirementsFacilitatorOpenAI, type RequirementsAiResponseStyle } from "@/lib/project/requirementsAiFacilitatorOpenAI";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  stage?: string;
  userMessage?: string;
  dialogueExcerpt?: string;
  aiResponseStyle?: string;
};

function parseAiResponseStyle(raw: unknown): RequirementsAiResponseStyle | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "brief" || s === "detailed" || s === "standard") return s;
  return undefined;
}

/**
 * 요구사항 협의실: AI 기획자 응답(OpenAI). projectId가 있으면 프로젝트 조회 권한 필요.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const stageRaw = String(body.stage ?? "requirements").trim().toLowerCase();
    const userMessage = String(body.userMessage ?? "").trim();
    const dialogueExcerpt = String(body.dialogueExcerpt ?? "");
    const responseStyle = parseAiResponseStyle(body.aiResponseStyle);

    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/ai-facilitator");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) {
          return denied;
        }
        throw error;
      }
    }

    const stage = stageRaw === "requirements" ? "requirements" : "requirements";
    const result = await runRequirementsFacilitatorOpenAI({
      projectName,
      projectDescription,
      stage,
      userMessage,
      dialogueExcerpt,
      responseStyle,
    });
    if (!result.ok) {
      return NextResponse.json({
        success: false,
        code: result.code,
        message: result.message,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: result.text,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/ai-facilitator error:", error);
    return NextResponse.json(
      { success: false, message: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

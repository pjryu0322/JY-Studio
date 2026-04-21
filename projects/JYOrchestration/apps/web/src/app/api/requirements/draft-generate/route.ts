import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runRequirementsDraftOpenAI, type RequirementsAiResponseStyle } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { parseOrganizeMemoryFacts } from "@/lib/requirements/requirementsOrganizeContext";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  stage?: string;
  userMessage?: string;
  dialogueExcerpt?: string;
  existingDraft?: unknown;
  aiResponseStyle?: string;
  memoryFacts?: unknown;
  rollingSummary?: string;
  recentMessages?: string;
  useRawDialogueFallback?: boolean;
};

function parseAiResponseStyle(raw: unknown): RequirementsAiResponseStyle | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "brief" || s === "detailed" || s === "standard") return s;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const stageRaw = String(body.stage ?? "requirements").trim().toLowerCase();
    const userMessage = String(body.userMessage ?? "").trim();
    const dialogueExcerpt = String(body.dialogueExcerpt ?? "");
    const existingDraft = body.existingDraft;
    const responseStyle = parseAiResponseStyle(body.aiResponseStyle);
    const memoryFacts = parseOrganizeMemoryFacts(body.memoryFacts);
    const rollingSummary = String(body.rollingSummary ?? "").trim();
    const recentMessages = String(body.recentMessages ?? "").trim();
    const useRawDialogueFallback = Boolean(body.useRawDialogueFallback);

    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }
    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/draft-generate");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) return denied;
        throw error;
      }
    }

    const stage = stageRaw === "requirements" ? "requirements" : "requirements";
    const result = await runRequirementsDraftOpenAI({
      projectName,
      projectDescription,
      stage,
      userMessage,
      dialogueExcerpt,
      existingDraft,
      responseStyle,
      memoryFacts,
      rollingSummary,
      recentMessages,
      useRawDialogueFallback,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      data: {
        draft: result.draft,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/draft-generate error:", error);
    return NextResponse.json({ success: false, message: "초안 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { isIdeationDeliverableType, type IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import {
  runIdeationDeliverablesOpenAI,
  type RequirementsAiResponseStyle,
} from "@/lib/project/requirementsAiFacilitatorOpenAI";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  chatSummary?: string;
  dialogueExcerpt?: string;
  outputTypes?: unknown[];
  aiResponseStyle?: string;
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
    const chatSummary = String(body.chatSummary ?? "");
    const dialogueExcerpt = String(body.dialogueExcerpt ?? "");
    const responseStyle = parseAiResponseStyle(body.aiResponseStyle);
    const rawTypes = Array.isArray(body.outputTypes) ? body.outputTypes : [];
    const outputTypes = rawTypes.map((x) => String(x ?? "").trim()).filter(isIdeationDeliverableType) as IdeationDeliverableType[];

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!outputTypes.length) {
      return NextResponse.json({ success: false, message: "outputTypes가 필요합니다." }, { status: 400 });
    }

    const exclusive = outputTypes.includes("full_plan");
    if (exclusive && outputTypes.length > 1) {
      return NextResponse.json(
        { success: false, message: "전체 기획안은 다른 산출물과 함께 선택할 수 없습니다." },
        { status: 400 }
      );
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/deliverables-generate");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const result = await runIdeationDeliverablesOpenAI({
      projectName,
      projectDescription,
      chatSummary,
      dialogueExcerpt,
      selectedTypes: outputTypes,
      responseStyle,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      data: {
        outputs: result.outputs,
        model: result.model,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/deliverables-generate error:", error);
    return NextResponse.json({ success: false, message: "산출물 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

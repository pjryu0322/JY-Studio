import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { runInterviewBootstrapSuggestionsOnlyOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { buildOrchestrationInterviewDigest } from "@/lib/requirements/interviewSuggestionChips";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  projectType?: string;
  interviewQuestion?: string;
  singleChatOrchestrationV1?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const projectType = String(body.projectType ?? "").trim() || null;
    const interviewQuestion = String(body.interviewQuestion ?? "").trim();

    if (!interviewQuestion) {
      return NextResponse.json({ success: false, message: "interviewQuestion이 필요합니다." }, { status: 400 });
    }

    if (projectId) {
      try {
        await requireProjectPermission(
          projectId,
          userId,
          "canViewProject",
          "POST /api/requirements/interview-bootstrap-suggestions"
        );
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) return denied;
        throw error;
      }
    }

    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName,
      projectDescription,
      projectType,
    });
    const orchParsed = parseRequirementsSingleChatOrchestrationV1(body.singleChatOrchestrationV1, defs);
    const orchestrationDigest =
      orchParsed && orchParsed.slotDefinitionsHash === hashSlotDefinitions(defs)
        ? buildOrchestrationInterviewDigest({ state: orchParsed, definitions: defs })
        : "";

    const result = await runInterviewBootstrapSuggestionsOnlyOpenAI({
      projectName,
      projectDescription,
      projectType,
      interviewQuestion,
      ...(orchestrationDigest ? { orchestrationDigest } : {}),
    });

    if (!result.ok) {
      return NextResponse.json({
        success: true,
        data: { suggestions: [], interviewSuggestionsSource: "empty" as const, model: null },
        meta: { code: result.code, message: result.message },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestions: result.suggestions,
        interviewSuggestionsSource: result.suggestions.length ? ("llm" as const) : ("empty" as const),
        model: result.model,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/interview-bootstrap-suggestions error:", error);
    return NextResponse.json({ success: false, message: "선택지 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

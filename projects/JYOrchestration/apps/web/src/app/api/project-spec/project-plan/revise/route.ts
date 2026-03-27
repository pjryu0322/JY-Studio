import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { reviseProjectPlanMarkdown } from "@/lib/project-spec/generateSpecContextWithOpenAI";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { isAllowedSpecWorkspaceModel } from "@/lib/project-spec/specWorkspaceModels";

type Body = {
  projectId?: string;
  document?: string;
  instruction?: string | null;
  model?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const projectId = String(body.projectId ?? "").trim();
    const document = String(body.document ?? "").trim();
    const instruction = body.instruction != null ? String(body.instruction) : "";
    const modelRaw = String(body.model ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!document) {
      return NextResponse.json({ success: false, message: "개선할 문서가 비어 있습니다." }, { status: 400 });
    }

    const model = modelRaw && isAllowedSpecWorkspaceModel(modelRaw) ? modelRaw : "gpt-4o-mini";

    try {
      await requireProjectPermissionById(
        projectId,
        userId,
        "canGenerateTask",
        "POST /api/project-spec/project-plan/revise"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    try {
      const { markdown, model: usedModel, usage } = await reviseProjectPlanMarkdown({
        document,
        instruction: instruction.trim() || null,
        modelFromRequest: model,
      });

      return NextResponse.json({
        success: true,
        message: "AI 개선 제안을 생성했습니다.",
        data: {
          content: markdown,
          model: usedModel,
          usage,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "OPENAI_API_KEY_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            success: false,
            message: "OpenAI API 키가 설정되지 않았습니다.",
            code: "OPENAI_NOT_CONFIGURED",
          },
          { status: 503 }
        );
      }
      console.error("project-plan revise OpenAI error:", e);
      return NextResponse.json(
        { success: false, message: "AI 개선 제안 생성에 실패했습니다.", code: "OPENAI_FAILED" },
        { status: 502 }
      );
    }
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project-spec/project-plan/revise error:", error);
    return NextResponse.json({ success: false, message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

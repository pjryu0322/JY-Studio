import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { generateFullProjectPlanMarkdown } from "@/lib/project-spec/generateSpecContextWithOpenAI";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { isAllowedSpecWorkspaceModel } from "@/lib/project-spec/specWorkspaceModels";

export type AiDraftCandidateDto = {
  id: string;
  modelId: string;
  content: string;
  createdAt: string;
};

type Body = {
  projectId?: string;
  name?: string;
  description?: string;
  projectType?: string;
  models?: string[];
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
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const projectType = String(body.projectType ?? "").trim();

    const rawModels = Array.isArray(body.models) && body.models.length > 0
      ? body.models
      : body.model
        ? [body.model]
        : ["gpt-4o-mini"];

    const models = rawModels
      .map((m) => String(m ?? "").trim())
      .filter((m) => m.length > 0)
      .filter((m) => isAllowedSpecWorkspaceModel(m));

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ success: false, message: "프로젝트명이 필요합니다." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ success: false, message: "프로젝트 설명이 필요합니다." }, { status: 400 });
    }
    if (!projectType) {
      return NextResponse.json({ success: false, message: "프로젝트 유형이 필요합니다." }, { status: 400 });
    }
    if (models.length === 0) {
      return NextResponse.json(
        { success: false, message: "허용된 AI 모델을 하나 이상 선택하세요. (gpt-4o, gpt-4.1, gpt-4o-mini)" },
        { status: 400 }
      );
    }

    try {
      await requireProjectPermissionById(
        projectId,
        userId,
        "canGenerateTask",
        "POST /api/project-spec/project-plan/generate"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const candidates: AiDraftCandidateDto[] = [];
    const failures: Array<{ modelId: string; message: string }> = [];

    await Promise.all(
      models.map(async (modelId) => {
        try {
          const { markdown, model } = await generateFullProjectPlanMarkdown(
            { name, description, projectType },
            modelId
          );
          candidates.push({
            id: randomUUID(),
            modelId: model,
            content: markdown,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.push({
            modelId,
            message:
              msg === "OPENAI_API_KEY_NOT_CONFIGURED"
                ? "OpenAI API 키가 설정되지 않았습니다."
                : msg.startsWith("OPENAI_HTTP_")
                  ? `모델 호출 실패 (${modelId})`
                  : "생성에 실패했습니다.",
          });
          console.error(`project-plan generate model=${modelId}`, e);
        }
      })
    );

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "선택한 모델 모두에서 생성에 실패했습니다.",
          data: { candidates: [], failures },
          code: "ALL_MODELS_FAILED",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        failures.length > 0
          ? `${candidates.length}개 후보가 생성되었습니다. 일부 모델은 실패했습니다.`
          : "프로젝트 실행 계획 초안이 생성되었습니다.",
      data: {
        candidates,
        failures,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project-spec/project-plan/generate error:", error);
    return NextResponse.json({ success: false, message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

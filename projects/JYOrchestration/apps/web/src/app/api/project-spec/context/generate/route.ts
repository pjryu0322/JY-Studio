import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  generateSpecContextWithOpenAI,
  specContextToFormFields,
} from "@/lib/project-spec/generateSpecContextWithOpenAI";
import type { SpecContextGenerateResult } from "@/lib/project-spec/specContextTypes";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type GenerateBody = {
  projectId?: string;
  name?: string;
  description?: string;
  projectType?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    let body: GenerateBody;
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const projectId = String(body.projectId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const projectType = String(body.projectType ?? "").trim();

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

    try {
      await requireProjectPermissionById(
        projectId,
        userId,
        "canGenerateTask",
        "POST /api/project-spec/context/generate"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let structured: SpecContextGenerateResult;
    try {
      structured = await generateSpecContextWithOpenAI({ name, description, projectType });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "OPENAI_API_KEY_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            success: false,
            message: "OpenAI API 키가 설정되지 않았습니다. 서버 환경 변수 OPENAI_API_KEY를 구성하세요.",
            code: "OPENAI_NOT_CONFIGURED",
          },
          { status: 503 }
        );
      }
      console.error("OpenAI spec context generate failed:", e);
      return NextResponse.json(
        {
          success: false,
          message: "AI 초안 생성에 실패했습니다. 잠시 후 다시 시도하세요.",
          code: "OPENAI_GENERATE_FAILED",
        },
        { status: 502 }
      );
    }

    const formatted = specContextToFormFields(structured);

    return NextResponse.json({
      success: true,
      message: "AI가 실행 계획 입력 초안을 생성했습니다.",
      data: {
        projectId,
        ...structured,
        formatted,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project-spec/context/generate error:", error);
    return NextResponse.json(
      { success: false, message: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

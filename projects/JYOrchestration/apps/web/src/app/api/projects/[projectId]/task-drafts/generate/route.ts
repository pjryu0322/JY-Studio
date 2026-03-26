import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { isAllowedSpecWorkspaceModel } from "@/lib/project-spec/specWorkspaceModels";
import { syncTaskDraftsForProjectSpecVersion } from "@/lib/project-spec/taskDraftGenerationService";

type PostBody = {
  specVersionId?: string;
  model?: string;
  mode?: "initial" | "regenerate";
};

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        id,
        userId,
        "canGenerateTask",
        "POST /api/projects/[projectId]/task-drafts/generate"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PostBody = {};
    try {
      body = (await request.json()) as PostBody;
    } catch {
      body = {};
    }

    let model: string | null = null;
    const rawModel = typeof body.model === "string" ? body.model.trim() : "";
    if (rawModel) {
      if (!isAllowedSpecWorkspaceModel(rawModel)) {
        return NextResponse.json(
          {
            success: false,
            message: "지원하지 않는 모델입니다. gpt-4o, gpt-4.1, gpt-4o-mini 중에서 선택하세요.",
          },
          { status: 400 }
        );
      }
      model = rawModel;
    }

    let specVersionId = String(body.specVersionId ?? "").trim();
    if (!specVersionId) {
      const p = await prisma.project.findUnique({
        where: { id },
        select: { currentSpecVersionId: true },
      });
      specVersionId = p?.currentSpecVersionId?.trim() ?? "";
    }

    if (!specVersionId) {
      return NextResponse.json(
        {
          success: false,
          message: "확정된 Spec 버전이 없습니다. Project Spec을 먼저 확정하세요.",
        },
        { status: 400 }
      );
    }

    try {
      const r = await syncTaskDraftsForProjectSpecVersion({
        projectId: id,
        specVersionId,
        userId,
        model,
      });
      return NextResponse.json({
        success: true,
        message:
          body.mode === "regenerate"
            ? "새 Spec 기준으로 Task 초안을 다시 생성했습니다."
            : "Task 초안을 생성했습니다.",
        data: {
          createdCount: r.createdCount,
          supersededCount: r.supersededCount,
          model: r.model,
          usage: r.usage,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "OPENAI_API_KEY_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            success: false,
            message: "OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY를 구성하세요.",
            code: "OPENAI_NOT_CONFIGURED",
          },
          { status: 503 }
        );
      }
      if (msg === "SPEC_MARKDOWN_EMPTY") {
        return NextResponse.json(
          { success: false, message: "Spec 본문이 비어 있어 Task 초안을 만들 수 없습니다." },
          { status: 400 }
        );
      }
      console.error("task-drafts/generate:", e);
      return NextResponse.json(
        { success: false, message: "Task 초안 생성에 실패했습니다.", code: "TASK_DRAFT_GENERATE_FAILED" },
        { status: 502 }
      );
    }
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/projects/[projectId]/task-drafts/generate error:", error);
    return NextResponse.json(
      { success: false, message: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

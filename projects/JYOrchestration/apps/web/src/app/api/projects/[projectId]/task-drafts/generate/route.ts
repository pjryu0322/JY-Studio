import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { isAllowedSpecWorkspaceModel } from "@/lib/project-spec/specWorkspaceModels";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { syncTaskDraftsForProjectSpecVersion } from "@/lib/project-spec/taskDraftGenerationService";

type PostBody = {
  specVersionId?: string;
  model?: string;
  mode?: "initial" | "regenerate";
  /** 기본 `single_pass`. 레거시 다단계만 `legacy_pipeline`. */
  generationMode?: "single_pass" | "legacy_pipeline";
  /** legacy_pipeline 전용. 비기능 파이프라인 힌트 */
  includeNonFunctionalRequirements?: boolean;
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
          message: "확정된 실행 계획 버전이 없습니다. 실행 계획을 먼저 확정하세요.",
        },
        { status: 400 }
      );
    }

    try {
      const startedAt = Date.now();
      const generationMode = body.generationMode === "legacy_pipeline" ? "legacy_pipeline" : "single_pass";
      appendTaskProgressLog({
        kind: "task_drafts",
        phase: "generate_request",
        projectId: id,
        specVersionId,
        userId,
        detail: {
          uiMode: body.mode ?? "initial",
          generationMode,
          includeNonFunctionalRequirements: Boolean(body.includeNonFunctionalRequirements),
        },
      });
      console.info("[task-drafts/generate] start", {
        projectId: id,
        specVersionId,
        mode: body.mode ?? "initial",
        generationMode,
        includeNonFunctionalRequirements: Boolean(body.includeNonFunctionalRequirements),
      });
      const r = await syncTaskDraftsForProjectSpecVersion({
        projectId: id,
        specVersionId,
        userId,
        model,
        generationMode,
        includeNonFunctionalInExecutionPipeline: Boolean(body.includeNonFunctionalRequirements),
      });
      appendTaskProgressLog({
        kind: "task_drafts",
        phase: "generate_http_ok",
        projectId: id,
        specVersionId,
        userId,
        detail: {
          elapsedMs: Date.now() - startedAt,
          createdCount: r.createdCount,
          autoConfirmedTaskCount: r.autoConfirmedTaskCount ?? 0,
          graphAutoRepaired: Boolean(r.graphAutoRepaired),
        },
      });
      console.info("[task-drafts/generate] done", {
        projectId: id,
        specVersionId,
        createdCount: r.createdCount,
        autoConfirmedTaskCount: r.autoConfirmedTaskCount ?? 0,
        graphAutoRepaired: Boolean(r.graphAutoRepaired),
        elapsedMs: Date.now() - startedAt,
      });
      const tc = r.autoConfirmedTaskCount ?? 0;
      const msg =
        body.mode === "regenerate"
          ? tc > 0
            ? `Task 초안을 다시 생성하고 워크플로를 보정한 뒤 실행 Task ${tc}개를 전체 확정했습니다.`
            : "새 Spec 기준으로 Task 초안을 다시 생성·보정·확정했습니다."
          : tc > 0
            ? `Task 초안을 생성하고 워크플로를 보정한 뒤 실행 Task ${tc}개를 전체 확정했습니다.`
            : "Task 초안을 생성·보정·확정했습니다.";

      return NextResponse.json({
        success: true,
        message: msg,
        data: {
          createdCount: r.createdCount,
          supersededCount: r.supersededCount,
          model: r.model,
          usage: r.usage,
          graphAutoRepaired: Boolean(r.graphAutoRepaired),
          autoConfirmedTaskCount: r.autoConfirmedTaskCount ?? 0,
          promotedDraftRows: r.promotedDraftRows ?? 0,
          confirmedTaskIds: r.confirmedTaskIds ?? [],
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendTaskProgressLog({
        kind: "task_drafts",
        phase: "generate_error",
        projectId: id,
        specVersionId,
        userId,
        detail: { message: msg.slice(0, 2000) },
      });
      if (msg.startsWith("TASK_DRAFT_GRAPH_")) {
        return NextResponse.json(
          {
            success: false,
            message: "워크플로를 자동으로 완성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            code: "TASK_DRAFT_GRAPH_REPAIR_FAILED",
          },
          { status: 502 }
        );
      }
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
      if (msg === "OPENAI_TASK_DRAFT_NO_FUNCTIONAL_REQUIREMENTS") {
        return NextResponse.json(
          {
            success: false,
            message:
              "기능 요구사항(FUNCTIONAL)이 없어 실행 Task를 만들 수 없습니다. Spec에 FR을 추가하거나, 비기능만 있다면 「비기능 요구를 Task 파이프에 포함」을 켜 보세요.",
            code: "NO_FUNCTIONAL_REQUIREMENTS",
          },
          { status: 400 }
        );
      }
      if (
        msg === "OPENAI_SINGLE_PASS_JSON_PARSE_FAILED" ||
        msg === "OPENAI_SINGLE_PASS_INVALID_ROOT" ||
        msg === "OPENAI_SINGLE_PASS_MISSING_TASKS_ARRAY"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "AI가 올바른 JSON 형식으로 응답하지 않았습니다. 프롬프트를 조정한 뒤 다시 시도하세요.",
            code: "SINGLE_PASS_INVALID_JSON",
          },
          { status: 502 }
        );
      }
      if (msg === "OPENAI_SINGLE_PASS_NO_VALID_TASKS") {
        return NextResponse.json(
          {
            success: false,
            message:
              "유효한 실행 Task가 없습니다. Spec·프롬프트 범위를 확인하거나, 출력이 비기능만 담고 있지 않은지 확인하세요.",
            code: "SINGLE_PASS_NO_VALID_TASKS",
          },
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

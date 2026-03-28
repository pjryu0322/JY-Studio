import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  composeWorkspaceSpecUserMessage,
  DEFAULT_SPEC_GENERATION_USER_TEMPLATE,
} from "@/lib/project-spec/buildWorkspacePromptText";
import { computeSpecCandidatePayload } from "@/lib/project-spec/specCandidatePayload";
import {
  normalizeSpecPromptPreset,
  type SpecPromptPresetId,
} from "@/lib/project-spec/specPromptPresets";
import {
  completeWorkspaceSpecMarkdown,
  refineWorkspaceSpecMarkdown,
} from "@/lib/project-spec/generateSpecContextWithOpenAI";
import {
  appendProjectSpecVersionAndSetCurrent,
  rollbackProjectSpecToVersion,
} from "@/lib/project-spec/appendProjectSpecVersion";
import { trySyncTaskDraftsAfterSpecChange } from "@/lib/project-spec/trySyncTaskDraftsAfterSpecChange";
import { isAllowedSpecWorkspaceModel } from "@/lib/project-spec/specWorkspaceModels";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import type { Project } from "@/components/project-spec/types";

async function getOrCreateSpecPromptConfig(projectId: string) {
  const existing = await prisma.specPromptConfig.findUnique({ where: { projectId } });
  if (existing) {
    return existing;
  }
  return prisma.specPromptConfig.create({
    data: {
      projectId,
      templatePrompt: DEFAULT_SPEC_GENERATION_USER_TEMPLATE,
      preset: "default",
    },
  });
}

function mapSpecPromptConfigRow(r: {
  id: string;
  projectId: string;
  templatePrompt: string;
  preset: string;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    projectId: r.projectId,
    templatePrompt: r.templatePrompt,
    preset: normalizeSpecPromptPreset(r.preset) as SpecPromptPresetId,
    lastEditedAt: r.updatedAt.toISOString(),
  };
}

function isStoredCandidateScore(v: unknown): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as { total?: unknown }).total === "number" &&
    typeof (v as { completeness?: unknown }).completeness === "number"
  );
}

function isStoredCandidateMeta(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && Array.isArray((v as { sections?: unknown }).sections);
}

function mapResponseRow(r: {
  id: string;
  projectId: string;
  promptId: string;
  provider: string;
  model: string;
  responseMarkdown: string;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
  specCandidateScore: unknown;
  specCandidateMeta: unknown;
}) {
  let score: Record<string, unknown>;
  let meta: Record<string, unknown>;
  if (isStoredCandidateScore(r.specCandidateScore) && isStoredCandidateMeta(r.specCandidateMeta)) {
    score = r.specCandidateScore;
    meta = r.specCandidateMeta;
  } else {
    const p = computeSpecCandidatePayload(r.responseMarkdown);
    score = p.score as unknown as Record<string, unknown>;
    meta = p.meta as unknown as Record<string, unknown>;
  }
  return {
    id: r.id,
    projectId: r.projectId,
    promptId: r.promptId,
    provider: r.provider,
    model: r.model,
    responseMarkdown: r.responseMarkdown,
    status: r.status,
    promptTokens: r.promptTokens ?? null,
    completionTokens: r.completionTokens ?? null,
    totalTokens: r.totalTokens ?? null,
    createdAt: r.createdAt.toISOString(),
    specCandidateScore: score,
    specCandidateMeta: meta,
  };
}

const PROJECT_MAP_SELECT = {
  id: true,
  name: true,
  description: true,
  projectType: true,
  specCoreGoals: true,
  specScopeIn: true,
  specScopeOut: true,
  specTargetUsers: true,
  specSuccessCriteria: true,
  executionPlanMarkdown: true,
  selectedPlanCandidateId: true,
  confirmedSpecMarkdown: true,
  confirmedSpecResponseId: true,
  confirmedSpecAt: true,
  currentSpecVersionId: true,
} as const;

function mapProject(row: {
  id: string;
  name: string;
  description: string | null;
  projectType: string;
  specCoreGoals: string | null;
  specScopeIn: string | null;
  specScopeOut: string | null;
  specTargetUsers: string | null;
  specSuccessCriteria: string | null;
  executionPlanMarkdown: string | null;
  selectedPlanCandidateId: string | null;
  confirmedSpecMarkdown: string | null;
  confirmedSpecResponseId: string | null;
  confirmedSpecAt: Date | null;
  currentSpecVersionId: string | null;
}): Pick<
  Project,
  | "id"
  | "name"
  | "description"
  | "projectType"
  | "specCoreGoals"
  | "specScopeIn"
  | "specScopeOut"
  | "specTargetUsers"
  | "specSuccessCriteria"
  | "executionPlanMarkdown"
  | "selectedPlanCandidateId"
  | "confirmedSpecMarkdown"
  | "confirmedSpecResponseId"
  | "confirmedSpecAt"
  | "currentSpecVersionId"
> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectType: row.projectType,
    specCoreGoals: row.specCoreGoals,
    specScopeIn: row.specScopeIn,
    specScopeOut: row.specScopeOut,
    specTargetUsers: row.specTargetUsers,
    specSuccessCriteria: row.specSuccessCriteria,
    executionPlanMarkdown: row.executionPlanMarkdown,
    selectedPlanCandidateId: row.selectedPlanCandidateId,
    confirmedSpecMarkdown: row.confirmedSpecMarkdown,
    confirmedSpecResponseId: row.confirmedSpecResponseId,
    confirmedSpecAt: row.confirmedSpecAt?.toISOString() ?? null,
    currentSpecVersionId: row.currentSpecVersionId,
  };
}

export async function GET(
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
      await requireProjectPermissionById(id, userId, "canViewProject", "GET /api/projects/[projectId]/spec-workspace");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const projectRow = await prisma.project.findUnique({
      where: { id },
      select: PROJECT_MAP_SELECT,
    });
    if (!projectRow) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const prompts = await prisma.projectSpecWorkspacePrompt.findMany({
      where: { projectId: id },
      orderBy: { version: "desc" },
      take: 50,
    });

    const responses = await prisma.projectSpecWorkspaceResponse.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const specPromptConfigRow = await getOrCreateSpecPromptConfig(id);

    const specVersions = await prisma.projectSpecVersion.findMany({
      where: { projectId: id },
      orderBy: { version: "desc" },
      take: 80,
      select: {
        id: true,
        projectId: true,
        version: true,
        markdown: true,
        sourceType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Spec 워크스페이스를 불러왔습니다.",
      data: {
        project: mapProject(projectRow),
        specVersions: specVersions.map((v) => ({
          id: v.id,
          projectId: v.projectId,
          version: v.version,
          markdown: v.markdown,
          sourceType: v.sourceType,
          createdAt: v.createdAt.toISOString(),
        })),
        prompts: prompts.map((p) => ({
          id: p.id,
          projectId: p.projectId,
          version: p.version,
          promptText: p.promptText,
          createdAt: p.createdAt.toISOString(),
        })),
        responses: responses.map((r) => mapResponseRow(r)),
        specPromptConfig: mapSpecPromptConfigRow(specPromptConfigRow),
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/spec-workspace error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          code: "DB_SCHEMA_OUT_OF_DATE",
          message:
            "DB에 최신 컬럼이 없어 워크스페이스를 불러올 수 없습니다. 프로젝트 루트에서 `npx prisma migrate deploy`(스키마: packages/db/schema.prisma)로 마이그레이션을 적용하세요. (실행계획 저장 자체는 성공했을 수 있습니다.)",
          meta: error.meta,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Spec 워크스페이스 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PatchBody = {
  name?: string;
  description?: string | null;
  projectType?: string;
  specCoreGoals?: string | null;
  specScopeIn?: string | null;
  specScopeOut?: string | null;
  specTargetUsers?: string | null;
  specSuccessCriteria?: string | null;
  executionPlanMarkdown?: string | null;
  selectedPlanCandidateId?: string | null;
  specPromptTemplate?: string | null;
  specPromptPreset?: string | null;
};

export async function PATCH(
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
        "PATCH /api/projects/[projectId]/spec-workspace"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ success: false, message: "프로젝트명은 비울 수 없습니다." }, { status: 400 });
      }
      data.name = name;
    }
    if (body.description !== undefined) {
      data.description = body.description === null ? null : String(body.description);
    }
    if (body.projectType !== undefined) {
      const pt = String(body.projectType ?? "").trim();
      if (!pt) {
        return NextResponse.json({ success: false, message: "projectType이 비어 있습니다." }, { status: 400 });
      }
      data.projectType = pt;
    }
    if (body.specCoreGoals !== undefined) {
      data.specCoreGoals = body.specCoreGoals === null ? null : String(body.specCoreGoals);
    }
    if (body.specScopeIn !== undefined) {
      data.specScopeIn = body.specScopeIn === null ? null : String(body.specScopeIn);
    }
    if (body.specScopeOut !== undefined) {
      data.specScopeOut = body.specScopeOut === null ? null : String(body.specScopeOut);
    }
    if (body.specTargetUsers !== undefined) {
      data.specTargetUsers = body.specTargetUsers === null ? null : String(body.specTargetUsers);
    }
    if (body.specSuccessCriteria !== undefined) {
      data.specSuccessCriteria = body.specSuccessCriteria === null ? null : String(body.specSuccessCriteria);
    }
    if (body.executionPlanMarkdown !== undefined) {
      data.executionPlanMarkdown = body.executionPlanMarkdown === null ? null : String(body.executionPlanMarkdown);
    }
    if (body.selectedPlanCandidateId !== undefined) {
      data.selectedPlanCandidateId =
        body.selectedPlanCandidateId === null || body.selectedPlanCandidateId === ""
          ? null
          : String(body.selectedPlanCandidateId);
    }

    const hasPromptPatch = body.specPromptTemplate !== undefined || body.specPromptPreset !== undefined;

    if (Object.keys(data).length === 0 && !hasPromptPatch) {
      return NextResponse.json({ success: false, message: "수정할 필드가 없습니다." }, { status: 400 });
    }

    let updated = await prisma.project.findUnique({ where: { id }, select: PROJECT_MAP_SELECT });
    if (!updated) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (Object.keys(data).length > 0) {
      updated = await prisma.project.update({
        where: { id },
        data: data as Parameters<typeof prisma.project.update>[0]["data"],
        select: PROJECT_MAP_SELECT,
      });
    }

    let specPromptConfigOut: ReturnType<typeof mapSpecPromptConfigRow> | null = null;
    if (hasPromptPatch) {
      const cfg = await getOrCreateSpecPromptConfig(id);
      const nextTemplate =
        body.specPromptTemplate !== undefined ? String(body.specPromptTemplate ?? "") : cfg.templatePrompt;
      const nextPreset =
        body.specPromptPreset !== undefined
          ? normalizeSpecPromptPreset(body.specPromptPreset)
          : normalizeSpecPromptPreset(cfg.preset);
      if (!nextTemplate.trim()) {
        return NextResponse.json({ success: false, message: "Spec 프롬프트 템플릿이 비어 있습니다." }, { status: 400 });
      }
      const saved = await prisma.specPromptConfig.update({
        where: { projectId: id },
        data: { templatePrompt: nextTemplate, preset: nextPreset },
      });
      specPromptConfigOut = mapSpecPromptConfigRow(saved);
    }

    return NextResponse.json({
      success: true,
      message: "프로젝트 Spec 컨텍스트가 저장되었습니다.",
      data: {
        project: mapProject(updated),
        ...(specPromptConfigOut ? { specPromptConfig: specPromptConfigOut } : {}),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PATCH /api/projects/[projectId]/spec-workspace error:", error);
    return NextResponse.json(
      { success: false, message: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PostBody =
  | { action: "aiRequest"; model?: string; preset?: string; templatePrompt?: string }
  | { action: "confirm"; responseId: string }
  | {
      action: "confirmMerged";
      responseAId: string;
      responseBId: string;
      mergedMarkdown: string;
      selectedSections: Record<string, "A" | "B">;
    }
  | { action: "appendManualSpec"; markdown: string }
  | { action: "refineSpec"; model?: string }
  | { action: "rollbackSpec"; versionId: string };

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
        "POST /api/projects/[projectId]/spec-workspace"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    if (body.action === "aiRequest") {
      let workspaceOpenAiModel: string | null = null;
      const rawModel = typeof body.model === "string" ? body.model.trim() : "";
      if (rawModel) {
        if (!isAllowedSpecWorkspaceModel(rawModel)) {
          return NextResponse.json(
            { success: false, message: "지원하지 않는 모델입니다. gpt-4o, gpt-4.1, gpt-4o-mini 중에서 선택하세요." },
            { status: 400 }
          );
        }
        workspaceOpenAiModel = rawModel;
      }

      const projectFull = await prisma.project.findUnique({ where: { id } });
      if (!projectFull) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const projectForPrompt: Project = {
        id: projectFull.id,
        name: projectFull.name,
        description: projectFull.description,
        projectType: projectFull.projectType,
        status: projectFull.status,
        specCoreGoals: projectFull.specCoreGoals,
        specScopeIn: projectFull.specScopeIn,
        specScopeOut: projectFull.specScopeOut,
        specTargetUsers: projectFull.specTargetUsers,
        specSuccessCriteria: projectFull.specSuccessCriteria,
        executionPlanMarkdown: projectFull.executionPlanMarkdown,
        selectedPlanCandidateId: projectFull.selectedPlanCandidateId,
        confirmedSpecMarkdown: projectFull.confirmedSpecMarkdown,
        confirmedSpecResponseId: projectFull.confirmedSpecResponseId,
        confirmedSpecAt: projectFull.confirmedSpecAt?.toISOString() ?? null,
      };

      const promptCfg = await getOrCreateSpecPromptConfig(id);
      let templatePrompt = promptCfg.templatePrompt.trim();
      let preset = normalizeSpecPromptPreset(promptCfg.preset);
      if (typeof body.templatePrompt === "string") {
        templatePrompt = body.templatePrompt.trim();
      }
      if (typeof body.preset === "string") {
        preset = normalizeSpecPromptPreset(body.preset);
      }
      if (!templatePrompt) {
        return NextResponse.json(
          {
            success: false,
            message: "프롬프트 템플릿이 비어 있으면 Project Spec을 생성할 수 없습니다.",
          },
          { status: 400 }
        );
      }
      if (typeof body.templatePrompt === "string" || typeof body.preset === "string") {
        await prisma.specPromptConfig.update({
          where: { projectId: id },
          data: { templatePrompt, preset },
        });
      }

      let promptText: string;
      try {
        promptText = composeWorkspaceSpecUserMessage(projectForPrompt, workspaceOpenAiModel, {
          templatePrompt,
          preset,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "EXECUTION_PLAN_REQUIRED") {
          return NextResponse.json(
            {
              success: false,
              message: "저장된 실행 계획이 없습니다. 「실행계획 저장」으로 먼저 저장하세요.",
            },
            { status: 400 }
          );
        }
        throw e;
      }
      const agg = await prisma.projectSpecWorkspacePrompt.aggregate({
        where: { projectId: id },
        _max: { version: true },
      });
      const nextVersion = (agg._max.version ?? 0) + 1;
      const promptRow = await prisma.projectSpecWorkspacePrompt.create({
        data: {
          projectId: id,
          version: nextVersion,
          promptText,
          createdByUserId: userId,
        },
      });

      let markdown: string;
      let modelUsed: string;
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
      try {
        const out = await completeWorkspaceSpecMarkdown(promptRow.promptText, workspaceOpenAiModel);
        markdown = out.markdown;
        modelUsed = out.model;
        usage = out.usage;
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
        console.error("completeWorkspaceSpecMarkdown failed:", e);
        return NextResponse.json(
          {
            success: false,
            message: "AI Spec 문서 생성에 실패했습니다. 잠시 후 다시 시도하세요.",
            code: "OPENAI_GENERATE_FAILED",
          },
          { status: 502 }
        );
      }

      const candidatePayload = computeSpecCandidatePayload(markdown);
      const responseRow = await prisma.projectSpecWorkspaceResponse.create({
        data: {
          projectId: id,
          promptId: promptRow.id,
          provider: "openai",
          model: modelUsed,
          responseMarkdown: markdown,
          status: "COMPLETED",
          promptTokens: usage?.promptTokens ?? null,
          completionTokens: usage?.completionTokens ?? null,
          totalTokens: usage?.totalTokens ?? null,
          specCandidateScore: candidatePayload.score,
          specCandidateMeta: candidatePayload.meta,
        },
      });

      const responsePayload: {
        response: ReturnType<typeof mapResponseRow>;
        project?: ReturnType<typeof mapProject>;
      } = {
        response: mapResponseRow(responseRow),
      };

      const mapped = await prisma.project.findUnique({ where: { id }, select: PROJECT_MAP_SELECT });
      if (mapped) {
        responsePayload.project = mapProject(mapped);
      }

      return NextResponse.json({
        success: true,
        message: "AI 응답이 생성되었습니다.",
        data: responsePayload,
      });
    }

    if (body.action === "confirm") {
      const responseId = String(body.responseId ?? "").trim();
      if (!responseId) {
        return NextResponse.json({ success: false, message: "responseId가 필요합니다." }, { status: 400 });
      }
      const resp = await prisma.projectSpecWorkspaceResponse.findFirst({
        where: { id: responseId, projectId: id },
      });
      if (!resp) {
        return NextResponse.json({ success: false, message: "응답을 찾을 수 없습니다." }, { status: 404 });
      }

      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: resp.responseMarkdown,
        sourceType: "RESPONSE",
        sourceData: { responseId: resp.id },
        createdByUserId: userId,
      });

      const updatedProject = await prisma.project.findUnique({
        where: { id },
        select: PROJECT_MAP_SELECT,
      });
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
      });

      return NextResponse.json({
        success: true,
        message: "이 응답을 공식 Project Spec으로 확정했습니다.",
        data: { project: mapProject(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "confirmMerged") {
      const responseAId = String(body.responseAId ?? "").trim();
      const responseBId = String(body.responseBId ?? "").trim();
      const mergedMarkdown = String(body.mergedMarkdown ?? "");
      const selectedSections = body.selectedSections ?? {};

      if (!responseAId || !responseBId) {
        return NextResponse.json({ success: false, message: "responseAId/responseBId가 필요합니다." }, { status: 400 });
      }
      if (!mergedMarkdown.trim()) {
        return NextResponse.json({ success: false, message: "mergedMarkdown이 비어 있습니다." }, { status: 400 });
      }

      const [respA, respB] = await Promise.all([
        prisma.projectSpecWorkspaceResponse.findFirst({ where: { id: responseAId, projectId: id } }),
        prisma.projectSpecWorkspaceResponse.findFirst({ where: { id: responseBId, projectId: id } }),
      ]);

      if (!respA || !respB) {
        return NextResponse.json({ success: false, message: "비교 응답을 찾을 수 없습니다." }, { status: 404 });
      }

      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: mergedMarkdown,
        sourceType: "MERGED_SECTIONS",
        sourceData: {
          responseAId: respA.id,
          responseBId: respB.id,
          selectedSections,
        },
        createdByUserId: userId,
      });

      const updatedProject = await prisma.project.findUnique({
        where: { id },
        select: PROJECT_MAP_SELECT,
      });
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
      });

      return NextResponse.json({
        success: true,
        message: "섹션 병합 결과를 공식 Project Spec으로 확정했습니다.",
        data: { project: mapProject(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "appendManualSpec") {
      const md = String(body.markdown ?? "").trim();
      if (!md) {
        return NextResponse.json({ success: false, message: "markdown이 비어 있습니다." }, { status: 400 });
      }
      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: md,
        sourceType: "MANUAL_EDIT",
        sourceData: null,
        createdByUserId: userId,
      });
      const updatedProject = await prisma.project.findUnique({
        where: { id },
        select: PROJECT_MAP_SELECT,
      });
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
      });
      return NextResponse.json({
        success: true,
        message: "수정 내용을 새 버전으로 저장했습니다.",
        data: { project: mapProject(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "refineSpec") {
      let refineModel: string | null = null;
      const rawRefine = typeof body.model === "string" ? body.model.trim() : "";
      if (rawRefine) {
        if (!isAllowedSpecWorkspaceModel(rawRefine)) {
          return NextResponse.json(
            { success: false, message: "지원하지 않는 모델입니다. gpt-4o, gpt-4.1, gpt-4o-mini 중에서 선택하세요." },
            { status: 400 }
          );
        }
        refineModel = rawRefine;
      }

      const projBase = await prisma.project.findUnique({
        where: { id },
        select: {
          currentSpecVersionId: true,
          currentSpecVersion: { select: { markdown: true } },
          confirmedSpecMarkdown: true,
        },
      });
      if (!projBase) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      const currentMd =
        projBase.currentSpecVersion?.markdown?.trim() || projBase.confirmedSpecMarkdown?.trim() || "";
      if (!currentMd) {
        return NextResponse.json(
          { success: false, message: "확정된 Project Spec이 없어 AI 개선을 실행할 수 없습니다." },
          { status: 400 }
        );
      }

      let refined: string;
      let modelUsed: string;
      try {
        const out = await refineWorkspaceSpecMarkdown(currentMd, refineModel);
        refined = out.markdown;
        modelUsed = out.model;
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
        console.error("refineWorkspaceSpecMarkdown failed:", e);
        return NextResponse.json(
          {
            success: false,
            message: "AI 개선 요청에 실패했습니다. 잠시 후 다시 시도하세요.",
            code: "OPENAI_REFINE_FAILED",
          },
          { status: 502 }
        );
      }

      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: refined,
        sourceType: "AI_REFINE",
        sourceData: {
          model: modelUsed,
          basedOnVersionId: projBase.currentSpecVersionId,
        },
        createdByUserId: userId,
      });

      const updatedProject = await prisma.project.findUnique({
        where: { id },
        select: PROJECT_MAP_SELECT,
      });
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
        model: modelUsed,
      });

      return NextResponse.json({
        success: true,
        message: "현재 스펙을 바탕으로 AI 개선본을 새 버전으로 저장했습니다.",
        data: { project: mapProject(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "rollbackSpec") {
      const versionId = String(body.versionId ?? "").trim();
      if (!versionId) {
        return NextResponse.json({ success: false, message: "versionId가 필요합니다." }, { status: 400 });
      }
      let rolled: { id: string; version: number };
      try {
        rolled = await rollbackProjectSpecToVersion({ projectId: id, versionId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "SPEC_VERSION_NOT_FOUND") {
          return NextResponse.json({ success: false, message: "해당 버전을 찾을 수 없습니다." }, { status: 404 });
        }
        throw e;
      }
      const updatedProject = await prisma.project.findUnique({
        where: { id },
        select: PROJECT_MAP_SELECT,
      });
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: rolled.id,
        userId,
      });
      return NextResponse.json({
        success: true,
        message: "선택한 버전을 현재 활성 스펙으로 되돌렸습니다.",
        data: { project: mapProject(updatedProject), taskDraftSync },
      });
    }

    return NextResponse.json({ success: false, message: "지원하지 않는 action입니다." }, { status: 400 });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/projects/[projectId]/spec-workspace error:", error);
    return NextResponse.json(
      { success: false, message: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

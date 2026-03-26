import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { buildWorkspacePromptText } from "@/lib/project-spec/buildWorkspacePromptText";
import { completeWorkspaceSpecMarkdown } from "@/lib/project-spec/generateSpecContextWithOpenAI";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import type { Project } from "@/components/project-spec/types";

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
  confirmedSpecMarkdown: string | null;
  confirmedSpecResponseId: string | null;
  confirmedSpecAt: Date | null;
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
  | "confirmedSpecMarkdown"
  | "confirmedSpecResponseId"
  | "confirmedSpecAt"
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
    confirmedSpecMarkdown: row.confirmedSpecMarkdown,
    confirmedSpecResponseId: row.confirmedSpecResponseId,
    confirmedSpecAt: row.confirmedSpecAt?.toISOString() ?? null,
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
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        specCoreGoals: true,
        specScopeIn: true,
        specScopeOut: true,
        specTargetUsers: true,
        specSuccessCriteria: true,
        confirmedSpecMarkdown: true,
        confirmedSpecResponseId: true,
        confirmedSpecAt: true,
      },
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

    return NextResponse.json({
      success: true,
      message: "Spec 워크스페이스를 불러왔습니다.",
      data: {
        project: mapProject(projectRow),
        prompts: prompts.map((p) => ({
          id: p.id,
          projectId: p.projectId,
          version: p.version,
          promptText: p.promptText,
          createdAt: p.createdAt.toISOString(),
        })),
        responses: responses.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          promptId: r.promptId,
          provider: r.provider,
          model: r.model,
          responseMarkdown: r.responseMarkdown,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/spec-workspace error:", error);
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

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "수정할 필드가 없습니다." }, { status: 400 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: data as Parameters<typeof prisma.project.update>[0]["data"],
      select: {
        id: true,
        name: true,
        description: true,
        projectType: true,
        specCoreGoals: true,
        specScopeIn: true,
        specScopeOut: true,
        specTargetUsers: true,
        specSuccessCriteria: true,
        confirmedSpecMarkdown: true,
        confirmedSpecResponseId: true,
        confirmedSpecAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "프로젝트 Spec 컨텍스트가 저장되었습니다.",
      data: { project: mapProject(updated) },
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
  | { action: "regeneratePrompt" }
  | { action: "aiRequest"; promptId?: string }
  | { action: "confirm"; responseId: string };

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
      confirmedSpecMarkdown: projectFull.confirmedSpecMarkdown,
      confirmedSpecResponseId: projectFull.confirmedSpecResponseId,
      confirmedSpecAt: projectFull.confirmedSpecAt?.toISOString() ?? null,
    };

    if (body.action === "regeneratePrompt") {
      const promptText = buildWorkspacePromptText(projectForPrompt);
      const agg = await prisma.projectSpecWorkspacePrompt.aggregate({
        where: { projectId: id },
        _max: { version: true },
      });
      const nextVersion = (agg._max.version ?? 0) + 1;
      const created = await prisma.projectSpecWorkspacePrompt.create({
        data: {
          projectId: id,
          version: nextVersion,
          promptText,
          createdByUserId: userId,
        },
      });
      return NextResponse.json({
        success: true,
        message: "프롬프트가 재생성되어 저장되었습니다.",
        data: {
          prompt: {
            id: created.id,
            projectId: created.projectId,
            version: created.version,
            promptText: created.promptText,
            createdAt: created.createdAt.toISOString(),
          },
        },
      });
    }

    if (body.action === "aiRequest") {
      let promptRow = null as Awaited<ReturnType<typeof prisma.projectSpecWorkspacePrompt.findFirst>> | null;
      if (body.promptId) {
        promptRow = await prisma.projectSpecWorkspacePrompt.findFirst({
          where: { id: body.promptId, projectId: id },
        });
      } else {
        promptRow = await prisma.projectSpecWorkspacePrompt.findFirst({
          where: { projectId: id },
          orderBy: { version: "desc" },
        });
      }
      if (!promptRow) {
        const promptText = buildWorkspacePromptText(projectForPrompt);
        const agg = await prisma.projectSpecWorkspacePrompt.aggregate({
          where: { projectId: id },
          _max: { version: true },
        });
        const nextVersion = (agg._max.version ?? 0) + 1;
        promptRow = await prisma.projectSpecWorkspacePrompt.create({
          data: {
            projectId: id,
            version: nextVersion,
            promptText,
            createdByUserId: userId,
          },
        });
      }

      let markdown: string;
      let modelUsed: string;
      try {
        const out = await completeWorkspaceSpecMarkdown(promptRow.promptText);
        markdown = out.markdown;
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

      const responseRow = await prisma.projectSpecWorkspaceResponse.create({
        data: {
          projectId: id,
          promptId: promptRow.id,
          provider: "openai",
          model: modelUsed,
          responseMarkdown: markdown,
          status: "COMPLETED",
        },
      });

      return NextResponse.json({
        success: true,
        message: "AI 응답이 생성되었습니다.",
        data: {
          response: {
            id: responseRow.id,
            projectId: responseRow.projectId,
            promptId: responseRow.promptId,
            provider: responseRow.provider,
            model: responseRow.model,
            responseMarkdown: responseRow.responseMarkdown,
            status: responseRow.status,
            createdAt: responseRow.createdAt.toISOString(),
          },
        },
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

      const updatedProject = await prisma.project.update({
        where: { id },
        data: {
          confirmedSpecMarkdown: resp.responseMarkdown,
          confirmedSpecResponseId: resp.id,
          confirmedSpecAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          description: true,
          projectType: true,
          specCoreGoals: true,
          specScopeIn: true,
          specScopeOut: true,
          specTargetUsers: true,
          specSuccessCriteria: true,
          confirmedSpecMarkdown: true,
          confirmedSpecResponseId: true,
          confirmedSpecAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "이 응답을 공식 Project Spec으로 확정했습니다.",
        data: { project: mapProject(updatedProject) },
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

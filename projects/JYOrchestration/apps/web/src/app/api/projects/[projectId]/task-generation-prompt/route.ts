import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { DEFAULT_TASK_GENERATION_PROMPT_TEMPLATE } from "@/lib/project-spec/taskGenerationPromptTemplate";

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
    if (userId instanceof NextResponse) return userId;

    await requireProjectPermissionById(
      id,
      userId,
      "canGenerateTask",
      "GET /api/projects/[projectId]/task-generation-prompt"
    );

    const proj = await prisma.project.findUnique({
      where: { id },
      select: { taskGenerationPrompt: true },
    });
    if (!proj) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        taskGenerationPrompt: proj.taskGenerationPrompt ?? null,
        defaultPrompt: DEFAULT_TASK_GENERATION_PROMPT_TEMPLATE,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/task-generation-prompt error:", error);
    return NextResponse.json(
      { success: false, message: "Task 생성 프롬프트 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

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
    if (userId instanceof NextResponse) return userId;

    await requireProjectPermissionById(
      id,
      userId,
      "canGenerateTask",
      "PATCH /api/projects/[projectId]/task-generation-prompt"
    );

    let body: { taskGenerationPrompt?: string | null };
    try {
      body = (await request.json()) as { taskGenerationPrompt?: string | null };
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
    }

    const raw = typeof body.taskGenerationPrompt === "string" ? body.taskGenerationPrompt : null;
    const next = raw == null ? null : raw.trim();

    const updated = await prisma.project.update({
      where: { id },
      data: { taskGenerationPrompt: next && next.length > 0 ? next : null },
      select: { taskGenerationPrompt: true },
    });

    return NextResponse.json({
      success: true,
      message: "Task 생성 프롬프트가 저장되었습니다.",
      data: { taskGenerationPrompt: updated.taskGenerationPrompt ?? null },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("PATCH /api/projects/[projectId]/task-generation-prompt error:", error);
    return NextResponse.json(
      { success: false, message: "Task 생성 프롬프트 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

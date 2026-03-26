import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { deleteTaskDraft } from "@/lib/project-spec/confirmTaskDraftsService";

function normalizePriority(p: string): string {
  const u = p.toUpperCase().trim();
  if (u === "HIGH" || u === "LOW" || u === "MEDIUM") {
    return u;
  }
  return "MEDIUM";
}

type PatchBody = {
  title?: string;
  description?: string | null;
  priority?: string;
  dependsOn?: string[];
  dependsOnIds?: string[];
  acceptanceCriteria?: string[];
  positionX?: number;
  positionY?: number;
  stage?: string;
};

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string; draftId: string }> }
) {
  try {
    const { projectId, draftId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    const did = String(draftId ?? "").trim();
    if (!pid || !did) {
      return NextResponse.json({ success: false, message: "projectId/draftId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canGenerateTask",
        "PATCH /api/projects/[projectId]/task-drafts/[draftId]"
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

    const existing = await prisma.taskDraft.findFirst({
      where: { id: did, projectId: pid, status: "DRAFT" },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "수정할 DRAFT 초안을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const t = String(body.title ?? "").trim();
      if (!t) {
        return NextResponse.json({ success: false, message: "title은 비울 수 없습니다." }, { status: 400 });
      }
      data.title = t.slice(0, 500);
    }
    if (body.description !== undefined) {
      data.description = body.description === null ? null : String(body.description).slice(0, 8000);
    }
    if (body.priority !== undefined) {
      data.priority = normalizePriority(String(body.priority ?? ""));
    }
    if (body.dependsOn !== undefined) {
      data.dependsOn = Array.isArray(body.dependsOn)
        ? body.dependsOn.map((x) => String(x).trim()).filter(Boolean).slice(0, 30)
        : [];
    }
    if (body.dependsOnIds !== undefined) {
      data.dependsOnIds = Array.isArray(body.dependsOnIds)
        ? body.dependsOnIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 50)
        : [];
    }
    if (body.acceptanceCriteria !== undefined) {
      data.acceptanceCriteria = Array.isArray(body.acceptanceCriteria)
        ? body.acceptanceCriteria.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
        : [];
    }
    if (body.positionX !== undefined) {
      const n = Number(body.positionX);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ success: false, message: "positionX는 숫자여야 합니다." }, { status: 400 });
      }
      data.positionX = n;
    }
    if (body.positionY !== undefined) {
      const n = Number(body.positionY);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ success: false, message: "positionY는 숫자여야 합니다." }, { status: 400 });
      }
      data.positionY = n;
    }
    if (body.stage !== undefined) {
      const s = String(body.stage ?? "").trim();
      if (!s) {
        return NextResponse.json({ success: false, message: "stage는 비울 수 없습니다." }, { status: 400 });
      }
      data.stage = s.slice(0, 40);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "수정할 필드가 없습니다." }, { status: 400 });
    }

    const updated = await prisma.taskDraft.update({
      where: { id: did },
      data: data as Parameters<typeof prisma.taskDraft.update>[0]["data"],
      include: { specVersion: { select: { version: true } } },
    });

    return NextResponse.json({
      success: true,
      message: "Task 초안을 수정했습니다.",
      data: {
        id: updated.id,
        projectId: updated.projectId,
        specVersionId: updated.specVersionId,
        specVersionNumber: updated.specVersion.version,
        title: updated.title,
        description: updated.description,
        priority: updated.priority,
        dependsOn: Array.isArray(updated.dependsOn)
          ? (updated.dependsOn as string[])
          : [],
        dependsOnIds: Array.isArray((updated as unknown as { dependsOnIds?: unknown }).dependsOnIds)
          ? ((updated as unknown as { dependsOnIds: unknown }).dependsOnIds as string[])
          : [],
        acceptanceCriteria: Array.isArray(updated.acceptanceCriteria)
          ? (updated.acceptanceCriteria as string[])
          : [],
        positionX: Number((updated as unknown as { positionX?: unknown }).positionX ?? 0),
        positionY: Number((updated as unknown as { positionY?: unknown }).positionY ?? 0),
        stage: String((updated as unknown as { stage?: unknown }).stage ?? "Build"),
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PATCH /api/projects/[projectId]/task-drafts/[draftId] error:", error);
    return NextResponse.json(
      { success: false, message: "수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string; draftId: string }> }
) {
  try {
    const { projectId, draftId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    const did = String(draftId ?? "").trim();
    if (!pid || !did) {
      return NextResponse.json({ success: false, message: "projectId/draftId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canGenerateTask",
        "DELETE /api/projects/[projectId]/task-drafts/[draftId]"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const { deleted } = await deleteTaskDraft({ projectId: pid, draftId: did });
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "삭제할 DRAFT 초안을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Task 초안을 삭제했습니다." });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("DELETE /api/projects/[projectId]/task-drafts/[draftId] error:", error);
    return NextResponse.json(
      { success: false, message: "삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

function jsonArrayFromDb(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
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
      await requireProjectPermissionById(id, userId, "canViewProject", "GET /api/projects/[projectId]/task-drafts");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const statusFilter = request.nextUrl.searchParams.get("status")?.trim() || "";

    const rows = await prisma.taskDraft.findMany({
      where: {
        projectId: id,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        specVersion: { select: { id: true, version: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Task 초안 목록을 조회했습니다.",
      data: rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        specVersionId: r.specVersionId,
        specVersionNumber: r.specVersion.version,
        title: r.title,
        description: r.description,
        priority: r.priority,
        dependsOn: jsonArrayFromDb(r.dependsOn),
        acceptanceCriteria: jsonArrayFromDb(r.acceptanceCriteria),
        status: r.status,
        sourceModel: r.sourceModel,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/projects/[projectId]/task-drafts error:", error);
    return NextResponse.json(
      { success: false, message: "Task 초안 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

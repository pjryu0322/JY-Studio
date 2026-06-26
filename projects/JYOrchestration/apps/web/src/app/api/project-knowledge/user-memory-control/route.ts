import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  loadUserProjectKnowledgeMemoryControlForProject,
  patchUserProjectKnowledgeMemoryControlForProject,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";

function parseProjectId(request: NextRequest): string {
  const fromQuery = String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
  return fromQuery;
}

export async function GET(request: NextRequest) {
  try {
    const projectId = parseProjectId(request);
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(projectId, userId, "canViewProject", "GET user-memory-control");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const control = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
    return NextResponse.json({ success: true, control });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET user-memory-control error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const projectId = String(body?.projectId ?? parseProjectId(request) ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const patchRaw = body?.patch;
    if (!patchRaw || typeof patchRaw !== "object") {
      return NextResponse.json({ success: false, message: "patch 객체가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(projectId, userId, "canEditProject", "PATCH user-memory-control");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const control = await patchUserProjectKnowledgeMemoryControlForProject({
      projectId,
      patch: patchRaw as Partial<UserProjectKnowledgeMemoryControlV1>,
    });

    return NextResponse.json({ success: true, control });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("PATCH user-memory-control error:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

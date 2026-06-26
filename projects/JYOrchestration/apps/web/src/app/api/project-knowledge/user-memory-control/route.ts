import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  loadUserProjectKnowledgeMemoryControlForProject,
  patchUserProjectKnowledgeMemoryControlForProject,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";
import {
  applyUserMemoryControlActionToPatch,
  UserMemoryControlActionNotFoundError,
  type UserMemoryControlAction,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlActionService";

function parseProjectId(request: NextRequest): string {
  return String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
}

function parseUserMemoryControlAction(raw: unknown): UserMemoryControlAction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = String(o.type ?? "").trim();
  switch (type) {
    case "SET_ENABLED":
      return typeof o.enabled === "boolean" ? { type: "SET_ENABLED", enabled: o.enabled } : null;
    case "SET_AGENT_ENABLED": {
      const agent = String(o.agent ?? "").trim();
      return agent && typeof o.enabled === "boolean"
        ? { type: "SET_AGENT_ENABLED", agent, enabled: o.enabled }
        : null;
    }
    case "PIN_MEMORY_ITEM":
    case "UNPIN_MEMORY_ITEM":
    case "IGNORE_MEMORY_ITEM":
    case "UNIGNORE_MEMORY_ITEM":
    case "EXCLUDE_SOURCE_PROJECT": {
      const actionId = String(o.actionId ?? "").trim();
      return actionId ? ({ type, actionId } as UserMemoryControlAction) : null;
    }
    default:
      return null;
  }
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

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(projectId, userId, "canEditProject", "PATCH user-memory-control");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const actionRaw = body?.action;
    const patchRaw = body?.patch;

    if (actionRaw !== undefined) {
      const action = parseUserMemoryControlAction(actionRaw);
      if (!action) {
        return NextResponse.json({ success: false, message: "action 형식이 올바르지 않습니다." }, { status: 400 });
      }
      try {
        const current = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
        const patch = await applyUserMemoryControlActionToPatch({
          userId,
          projectId,
          action,
          currentControl: current,
        });
        const control = await patchUserProjectKnowledgeMemoryControlForProject({
          projectId,
          patch,
        });
        return NextResponse.json({ success: true, control });
      } catch (error) {
        if (error instanceof UserMemoryControlActionNotFoundError) {
          return NextResponse.json({ success: false, message: error.message }, { status: 404 });
        }
        throw error;
      }
    }

    if (!patchRaw || typeof patchRaw !== "object") {
      return NextResponse.json(
        { success: false, message: "patch 또는 action이 필요합니다." },
        { status: 400 },
      );
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

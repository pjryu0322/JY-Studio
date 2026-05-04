import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireProjectOwnerMemberAdmin } from "@/lib/service/projectMemberService";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { allCatalogMemberIds } from "@/lib/workspace-ai/workspaceScreenKeys";
import {
  getWorkspaceAiGraphForProject,
  replaceWorkspaceAiGraph,
  type WorkspaceAiGraphSaveMemberInput,
} from "@/lib/service/workspaceAiMemberGraphService";
import { parseWorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

type PutMember = {
  catalogKey?: string;
  enabled?: boolean;
  screenKeys?: string[];
};

function parseCatalogKey(raw: string): WorkspaceAiMemberId | null {
  const k = String(raw ?? "").trim();
  const set = new Set(allCatalogMemberIds());
  return set.has(k as WorkspaceAiMemberId) ? (k as WorkspaceAiMemberId) : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/project/workspace-ai");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const members = await getWorkspaceAiGraphForProject(projectId);
    return NextResponse.json({ success: true, data: { members } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/project/workspace-ai error:", error);
    return NextResponse.json({ success: false, message: "워크스페이스 AI 설정 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as { projectId?: string; members?: PutMember[] };
    const projectId = String(body.projectId ?? "").trim();
    const rawMembers = Array.isArray(body.members) ? body.members : [];
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectOwnerMemberAdmin(projectId, userId, "PUT /api/project/workspace-ai");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const members: WorkspaceAiGraphSaveMemberInput[] = [];
    for (const row of rawMembers) {
      const catalogKey = parseCatalogKey(String(row.catalogKey ?? ""));
      if (!catalogKey) {
        return NextResponse.json({ success: false, message: "유효하지 않은 catalogKey가 있습니다." }, { status: 400 });
      }
      const enabled = Boolean(row.enabled);
      const skRaw = Array.isArray(row.screenKeys) ? row.screenKeys : [];
      const screenKeys = skRaw.map((s) => parseWorkspaceScreenKey(s)).filter(Boolean) as WorkspaceAiGraphSaveMemberInput["screenKeys"];
      members.push({ catalogKey, enabled, screenKeys });
    }

    const expected = allCatalogMemberIds().length;
    if (members.length !== expected) {
      return NextResponse.json(
        { success: false, message: `members 배열은 카탈로그 전체(${expected}행)를 포함해야 합니다.` },
        { status: 400 }
      );
    }

    await replaceWorkspaceAiGraph(projectId, members);
    const next = await getWorkspaceAiGraphForProject(projectId);
    return NextResponse.json({ success: true, data: { members: next } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("PUT /api/project/workspace-ai error:", error);
    return NextResponse.json({ success: false, message: "워크스페이스 AI 설정 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

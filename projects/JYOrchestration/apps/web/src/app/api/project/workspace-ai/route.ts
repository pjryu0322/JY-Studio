import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireProjectOwnerMemberAdmin } from "@/lib/service/projectMemberService";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { prisma } from "@/lib/prisma";
import {
  getWorkspaceAiGraphWireWithMemberPrefs,
  getWorkspaceAiOwnerIntegrationPicklists,
  replaceWorkspaceAiGraph,
  type WorkspaceAiGraphSaveMemberInput,
} from "@/lib/service/workspaceAiMemberGraphService";
import { upsertCatalogKeyedAiMemberProviderPrefs } from "@/lib/service/projectMemberService";
import { allCatalogMemberIds, parseWorkspaceScreenKey, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";
import {
  deriveProjectAiAgentUiState,
  persistPrefsFromUi,
  type ProjectAiAgentUiEngine,
  type ProjectAiAgentUiModel,
} from "@/lib/workspace-ai/projectAiAgentEngineModel";
import { parseEnginePreferenceKey } from "@/lib/workspace-ai/workspaceAiEnginePreference";

type PutMember = {
  catalogKey?: string;
  enabled?: boolean;
  screenKeys?: string[];
  screens?: readonly { screenKey?: string; autoRun?: boolean }[];
  enginePreference?: string | null;
  pinnedUserIntegrationId?: string | null;
  /** 신규 클라이언트: 엔진·모델 UI 상태(검증 후 그래프+project_members에 반영) */
  agentUi?: { engine?: string; model?: string };
};

function parseAgentUiEngine(raw: unknown): ProjectAiAgentUiEngine | null {
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "USER_DEFAULT") return "USER_DEFAULT";
  if (u === "OPENAI") return "OPENAI";
  if (u === "CURSOR") return "CURSOR";
  return null;
}

function parseAgentUiModel(raw: unknown): ProjectAiAgentUiModel | null {
  const t = String(raw ?? "").trim();
  if (t === "USER_DEFAULT") return "USER_DEFAULT";
  if (t === "GPT-5") return "GPT-5";
  if (t === "GPT-4.1") return "GPT-4.1";
  if (t === "o3") return "o3";
  if (t === "cursor-default") return "cursor-default";
  return null;
}

function persistPrefsForPutMember(catalogKey: WorkspaceAiMemberId, row: PutMember) {
  const ue = parseAgentUiEngine(row.agentUi?.engine);
  const um = parseAgentUiModel(row.agentUi?.model);
  if (ue && um) {
    return persistPrefsFromUi({ catalogKey, uiEngine: ue, uiModel: um });
  }
  const ge = parseEnginePreferenceKey(row.enginePreference ?? "USER_DEFAULT") ?? "USER_DEFAULT";
  const inferred = deriveProjectAiAgentUiState({
    catalogKey,
    graphEnginePreference: ge,
    memberAiProvider: null,
    memberAiModelOverride: null,
  });
  return persistPrefsFromUi({
    catalogKey,
    uiEngine: inferred.uiEngine,
    uiModel: inferred.uiModel,
  });
}

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

    const [members, proj] = await Promise.all([
      getWorkspaceAiGraphWireWithMemberPrefs(projectId),
      prisma.project.findUnique({ where: { id: projectId }, select: { ownerUserId: true } }),
    ]);
    const ownerUserId = String(proj?.ownerUserId ?? "").trim();
    const integrationPicklists = ownerUserId ? await getWorkspaceAiOwnerIntegrationPicklists(ownerUserId) : { LLM: [], CODE_AGENT: [] };
    return NextResponse.json({ success: true, data: { members, integrationPicklists } });
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

    const projRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerUserId: true },
    });
    const ownerUserIdForSync = String(projRow?.ownerUserId ?? "").trim();
    if (!ownerUserIdForSync) {
      return NextResponse.json({ success: false, message: "프로젝트 소유자를 찾을 수 없습니다." }, { status: 400 });
    }

    const members: WorkspaceAiGraphSaveMemberInput[] = [];
    const memberPrefRows: { catalogKey: WorkspaceAiMemberId; aiProvider: string | null; aiModelOverride: string | null }[] =
      [];

    for (const row of rawMembers) {
      const catalogKey = parseCatalogKey(String(row.catalogKey ?? ""));
      if (!catalogKey) {
        return NextResponse.json({ success: false, message: "유효하지 않은 catalogKey가 있습니다." }, { status: 400 });
      }
      const enabled = Boolean(row.enabled);
      const screensRaw = Array.isArray(row.screens) ? row.screens : [];
      const screens =
        screensRaw.length > 0
          ? (screensRaw
              .map((s) => {
                const sk = parseWorkspaceScreenKey(s?.screenKey);
                if (!sk) return null;
                return { screenKey: sk, autoRun: Boolean(s?.autoRun) };
              })
              .filter(Boolean) as { screenKey: WorkspaceScreenKey; autoRun: boolean }[])
          : undefined;
      const skRaw = Array.isArray(row.screenKeys) ? row.screenKeys : [];
      const screenKeys = skRaw.map((s) => parseWorkspaceScreenKey(s)).filter(Boolean) as WorkspaceScreenKey[];
      const hasPinKey = Object.prototype.hasOwnProperty.call(row, "pinnedUserIntegrationId");
      const pinnedUserIntegrationId = !hasPinKey
        ? undefined
        : row.pinnedUserIntegrationId === null || row.pinnedUserIntegrationId === ""
          ? null
          : String(row.pinnedUserIntegrationId).trim() || null;

      const persisted = persistPrefsForPutMember(catalogKey, row);
      memberPrefRows.push({
        catalogKey,
        aiProvider: persisted.aiProvider,
        aiModelOverride: persisted.aiModelOverride,
      });

      members.push({
        catalogKey,
        enabled,
        ...(screens?.length ? { screens } : { screenKeys }),
        enginePreference: persisted.graphEnginePreference,
        pinnedUserIntegrationId,
      });
    }

    const expected = allCatalogMemberIds().length;
    if (members.length !== expected) {
      return NextResponse.json(
        { success: false, message: `members 배열은 카탈로그 전체(${expected}행)를 포함해야 합니다.` },
        { status: 400 }
      );
    }

    await replaceWorkspaceAiGraph(projectId, members);
    await upsertCatalogKeyedAiMemberProviderPrefs({
      projectId,
      invitedByUserId: ownerUserIdForSync,
      rows: memberPrefRows,
    });
    const next = await getWorkspaceAiGraphWireWithMemberPrefs(projectId);
    return NextResponse.json({ success: true, data: { members: next } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("PUT /api/project/workspace-ai error:", error);
    return NextResponse.json({ success: false, message: "워크스페이스 AI 설정 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

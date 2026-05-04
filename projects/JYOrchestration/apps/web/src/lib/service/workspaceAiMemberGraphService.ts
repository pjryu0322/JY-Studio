import { prisma } from "@/lib/prisma";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import {
  allCatalogMemberIds,
  defaultScreenKeysForCatalogMember,
  parseWorkspaceScreenKey,
  resolveEnabledCatalogKeysForScreen,
  type WorkspaceScreenKey,
} from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";

export type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";

function parseCatalogKey(raw: string): WorkspaceAiMemberId | null {
  const keys = allCatalogMemberIds();
  return keys.includes(raw as WorkspaceAiMemberId) ? (raw as WorkspaceAiMemberId) : null;
}

function normalizeScreenKeys(raw: readonly { screenKey: string }[]): WorkspaceScreenKey[] {
  const out: WorkspaceScreenKey[] = [];
  for (const r of raw) {
    const p = parseWorkspaceScreenKey(r.screenKey);
    if (p) out.push(p);
  }
  return out;
}

/**
 * 관리 UI·보내기용 전체 그래프(카탈로그 전 행 보장).
 * DB에 `workspace_ai_member`가 하나도 없으면 레거시 기본 스크린만 채워 synthetic 행으로 반환.
 */
export async function getWorkspaceAiGraphForProject(projectId: string): Promise<WorkspaceAiGraphMemberWire[]> {
  const pid = projectId.trim();
  if (!pid) return [];

  const rows = await prisma.workspaceAiMember.findMany({
    where: { projectId: pid },
    include: { screenMappings: { select: { screenKey: true } } },
    orderBy: { catalogKey: "asc" },
  });
  const byCatalog = new Map(rows.map((r) => [r.catalogKey, r]));

  return allCatalogMemberIds().map((catalogKey) => {
    const row = byCatalog.get(catalogKey);
    if (row) {
      return {
        rowId: row.id,
        catalogKey,
        enabled: row.enabled,
        screenKeys: normalizeScreenKeys(row.screenMappings),
      };
    }
    return {
      rowId: null,
      catalogKey,
      enabled: true,
      screenKeys: [...defaultScreenKeysForCatalogMember(catalogKey)],
    };
  });
}

/**
 * 특정 화면에 참여하는 AI(카탈로그 키) — DB+enabled+`NEXT_PUBLIC_AI_MEMBER_*` 반영.
 * DB 그래프가 비어 있으면 레거시 1:1 기본.
 */
export async function getEnabledCatalogKeysForScreen(
  projectId: string,
  screenKey: WorkspaceScreenKey
): Promise<WorkspaceAiMemberId[]> {
  const graph = await getWorkspaceAiGraphForProject(projectId);
  return resolveEnabledCatalogKeysForScreen(graph, screenKey);
}

export type WorkspaceAiGraphSaveMemberInput = {
  readonly catalogKey: WorkspaceAiMemberId;
  readonly enabled: boolean;
  readonly screenKeys: readonly WorkspaceScreenKey[];
};

export async function replaceWorkspaceAiGraph(projectId: string, members: readonly WorkspaceAiGraphSaveMemberInput[]): Promise<void> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId required");

  const catalogSet = new Set(allCatalogMemberIds());
  for (const m of members) {
    if (!catalogSet.has(m.catalogKey)) throw new Error(`invalid catalogKey: ${m.catalogKey}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const m of members) {
      const row = await tx.workspaceAiMember.upsert({
        where: { projectId_catalogKey: { projectId: pid, catalogKey: m.catalogKey } },
        create: {
          projectId: pid,
          catalogKey: m.catalogKey,
          enabled: m.enabled,
        },
        update: {
          enabled: m.enabled,
        },
      });
      await tx.workspaceScreenAiMapping.deleteMany({ where: { workspaceAiMemberId: row.id } });
      for (const sk of m.screenKeys) {
        await tx.workspaceScreenAiMapping.create({
          data: { workspaceAiMemberId: row.id, screenKey: sk },
        });
      }
      await tx.aiMemberProvider.upsert({
        where: { workspaceAiMemberId_capability: { workspaceAiMemberId: row.id, capability: "LLM" } },
        create: { workspaceAiMemberId: row.id, capability: "LLM" },
        update: {},
      });
    }
  });
}

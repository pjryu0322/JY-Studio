import { randomUUID } from "crypto";
import {
  dbRowToKnowledgePack,
  DEFAULT_AGENT_CATEGORY_MAPPINGS,
  isStaticKnowledgePackId,
  knowledgePackFieldsToSections,
  mergeStaticAndDbKnowledgePacks,
} from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { DEVELOPER_SEED_KNOWLEDGE_PACKS, getKnowledgePackById } from "@/lib/knowledge-packs/developerGridPacks";
import type { KnowledgePack } from "@/lib/knowledge-packs/types";
import { prisma } from "@/lib/prisma";

export function newKnowledgePackDbId(): string {
  return `kp_${randomUUID().replace(/-/g, "")}`;
}

function bumpSemverPatch(version: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return "1.0.1";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]) + 1;
  return `${major}.${minor}.${patch}`;
}

export async function listDbKnowledgePacksForUser(ownerUserId: string): Promise<KnowledgePack[]> {
  const rows = await prisma.kpKnowledgePack.findMany({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
  });
  const out: KnowledgePack[] = [];
  for (const row of rows) {
    const ver = row.currentVersionId
      ? await prisma.kpKnowledgePackVersion.findUnique({
          where: { id: row.currentVersionId },
          include: { sections: { orderBy: { sortOrder: "asc" } } },
        })
      : null;
    out.push(
      dbRowToKnowledgePack({
        id: row.id,
        name: row.name,
        scope: row.scope,
        category: row.category,
        summary: row.summary,
        description: row.description,
        vendor: row.vendor,
        licenseType: row.licenseType,
        status: row.status,
        agentsJson: row.agentsJson,
        currentVersion: ver
          ? { version: ver.version, sections: ver.sections.map((s) => ({ sectionKey: s.sectionKey, content: s.content })) }
          : null,
      })
    );
  }
  return out;
}

export async function getDbKnowledgePackById(id: string, ownerUserId: string): Promise<KnowledgePack | null> {
  const row = await prisma.kpKnowledgePack.findFirst({ where: { id, ownerUserId } });
  if (!row) return null;
  const ver = row.currentVersionId
    ? await prisma.kpKnowledgePackVersion.findUnique({
        where: { id: row.currentVersionId },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      })
    : null;
  return dbRowToKnowledgePack({
    id: row.id,
    name: row.name,
    scope: row.scope,
    category: row.category,
    summary: row.summary,
    description: row.description,
    vendor: row.vendor,
    licenseType: row.licenseType,
    status: row.status,
    agentsJson: row.agentsJson,
    currentVersion: ver
      ? { version: ver.version, sections: ver.sections.map((s) => ({ sectionKey: s.sectionKey, content: s.content })) }
      : null,
  });
}

export type CreateKnowledgePackInput = Readonly<{
  scope: string;
  category: string;
  name: string;
  summary: string;
  description: string;
  vendor: string;
  licenseType: string;
  status: string;
  licenseNotes: readonly string[];
  agents: readonly string[];
  sections: Parameters<typeof knowledgePackFieldsToSections>[2];
}>;

export async function createKnowledgePack(ownerUserId: string, input: CreateKnowledgePackInput): Promise<KnowledgePack> {
  const id = newKnowledgePackDbId();
  const versionId = randomUUID().replace(/-/g, "");
  const sectionRows = knowledgePackFieldsToSections(input.summary, input.licenseNotes, input.sections);
  const agentsJson = JSON.stringify(input.agents.length ? input.agents : ["AI_DEVELOPER"]);

  await prisma.$transaction(async (tx) => {
    await tx.kpKnowledgePack.create({
      data: {
        id,
        scope: input.scope,
        category: input.category,
        name: input.name,
        summary: input.summary,
        description: input.description,
        vendor: input.vendor,
        licenseType: input.licenseType,
        status: input.status,
        currentVersionId: versionId,
        ownerUserId,
        organizationId: null,
        projectId: null,
        isSystem: false,
        agentsJson,
      },
    });
    await tx.kpKnowledgePackVersion.create({
      data: {
        id: versionId,
        knowledgePackId: id,
        version: "1.0.0",
        changeSummary: "최초 등록",
        sourceType: "MANUAL",
        status: input.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
        createdBy: ownerUserId,
      },
    });
    for (const s of sectionRows) {
      await tx.kpKnowledgePackSection.create({
        data: {
          versionId,
          sectionKey: s.key,
          content: s.content,
          sortOrder: s.sortOrder,
        },
      });
    }
    await tx.kpKnowledgePackHistory.create({
      data: {
        knowledgePackId: id,
        versionId,
        action: "CREATED",
        actorId: ownerUserId,
        actorType: "USER",
        summary: `지식팩 생성: ${input.name}`,
      },
    });
  });

  const created = await getDbKnowledgePackById(id, ownerUserId);
  if (!created) throw new Error("createKnowledgePack: read back failed");
  return created;
}

export type PatchKnowledgePackInput = Readonly<{
  name: string;
  summary: string;
  description: string;
  vendor: string;
  licenseType: string;
  status: string;
  changeSummary: string;
  licenseNotes: readonly string[];
  agents: readonly string[];
  sections: Parameters<typeof knowledgePackFieldsToSections>[2];
}>;

export async function patchKnowledgePack(
  packId: string,
  ownerUserId: string,
  input: PatchKnowledgePackInput
): Promise<KnowledgePack> {
  const row = await prisma.kpKnowledgePack.findFirst({ where: { id: packId, ownerUserId } });
  if (!row) throw new Error("NOT_FOUND");

  const prev = row.currentVersionId
    ? await prisma.kpKnowledgePackVersion.findUnique({ where: { id: row.currentVersionId } })
    : null;
  const nextVersionStr = prev ? bumpSemverPatch(prev.version) : "1.0.0";
  const versionId = randomUUID().replace(/-/g, "");
  const sectionRows = knowledgePackFieldsToSections(input.summary, input.licenseNotes, input.sections);
  const agentsJson = JSON.stringify(input.agents.length ? input.agents : ["AI_DEVELOPER"]);

  await prisma.$transaction(async (tx) => {
    await tx.kpKnowledgePackVersion.create({
      data: {
        id: versionId,
        knowledgePackId: packId,
        version: nextVersionStr,
        changeSummary: input.changeSummary || "수정",
        sourceType: "MANUAL",
        status: input.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
        createdBy: ownerUserId,
      },
    });
    for (const s of sectionRows) {
      await tx.kpKnowledgePackSection.create({
        data: {
          versionId,
          sectionKey: s.key,
          content: s.content,
          sortOrder: s.sortOrder,
        },
      });
    }
    await tx.kpKnowledgePack.update({
      where: { id: packId },
      data: {
        name: input.name,
        summary: input.summary,
        description: input.description,
        vendor: input.vendor,
        licenseType: input.licenseType,
        status: input.status,
        currentVersionId: versionId,
        agentsJson,
      },
    });
    await tx.kpKnowledgePackHistory.create({
      data: {
        knowledgePackId: packId,
        versionId,
        action: "VERSION_CREATED",
        actorId: ownerUserId,
        actorType: "USER",
        summary: input.changeSummary || `새 버전 ${nextVersionStr}`,
      },
    });
    await tx.kpKnowledgePackHistory.create({
      data: {
        knowledgePackId: packId,
        versionId,
        action: "UPDATED",
        actorId: ownerUserId,
        actorType: "USER",
        summary: `내용 갱신 (${nextVersionStr})`,
      },
    });
  });

  const updated = await getDbKnowledgePackById(packId, ownerUserId);
  if (!updated) throw new Error("patchKnowledgePack: read back failed");
  return updated;
}

export async function activateKnowledgePack(packId: string, ownerUserId: string): Promise<KnowledgePack> {
  const row = await prisma.kpKnowledgePack.findFirst({ where: { id: packId, ownerUserId } });
  if (!row?.currentVersionId) throw new Error("NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.kpKnowledgePack.update({
      where: { id: packId },
      data: { status: "ACTIVE" },
    });
    await tx.kpKnowledgePackVersion.update({
      where: { id: row.currentVersionId! },
      data: { status: "ACTIVE" },
    });
    await tx.kpKnowledgePackHistory.create({
      data: {
        knowledgePackId: packId,
        versionId: row.currentVersionId,
        action: "ACTIVATED",
        actorId: ownerUserId,
        actorType: "USER",
        summary: "ACTIVE 로 전환",
      },
    });
  });
  const u = await getDbKnowledgePackById(packId, ownerUserId);
  if (!u) throw new Error("activateKnowledgePack: read back failed");
  return u;
}

export async function listPackHistory(packId: string, ownerUserId: string) {
  const row = await prisma.kpKnowledgePack.findFirst({ where: { id: packId, ownerUserId }, select: { id: true } });
  if (!row) return [];
  return prisma.kpKnowledgePackHistory.findMany({
    where: { knowledgePackId: packId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllHistory(
  ownerUserId: string,
  filters?: { packId?: string; action?: string; actorType?: string }
) {
  const packRows = await prisma.kpKnowledgePack.findMany({
    where: { ownerUserId },
    select: { id: true },
  });
  const ids = packRows.map((p) => p.id);
  if (!ids.length) return [];
  if (filters?.packId && !ids.includes(filters.packId)) return [];
  const inIds = filters?.packId ? [filters.packId] : ids;
  return prisma.kpKnowledgePackHistory.findMany({
    where: {
      knowledgePackId: { in: inIds },
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.actorType ? { actorType: filters.actorType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function getHistoryWithPackNames(
  ownerUserId: string,
  filters?: { packId?: string; action?: string; actorType?: string }
) {
  const rows = await listAllHistory(ownerUserId, filters);
  const packs = await prisma.kpKnowledgePack.findMany({
    where: { ownerUserId },
    select: { id: true, name: true },
  });
  const nameById = new Map(packs.map((p) => [p.id, p.name] as const));
  return rows.map((h) => ({
    ...h,
    packName: nameById.get(h.knowledgePackId) ?? h.knowledgePackId,
  }));
}

export async function ensureDefaultAgentMappings(): Promise<void> {
  const n = await prisma.kpAgentCategoryMapping.count();
  if (n > 0) return;
  for (const m of DEFAULT_AGENT_CATEGORY_MAPPINGS) {
    await prisma.kpAgentCategoryMapping.create({
      data: {
        agentRole: m.agentRole,
        category: m.category,
        enabled: m.enabled,
        usageMode: m.usageMode,
        priority: m.priority,
      },
    });
  }
}

export async function listAgentMappings() {
  await ensureDefaultAgentMappings();
  return prisma.kpAgentCategoryMapping.findMany({ orderBy: [{ priority: "desc" }, { agentRole: "asc" }] });
}

export async function upsertAgentMappings(
  rows: readonly { agentRole: string; category: string; enabled: boolean; usageMode: string; priority: number }[]
) {
  for (const r of rows) {
    await prisma.kpAgentCategoryMapping.upsert({
      where: { agentRole_category: { agentRole: r.agentRole, category: r.category } },
      create: {
        agentRole: r.agentRole,
        category: r.category,
        enabled: r.enabled,
        usageMode: r.usageMode,
        priority: r.priority,
      },
      update: {
        enabled: r.enabled,
        usageMode: r.usageMode,
        priority: r.priority,
      },
    });
  }
}

export async function mergeKnowledgePackListForUser(ownerUserId: string): Promise<KnowledgePack[]> {
  const db = await listDbKnowledgePacksForUser(ownerUserId);
  return mergeStaticAndDbKnowledgePacks(DEVELOPER_SEED_KNOWLEDGE_PACKS, db);
}

export async function getMergedKnowledgePackById(id: string, ownerUserId: string): Promise<KnowledgePack | undefined> {
  if (isStaticKnowledgePackId(id)) {
    const s = getKnowledgePackById(id);
    if (!s) return undefined;
    return { ...s, source: "STATIC", editable: false };
  }
  const db = await getDbKnowledgePackById(id, ownerUserId);
  return db ?? undefined;
}

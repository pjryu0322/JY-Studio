import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { getKnowledgePackById } from "@/lib/knowledge-packs/developerKnowledgePacks";
import { KP_SOURCE_STATUS } from "@/lib/knowledge-packs/knowledgePackRagConstants";
import { virtualKnowledgePackSourceId } from "@/lib/knowledge-packs/knowledgePackSourceRouteUtils";
import { validateUrlForKnowledgePackFetchWithDns } from "@/lib/knowledge-packs/knowledgePackSourceUrlGuard";
import { prisma } from "@/lib/prisma";

const ALLOWED_SOURCE_TYPES = new Set([
  "URL",
  "TEXT",
  "MARKDOWN",
  "OPENAPI",
  "CODE_SAMPLE",
  "LICENSE",
  "MANUAL",
  "API_REFERENCE",
]);

export type CreateKnowledgePackSourceInput = Readonly<{
  sourceType: string;
  title: string;
  url?: string;
  rawText?: string;
  description?: string;
  isOfficial?: boolean;
  ragEnabled?: boolean;
}>;

export type ListedKnowledgePackSource = Readonly<{
  id: string;
  knowledgePackId: string;
  isVirtual?: boolean;
  sourceType: string;
  title: string;
  url?: string | null;
  description: string;
  status: string;
  ragEnabled: boolean;
  isOfficial: boolean;
  lastCollectedAt?: string | null;
  lastError?: string | null;
  chunkCount: number;
}>;

async function assertDbPackOwned(knowledgePackId: string, userId: string) {
  const p = await prisma.kpKnowledgePack.findFirst({ where: { id: knowledgePackId, ownerUserId: userId } });
  if (!p) return null;
  return p;
}

export async function createKnowledgePackSource(
  userId: string,
  knowledgePackId: string,
  input: CreateKnowledgePackSourceInput
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (isStaticKnowledgePackId(knowledgePackId)) {
    return { ok: false, message: "플랫폼 기본 지식팩에는 원천자료를 등록할 수 없습니다." };
  }
  const pack = await assertDbPackOwned(knowledgePackId, userId);
  if (!pack) return { ok: false, message: "지식팩을 찾을 수 없거나 권한이 없습니다." };

  const st = input.sourceType.trim().toUpperCase();
  if (!ALLOWED_SOURCE_TYPES.has(st)) {
    return { ok: false, message: "지원하지 않는 sourceType 입니다." };
  }

  if (st === "URL" || st === "API_REFERENCE") {
    const u = (input.url ?? "").trim();
    if (!u) return { ok: false, message: "URL이 필요합니다." };
    const v = await validateUrlForKnowledgePackFetchWithDns(u);
    if (!v.ok) return { ok: false, message: v.message };
  } else if (st === "OPENAPI") {
    const u = (input.url ?? "").trim();
    const raw = (input.rawText ?? "").trim();
    if (!u && !raw) return { ok: false, message: "OpenAPI는 URL 또는 본문(rawText) 중 하나가 필요합니다." };
    if (u) {
      const v = await validateUrlForKnowledgePackFetchWithDns(u);
      if (!v.ok) return { ok: false, message: v.message };
    }
  } else {
    const raw = (input.rawText ?? "").trim();
    if (!raw) return { ok: false, message: "본문(rawText)이 필요합니다." };
  }

  const row = await prisma.kpKnowledgePackSource.create({
    data: {
      knowledgePackId,
      sourceType: st,
      title: input.title.trim() || "Untitled",
      url: (input.url ?? "").trim() || null,
      rawText: input.rawText ?? null,
      description: (input.description ?? "").trim(),
      isOfficial: Boolean(input.isOfficial),
      ragEnabled: input.ragEnabled !== false,
      status: KP_SOURCE_STATUS.PENDING,
    },
  });
  return { ok: true, id: row.id };
}

export async function listKnowledgePackSources(userId: string, knowledgePackId: string): Promise<ListedKnowledgePackSource[]> {
  if (isStaticKnowledgePackId(knowledgePackId)) {
    const p = getKnowledgePackById(knowledgePackId);
    if (!p) return [];
    return (p.references ?? []).map((r, i) => ({
      id: virtualKnowledgePackSourceId(knowledgePackId, i),
      knowledgePackId,
      isVirtual: true,
      sourceType: "URL",
      title: r.label,
      url: r.url,
      description: "",
      status: "READY",
      ragEnabled: false,
      isOfficial: true,
      lastCollectedAt: null,
      lastError: null,
      chunkCount: 0,
    }));
  }

  const pack = await assertDbPackOwned(knowledgePackId, userId);
  if (!pack) return [];

  const rows = await prisma.kpKnowledgePackSource.findMany({
    where: {
      knowledgePackId,
      NOT: { status: KP_SOURCE_STATUS.DISABLED },
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    knowledgePackId: r.knowledgePackId,
    sourceType: r.sourceType,
    title: r.title,
    url: r.url,
    description: r.description,
    status: r.status,
    ragEnabled: r.ragEnabled,
    isOfficial: r.isOfficial,
    lastCollectedAt: r.lastCollectedAt?.toISOString() ?? null,
    lastError: r.lastError,
    chunkCount: r._count.chunks,
  }));
}

export async function disableKnowledgePackSource(
  userId: string,
  sourceId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = await prisma.kpKnowledgePackSource.findFirst({
    where: { id: sourceId, knowledgePack: { ownerUserId: userId } },
  });
  if (!row) return { ok: false, message: "원천자료를 찾을 수 없습니다." };
  await prisma.kpKnowledgePackSource.update({
    where: { id: sourceId },
    data: { status: KP_SOURCE_STATUS.DISABLED, lastError: null },
  });
  return { ok: true };
}

export async function getSourceOwnedByUser(sourceId: string, userId: string) {
  return prisma.kpKnowledgePackSource.findFirst({
    where: { id: sourceId, knowledgePack: { ownerUserId: userId } },
    include: { knowledgePack: { select: { id: true, ownerUserId: true, category: true, name: true } } },
  });
}

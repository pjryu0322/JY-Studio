import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchesAllMetadataFilters } from "@/lib/retrieval-ranking";
import {
  CANDIDATE_PAGE_SIZE,
  MAX_CANDIDATE_SCAN,
  MAX_FILTERED_CANDIDATES,
} from "./retrieval-config";
import {
  toMetadataRecord,
  type CandidateChunk,
  type CandidateCollectInput,
  type CandidateCollectResult,
} from "./retrieval-types";

function passesIndexScope(
  chunk: CandidateChunk,
  input: Pick<CandidateCollectInput, "indexGenerationId" | "excludeDraftScope">,
): boolean {
  const meta = toMetadataRecord(chunk.metadata);
  if (input.indexGenerationId) {
    return meta?.indexGenerationId === input.indexGenerationId;
  }
  if (input.excludeDraftScope) {
    if (meta?.indexScope === "DRAFT") return false;
    if (meta?.indexScope != null) {
      return meta.indexScope === "PRODUCTION" && meta.indexStatus === "APPROVED";
    }
  }
  return true;
}

function baseWhere(
  versionId: string,
  indexGenerationId?: string | null,
): Prisma.KnowledgeChunkWhereInput {
  return indexGenerationId
    ? {
        versionId,
        metadata: { path: ["indexGenerationId"], equals: indexGenerationId },
      }
    : { versionId, isActive: true };
}

async function loadCandidatePage(
  versionId: string,
  cursor: string | undefined,
  indexGenerationId?: string | null,
): Promise<CandidateChunk[]> {
  return prisma.knowledgeChunk.findMany({
    where: baseWhere(versionId, indexGenerationId),
    include: { sourceDocument: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: CANDIDATE_PAGE_SIZE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

/**
 * Query-aware candidate collection: title/tag hits first, then content hits,
 * so early sortOrder pages (Index/DataGrid) do not displace precise API titles.
 */
async function collectByQueryTokens(
  input: CandidateCollectInput,
  tokens: string[],
): Promise<CandidateCollectResult> {
  const base = baseWhere(input.versionId, input.indexGenerationId);
  const titleOr: Prisma.KnowledgeChunkWhereInput[] = [];
  const contentOr: Prisma.KnowledgeChunkWhereInput[] = [];

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;
    titleOr.push(
      { title: { contains: t, mode: "insensitive" } },
      { section: { contains: t, mode: "insensitive" } },
      { tags: { has: t } },
    );
    if (t.length >= 2) {
      contentOr.push({ content: { contains: t, mode: "insensitive" } });
    }
  }

  const titleRows =
    titleOr.length > 0
      ? await prisma.knowledgeChunk.findMany({
          where: { AND: [base, { OR: titleOr }] },
          include: { sourceDocument: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          take: 250,
        })
      : [];

  const seen = new Set(titleRows.map((r) => r.id));
  const contentRows =
    contentOr.length > 0
      ? await prisma.knowledgeChunk.findMany({
          where: {
            AND: [
              base,
              { OR: contentOr },
              ...(seen.size > 0 ? [{ id: { notIn: [...seen] } }] : []),
            ],
          },
          include: { sourceDocument: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          take: 250,
        })
      : [];

  const rows = [...titleRows, ...contentRows];
  const collected: CandidateChunk[] = [];
  for (const chunk of rows) {
    if (!passesIndexScope(chunk, input)) continue;
    if (
      input.hasFilters &&
      !matchesAllMetadataFilters(toMetadataRecord(chunk.metadata), input.filters)
    ) {
      continue;
    }
    collected.push(chunk);
    if (collected.length >= MAX_FILTERED_CANDIDATES) break;
  }

  return {
    collected,
    scanned: rows.length,
    collectionMode: "query-scan",
  };
}

export async function collectRetrievalCandidates(
  input: CandidateCollectInput,
): Promise<CandidateCollectResult> {
  const { versionId, filters, hasFilters, hasQuery } = input;
  const tokens = (input.queryTokens ?? []).map((t) => t.trim()).filter(Boolean);

  if (!hasFilters && !hasQuery) {
    const page = await loadCandidatePage(versionId, undefined, input.indexGenerationId);
    const collected = page.filter((c) => passesIndexScope(c, input));
    return { collected, scanned: page.length, collectionMode: "default-page" };
  }

  if (hasQuery && tokens.length > 0) {
    return collectByQueryTokens(input, tokens);
  }

  const collected: CandidateChunk[] = [];
  let scanned = 0;
  let cursor: string | undefined;

  while (scanned < MAX_CANDIDATE_SCAN && collected.length < MAX_FILTERED_CANDIDATES) {
    const page = await loadCandidatePage(versionId, cursor, input.indexGenerationId);
    if (page.length === 0) break;

    scanned += page.length;
    cursor = page[page.length - 1]!.id;

    for (const chunk of page) {
      if (!passesIndexScope(chunk, input)) continue;
      if (hasFilters && !matchesAllMetadataFilters(toMetadataRecord(chunk.metadata), filters)) {
        continue;
      }
      collected.push(chunk);
      if (collected.length >= MAX_FILTERED_CANDIDATES) break;
    }

    if (page.length < CANDIDATE_PAGE_SIZE) break;
  }

  return {
    collected,
    scanned,
    collectionMode: hasFilters ? "metadata-filter" : "query-scan",
  };
}

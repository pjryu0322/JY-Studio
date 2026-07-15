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

async function loadCandidatePage(
  versionId: string,
  cursor: string | undefined,
  indexGenerationId?: string | null,
): Promise<CandidateChunk[]> {
  return prisma.knowledgeChunk.findMany({
    where: indexGenerationId
      ? {
          versionId,
          metadata: { path: ["indexGenerationId"], equals: indexGenerationId },
        }
      : { versionId, isActive: true },
    include: { sourceDocument: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: CANDIDATE_PAGE_SIZE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

export async function collectRetrievalCandidates(
  input: CandidateCollectInput,
): Promise<CandidateCollectResult> {
  const { versionId, filters, hasFilters, hasQuery } = input;

  if (!hasFilters && !hasQuery) {
    const page = await loadCandidatePage(versionId, undefined, input.indexGenerationId);
    const collected = page.filter((c) => passesIndexScope(c, input));
    return { collected, scanned: page.length, collectionMode: "default-page" };
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

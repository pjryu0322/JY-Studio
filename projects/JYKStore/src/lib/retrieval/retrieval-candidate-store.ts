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
    // Explicit draft generations must not appear in public retrieval.
    if (meta?.indexScope === "DRAFT") return false;
  }
  return true;
}

async function loadCandidatePage(
  versionId: string,
  cursor: string | undefined,
): Promise<CandidateChunk[]> {
  return prisma.knowledgeChunk.findMany({
    where: { versionId, isActive: true },
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

  // filters도 query도 없으면 기본 목록 조회 성격이므로 첫 page만 반환한다. (전체 scan 안 함)
  if (!hasFilters && !hasQuery) {
    const page = await loadCandidatePage(versionId, undefined);
    const collected = page.filter((c) => passesIndexScope(c, input));
    return { collected, scanned: page.length, collectionMode: "default-page" };
  }

  const collected: CandidateChunk[] = [];
  let scanned = 0;
  let cursor: string | undefined;

  // filters가 있으면 metadata AND filter를 page별로 선적용한다.
  // filters가 없고 query가 있으면 scan한 active chunk 전체를 ranking 후보로 넘긴다.
  // 두 경우 모두 첫 500개에 한정하지 않고 MAX_CANDIDATE_SCAN까지 paging scan한다.
  while (scanned < MAX_CANDIDATE_SCAN && collected.length < MAX_FILTERED_CANDIDATES) {
    const page = await loadCandidatePage(versionId, cursor);
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

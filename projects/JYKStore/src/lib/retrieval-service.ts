import { PackStatus } from "@prisma/client";
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { embedText } from "@/lib/embedding-service";
import { prisma } from "@/lib/prisma";
import {
  type CandidateCollectionMode,
  type RetrievalContextDto,
  type RetrievalFilters,
  type RetrievalMode,
  type RetrievalResponseDto,
} from "@/lib/retrieval-dto";
import { matchesAllMetadataFilters, scoreRetrievalChunk } from "@/lib/retrieval-ranking";
import { tokenizeSearchQuery } from "@/lib/search-utils";
import { clampedCosineSimilarity, isValidVector } from "@/lib/vector-similarity";

const publishedStatuses = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

// P13.2: 후보 수집 paging 상수. filter가 있을 때 앞쪽 500개 밖 조건 누락을 완화한다.
const CANDIDATE_PAGE_SIZE = 500;
const MAX_CANDIDATE_SCAN = 5000;
const MAX_FILTERED_CANDIDATES = 1000;

// P14: hybrid ranking 가중치. keyword/metadata score에 vector similarity를 결합한다.
const HYBRID_WEIGHTS = {
  keyword: 1,
  metadata: 1,
  vector: 100,
} as const;

function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

type CandidateChunk = Awaited<ReturnType<typeof loadCandidatePage>>[number];

async function loadCandidatePage(versionId: string, cursor: string | undefined) {
  return prisma.knowledgeChunk.findMany({
    where: { versionId, isActive: true },
    include: { sourceDocument: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: CANDIDATE_PAGE_SIZE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

type CandidateCollectInput = {
  versionId: string;
  filters: RetrievalFilters;
  hasFilters: boolean;
  hasQuery: boolean;
};

async function collectCandidates(input: CandidateCollectInput): Promise<{
  collected: CandidateChunk[];
  scanned: number;
  collectionMode: CandidateCollectionMode;
}> {
  const { versionId, filters, hasFilters, hasQuery } = input;

  // filters도 query도 없으면 기본 목록 조회 성격이므로 첫 page만 반환한다. (전체 scan 안 함)
  if (!hasFilters && !hasQuery) {
    const page = await loadCandidatePage(versionId, undefined);
    return { collected: page, scanned: page.length, collectionMode: "default-page" };
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

export async function retrieveContexts(input: {
  knowledgePackId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
}): Promise<RetrievalResponseDto | null> {
  // NOTE: packId 전용 API Key 권한은 향후 확장 예정이다.
  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: input.knowledgePackId,
      status: { in: [...publishedStatuses] },
    },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!pack || pack.versions.length === 0) {
    return null;
  }

  const version = pack.versions[0]!;
  const searchQuery = input.query?.trim() ?? "";
  const tokens = tokenizeSearchQuery(searchQuery);
  const filterKeys = Object.keys(input.filters);
  const hasFilters = filterKeys.length > 0;
  const hasQuery = tokens.length > 0;

  // 1) metadata filter는 항상 vector/hybrid ranking보다 먼저 적용된다.
  //    query-only/hybrid 검색도 첫 500개에 한정하지 않고 paging scan한다.
  const { collected, scanned, collectionMode } = await collectCandidates({
    versionId: version.id,
    filters: input.filters,
    hasFilters,
    hasQuery,
  });

  const scored = collected.map((chunk) => {
    const metadataRecord = toMetadataRecord(chunk.metadata);
    const result = scoreRetrievalChunk({
      chunk: { ...chunk, metadata: metadataRecord },
      tokens,
      filters: input.filters,
    });
    return {
      chunk,
      metadataRecord,
      keywordScore: result.keywordScore,
      metadataScore: result.metadataScore,
      vectorScore: 0,
      vectorSimilarity: 0,
      score: result.score,
      matchReasons: [...result.matchReasons],
    };
  });

  // 2) hybrid mode: query가 있으면 vector similarity를 결합한다.
  //    - embedding이 있는 chunk에만 vector similarity를 추가 가산한다.
  //    - embedding이 없는 chunk는 keyword/metadata score만으로 ranking된다. (fallback)
  //    - embedding 미생성 상태에서도 Retrieval API는 실패하지 않는다.
  const useHybrid = input.retrievalMode === "hybrid" && tokens.length > 0;
  let embeddingProvider: string | undefined;
  let embeddingModel: string | undefined;

  if (useHybrid && scored.length > 0) {
    embeddingProvider = DEFAULT_EMBEDDING_PROVIDER;
    embeddingModel = DEFAULT_EMBEDDING_MODEL;

    const queryEmbedding = embedText({ text: searchQuery });
    const chunkIds = scored.map((item) => item.chunk.id);

    const embeddings = await prisma.knowledgeChunkEmbedding.findMany({
      where: { chunkId: { in: chunkIds }, provider: embeddingProvider, model: embeddingModel },
      select: { chunkId: true, vector: true },
    });
    const vectorByChunk = new Map<string, number[]>();
    for (const row of embeddings) {
      if (isValidVector(row.vector)) {
        vectorByChunk.set(row.chunkId, row.vector);
      }
    }

    for (const item of scored) {
      const chunkVector = vectorByChunk.get(item.chunk.id);
      if (!chunkVector) {
        // embedding이 없는 candidate는 keyword/metadata score로 fallback한다.
        continue;
      }
      const similarity = clampedCosineSimilarity(queryEmbedding.vector, chunkVector);
      const vectorScore = similarity * HYBRID_WEIGHTS.vector;
      item.vectorSimilarity = similarity;
      item.vectorScore = vectorScore;
      item.score += vectorScore;
      if (similarity > 0) {
        item.matchReasons.push("vector:similarity");
      }
    }
  }

  const byScore = (a: (typeof scored)[number], b: (typeof scored)[number]) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.chunk.sortOrder !== b.chunk.sortOrder) return a.chunk.sortOrder - b.chunk.sortOrder;
    return a.chunk.createdAt.getTime() - b.chunk.createdAt.getTime();
  };

  let selected = scored;
  if (hasFilters) {
    // metadata filter를 통과한 chunk는 keyword/vector score가 0이어도 포함하고 score 기준으로 정렬한다.
    selected = [...scored].sort(byScore);
  } else if (tokens.length > 0) {
    // keyword/hybrid 전용: 실제로 매칭된 chunk만 반환한다.
    selected = scored.filter((item) => item.score > 0).sort(byScore);
  }
  // filters/query 모두 없으면 sortOrder/createdAt 순서를 그대로 사용한다.
  selected = selected.slice(0, input.topK);

  const contexts: RetrievalContextDto[] = selected.map((item) => {
    const context: RetrievalContextDto = {
      chunkId: item.chunk.id,
      knowledgePackId: pack.packId,
      title: item.chunk.title,
      content: item.chunk.content,
      score: item.score,
      matchReasons: item.matchReasons,
    };

    if (input.includeMetadata) {
      context.metadata = item.metadataRecord ?? {};
    }

    if (useHybrid) {
      context.scoreDetail = {
        keywordScore: item.keywordScore,
        metadataScore: item.metadataScore,
        vectorScore: item.vectorScore,
        vectorSimilarity: item.vectorSimilarity,
      };
    }

    if (item.chunk.sourceDocument) {
      context.references = [
        {
          type: "SOURCE_DOCUMENT",
          title: item.chunk.sourceDocument.title,
          sourceDocumentId: item.chunk.sourceDocument.id,
        },
      ];
    }

    return context;
  });

  return {
    contexts,
    usage: {
      requestId: input.requestId,
      contextCount: contexts.length,
      topK: input.topK,
      usedFilters: input.filters,
      retrievalMode: useHybrid ? "hybrid" : "keyword",
      embeddingProvider,
      embeddingModel,
      scannedCandidateCount: scanned,
      filteredCandidateCount: collected.length,
      candidateCollectionMode: collectionMode,
    },
  };
}

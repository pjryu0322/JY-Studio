import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type RetrievalContextDto,
  type RetrievalFilters,
  type RetrievalResponseDto,
} from "@/lib/retrieval-dto";
import { matchesAllMetadataFilters, scoreRetrievalChunk } from "@/lib/retrieval-ranking";
import { tokenizeSearchQuery } from "@/lib/search-utils";

const publishedStatuses = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

const CANDIDATE_LIMIT = 500;

function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export async function retrieveContexts(input: {
  knowledgePackId: string;
  query?: string;
  filters: RetrievalFilters;
  topK: number;
  includeMetadata: boolean;
  requestId: string;
}): Promise<RetrievalResponseDto | null> {
  // NOTE: packId 전용 API Key 권한은 P13에서 구현하지 않는다. (P14 이후 확장 예정)
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

  const version = pack.versions[0];
  const searchQuery = input.query?.trim() ?? "";
  const tokens = tokenizeSearchQuery(searchQuery);
  const filterKeys = Object.keys(input.filters);

  const candidates = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      isActive: true,
    },
    include: {
      sourceDocument: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: CANDIDATE_LIMIT,
  });

  // filters는 점수 가산 조건이 아니라 후보 제한(AND) 조건이다.
  // filters가 지정되면 모든 metadata 조건을 만족한 chunk만 ranking 대상이 된다.
  const metadataFiltered =
    filterKeys.length > 0
      ? candidates.filter((chunk) =>
          matchesAllMetadataFilters(toMetadataRecord(chunk.metadata), input.filters),
        )
      : candidates;

  const scored = metadataFiltered.map((chunk) => {
    const metadataRecord = toMetadataRecord(chunk.metadata);
    const result = scoreRetrievalChunk({
      chunk: { ...chunk, metadata: metadataRecord },
      tokens,
      filters: input.filters,
    });
    return { chunk, metadataRecord, ...result };
  });

  const byScore = (
    a: (typeof scored)[number],
    b: (typeof scored)[number],
  ) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.chunk.sortOrder !== b.chunk.sortOrder) return a.chunk.sortOrder - b.chunk.sortOrder;
    return a.chunk.createdAt.getTime() - b.chunk.createdAt.getTime();
  };

  let selected = scored;
  if (filterKeys.length > 0) {
    // metadata filter를 통과한 chunk는 keyword score가 0이어도 포함하고 score 기준으로 정렬한다.
    selected = [...scored].sort(byScore);
  } else if (tokens.length > 0) {
    // keyword 전용: 실제로 매칭된 chunk만 반환한다.
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
    },
  };
}

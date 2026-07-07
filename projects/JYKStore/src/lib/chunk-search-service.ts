import {
  addReason,
  includesNormalized,
  normalizeSearchText,
  tokenizeSearchQuery,
  type SearchScoreReason,
} from "@/lib/search-utils";

export type RankedChunk<T> = {
  item: T;
  score: number;
  matchReasons: SearchScoreReason[];
};

type RankableChunk = {
  title: string;
  content: string;
  section: string | null;
  chunkType: string;
  tags: string[];
  sortOrder: number;
  createdAt: Date;
};

const WEIGHTS = {
  titleExact: 100,
  titleContains: 40,
  tagExact: 35,
  sectionContains: 25,
  chunkTypeContains: 15,
  contentContains: 10,
} as const;

export function scoreKnowledgeChunk(
  chunk: RankableChunk,
  tokens: string[],
): { score: number; matchReasons: SearchScoreReason[] } {
  const reasons: SearchScoreReason[] = [];
  let score = 0;

  const normalizedTitle = normalizeSearchText(chunk.title);
  const normalizedTags = chunk.tags.map((tag) => normalizeSearchText(tag));

  for (const token of tokens) {
    if (normalizedTitle === token) {
      score += addReason(reasons, "title", token, WEIGHTS.titleExact, "제목 정확 일치");
    } else if (includesNormalized(chunk.title, token)) {
      score += addReason(reasons, "title", token, WEIGHTS.titleContains, "제목 부분 일치");
    }

    if (normalizedTags.includes(token)) {
      score += addReason(reasons, "tags", token, WEIGHTS.tagExact, "태그 정확 일치");
    }

    if (includesNormalized(chunk.section, token)) {
      score += addReason(reasons, "section", token, WEIGHTS.sectionContains, "섹션 부분 일치");
    }

    if (includesNormalized(chunk.chunkType, token)) {
      score += addReason(reasons, "chunkType", token, WEIGHTS.chunkTypeContains, "청크 유형 일치");
    }

    if (includesNormalized(chunk.content, token)) {
      score += addReason(reasons, "content", token, WEIGHTS.contentContains, "본문 부분 일치");
    }
  }

  return { score, matchReasons: reasons };
}

export function rankKnowledgeChunks<T extends RankableChunk>(
  chunks: T[],
  query: string,
): RankedChunk<T>[] {
  const tokens = tokenizeSearchQuery(query);

  const ranked = chunks.map((item) => {
    const { score, matchReasons } = scoreKnowledgeChunk(item, tokens);
    return { item, score, matchReasons };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.item.sortOrder !== b.item.sortOrder) return a.item.sortOrder - b.item.sortOrder;
    return a.item.createdAt.getTime() - b.item.createdAt.getTime();
  });

  return ranked;
}

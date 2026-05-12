import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { KP_SOURCE_STATUS } from "@/lib/knowledge-packs/knowledgePackRagConstants";
import { prisma } from "@/lib/prisma";

export type RetrievedContextChunk = Readonly<{
  sourceId: string;
  sourceTitle: string;
  chunkOrder: number;
  score: number;
  excerpt: string;
}>;

function normalizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9가-힣_-]+/gi, ""))
    .filter((w) => w.length >= 2)
    .slice(0, 12);
}

function keywordScore(text: string, terms: string[]): number {
  const t = text.toLowerCase();
  let s = 0;
  for (const term of terms) {
    if (!term) continue;
    let idx = 0;
    while (idx < t.length) {
      const p = t.indexOf(term, idx);
      if (p < 0) break;
      s += 3 + Math.min(term.length, 20);
      idx = p + term.length;
    }
  }
  return s;
}

/** 단위 테스트·도구용: 질의에 대한 단일 청크 점수. */
export function scoreKnowledgePackChunkAgainstQuery(chunkText: string, query: string): number {
  const terms = normalizeQuery(query);
  if (!terms.length) return 0;
  return keywordScore(chunkText, terms);
}

/**
 * 키워드 기반 청크 검색(1단계). 임베딩 없이 부분 문자열 점수로 상위 N개를 고른다.
 */
export async function retrieveKnowledgePackContextByKeywords(
  userId: string,
  knowledgePackId: string,
  query: string,
  topK = 8
): Promise<RetrievedContextChunk[]> {
  if (isStaticKnowledgePackId(knowledgePackId)) {
    return [];
  }

  const pack = await prisma.kpKnowledgePack.findFirst({ where: { id: knowledgePackId, ownerUserId: userId } });
  if (!pack) return [];

  const terms = normalizeQuery(query);
  if (!terms.length) return [];

  const k = Math.min(24, Math.max(1, Math.floor(topK)));

  const rows = await prisma.kpKnowledgePackChunk.findMany({
    where: {
      knowledgePackId,
      source: {
        ragEnabled: true,
        status: { in: [KP_SOURCE_STATUS.CHUNKED, KP_SOURCE_STATUS.INDEXED] },
        NOT: { status: KP_SOURCE_STATUS.DISABLED },
      },
    },
    select: {
      chunkText: true,
      chunkOrder: true,
      sourceId: true,
      source: { select: { title: true } },
    },
    take: 800,
    orderBy: { updatedAt: "desc" },
  });

  const scored = rows
    .map((r) => ({
      sourceId: r.sourceId,
      sourceTitle: r.source.title,
      chunkOrder: r.chunkOrder,
      score: scoreKnowledgePackChunkAgainstQuery(r.chunkText, query),
      excerpt: r.chunkText,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored;
}

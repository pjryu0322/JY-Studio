import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { KP_SOURCE_STATUS } from "@/lib/knowledge-packs/knowledgePackRagConstants";
import { prisma } from "@/lib/prisma";

export type KnowledgePackRetrievalMode = "KEYWORD" | "VECTOR" | "HYBRID";

export type RetrievedKnowledgePackChunk = Readonly<{
  chunkId: string;
  knowledgePackId: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string | null;
  chunkOrder: number;
  score: number;
  text: string;
  excerpt: string;
}>;

export type KnowledgePackRetrievalResult = Readonly<{
  mode: KnowledgePackRetrievalMode;
  knowledgePackId: string;
  query: string;
  chunks: readonly RetrievedKnowledgePackChunk[];
  promptContext: readonly string[];
  diagnostics: readonly string[];
}>;

const PROMPT_CONTEXT_PER_CHUNK_MAX = 900;
const PROMPT_CONTEXT_TOTAL_MAX = 4000;
const EXCERPT_MAX = 320;

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

export function buildPromptContextFromRetrievedChunks(
  chunks: readonly RetrievedKnowledgePackChunk[]
): Readonly<{ promptContext: string[]; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const promptContext: string[] = [];
  let total = 0;
  let perChunkTruncations = 0;

  for (const c of chunks) {
    const base = `[${c.sourceTitle}] ${c.text}`.replace(/\s+/g, " ").trim();
    let piece = base.slice(0, PROMPT_CONTEXT_PER_CHUNK_MAX);
    if (base.length > PROMPT_CONTEXT_PER_CHUNK_MAX) {
      perChunkTruncations += 1;
      piece = `${piece}…`;
    }
    const sep = promptContext.length ? 1 : 0;
    if (total + sep + piece.length > PROMPT_CONTEXT_TOTAL_MAX) {
      const room = PROMPT_CONTEXT_TOTAL_MAX - total - sep;
      if (room > 40) {
        promptContext.push(`${piece.slice(0, room)}…`);
        total = PROMPT_CONTEXT_TOTAL_MAX;
      }
      diagnostics.push("promptContext_total_max_reached");
      break;
    }
    promptContext.push(piece);
    total += sep + piece.length;
  }

  if (perChunkTruncations > 0) {
    diagnostics.push(`promptContext_per_chunk_truncated=${perChunkTruncations}`);
  }
  return { promptContext, diagnostics };
}

/**
 * 키워드 기반 검색 결과를 표준 KnowledgePackRetrievalResult로 반환한다.
 * 임베딩은 사용하지 않는다.
 */
export async function retrieveKnowledgePackKeywordRetrievalResult(
  userId: string,
  knowledgePackId: string,
  query: string,
  limit: number
): Promise<KnowledgePackRetrievalResult> {
  const k = Math.min(24, Math.max(1, Math.floor(limit)));
  const baseDiag = ["mode=KEYWORD", "embedding=not_used"] as string[];

  if (isStaticKnowledgePackId(knowledgePackId)) {
    return {
      mode: "KEYWORD",
      knowledgePackId,
      query,
      chunks: [],
      promptContext: [],
      diagnostics: [...baseDiag, "chunks=0", "reason=static_seed_no_db_chunks"],
    };
  }

  const pack = await prisma.kpKnowledgePack.findFirst({ where: { id: knowledgePackId, ownerUserId: userId } });
  if (!pack) {
    return {
      mode: "KEYWORD",
      knowledgePackId,
      query,
      chunks: [],
      promptContext: [],
      diagnostics: [...baseDiag, "chunks=0", "reason=pack_not_found_or_forbidden"],
    };
  }

  const terms = normalizeQuery(query);
  if (!terms.length) {
    return {
      mode: "KEYWORD",
      knowledgePackId,
      query,
      chunks: [],
      promptContext: [],
      diagnostics: [...baseDiag, "chunks=0", "reason=query_terms_empty_or_too_short"],
    };
  }

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
      id: true,
      chunkText: true,
      chunkOrder: true,
      knowledgePackId: true,
      sourceId: true,
      source: { select: { title: true, url: true } },
    },
    take: 800,
    orderBy: { updatedAt: "desc" },
  });

  const scored = rows
    .map((r) => {
      const text = r.chunkText;
      const score = keywordScore(text, terms);
      const excerpt =
        text.length <= EXCERPT_MAX ? text : `${text.slice(0, EXCERPT_MAX)}…`;
      const row: RetrievedKnowledgePackChunk = {
        chunkId: r.id,
        knowledgePackId: r.knowledgePackId,
        sourceId: r.sourceId,
        sourceTitle: r.source.title,
        sourceUrl: r.source.url,
        chunkOrder: r.chunkOrder,
        score,
        text,
        excerpt,
      };
      return row;
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const chunks = scored;
  const { promptContext, diagnostics: pcDiag } = buildPromptContextFromRetrievedChunks(chunks);

  return {
    mode: "KEYWORD",
    knowledgePackId,
    query,
    chunks,
    promptContext,
    diagnostics: [...baseDiag, `chunks=${chunks.length}`, ...pcDiag],
  };
}

/** 하위 호환: 구형 청크 배열 형태. 신규 코드는 retrieveKnowledgePackKeywordRetrievalResult 사용. */
export type RetrievedContextChunk = Readonly<{
  sourceId: string;
  sourceTitle: string;
  chunkOrder: number;
  score: number;
  excerpt: string;
}>;

export async function retrieveKnowledgePackContextByKeywords(
  userId: string,
  knowledgePackId: string,
  query: string,
  topK = 8
): Promise<RetrievedContextChunk[]> {
  const r = await retrieveKnowledgePackKeywordRetrievalResult(userId, knowledgePackId, query, topK);
  return r.chunks.map((c) => ({
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    chunkOrder: c.chunkOrder,
    score: c.score,
    excerpt: c.excerpt,
  }));
}

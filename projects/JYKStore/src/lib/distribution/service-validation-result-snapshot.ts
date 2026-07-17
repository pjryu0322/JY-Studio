import { prisma } from "@/lib/prisma";
import type { RetrievalContextDto, RetrievalScoreDetail } from "@/lib/retrieval-dto";
import { resolveRetrievalContextSourceDocumentId } from "@/lib/retrieval/retrieval-api-adapter";
import { toProviderRelevance } from "@/lib/distribution/service-validation-relevance";

export const PROVIDER_VALIDATION_SNIPPET_MAX = 300;
export const PROVIDER_VALIDATION_SNAPSHOT_TOP_K = 5;
export const PROVIDER_VALIDATION_UI_DEFAULT_VISIBLE = 3;

export type ProviderValidationResultItemDto = {
  rank: number;
  title: string;
  snippet: string;
  relevanceLabel: "높음" | "보통" | "낮음";
  relevancePercent: number | null;
  sourceDocumentTitle: string;
  pageLabel: string | null;
  previewAvailable: boolean;
};

export type InternalValidationResultItem = {
  rank: number;
  chunkId: string;
  title: string;
  snippet: string;
  score: number;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  pageStart: number | null;
  pageEnd: number | null;
  sourceLocator: string | null;
};

export function sanitizeValidationSnippet(raw: string, max = PROVIDER_VALIDATION_SNIPPET_MAX): string {
  const plain = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pageFromMeta(meta: Record<string, unknown> | null): {
  pageStart: number | null;
  pageEnd: number | null;
} {
  const pageStart =
    typeof meta?.pageStart === "number"
      ? meta.pageStart
      : typeof meta?.page === "number"
        ? meta.page
        : null;
  const pageEnd = typeof meta?.pageEnd === "number" ? meta.pageEnd : pageStart;
  return { pageStart, pageEnd };
}

export function formatPageLabel(pageStart: number | null, pageEnd: number | null): string | null {
  if (pageStart == null) return null;
  if (pageEnd != null && pageEnd !== pageStart) return `${pageStart}–${pageEnd}페이지`;
  return `${pageStart}페이지`;
}

export function mapContextsToInternalResultItems(
  contexts: RetrievalContextDto[],
  sourceTitleById: Map<string, string>,
): InternalValidationResultItem[] {
  const items: InternalValidationResultItem[] = [];
  for (let i = 0; i < contexts.length && items.length < PROVIDER_VALIDATION_SNAPSHOT_TOP_K; i++) {
    const ctx = contexts[i]!;
    const sourceDocumentId = resolveRetrievalContextSourceDocumentId(ctx);
    if (!sourceDocumentId) continue;
    const meta = asRecord(ctx.metadata);
    const { pageStart, pageEnd } = pageFromMeta(meta);
    items.push({
      rank: items.length + 1,
      chunkId: ctx.chunkId,
      title: (ctx.title || "제목 없음").trim(),
      snippet: sanitizeValidationSnippet(ctx.content ?? ""),
      score: typeof ctx.score === "number" ? ctx.score : 0,
      sourceDocumentId,
      sourceDocumentTitle: sourceTitleById.get(sourceDocumentId) ?? "원문 문서",
      pageStart,
      pageEnd,
      sourceLocator:
        typeof meta?.sourceSectionId === "string" ? meta.sourceSectionId : null,
    });
  }
  return items;
}

export async function loadSourceDocumentTitles(
  sourceDocumentIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(sourceDocumentIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const docs = await prisma.sourceDocument.findMany({
    where: { id: { in: unique } },
    select: { id: true, title: true, fileName: true },
  });
  return new Map(
    docs.map((d) => [d.id, (d.title || d.fileName || "원문 문서").trim() || "원문 문서"]),
  );
}

export async function persistServiceValidationResultItems(input: {
  runId: string;
  items: InternalValidationResultItem[];
}): Promise<void> {
  if (input.items.length === 0) return;
  await prisma.serviceValidationResultItem.createMany({
    data: input.items.map((item) => ({
      runId: input.runId,
      rank: item.rank,
      chunkId: item.chunkId,
      title: item.title,
      snippet: item.snippet,
      score: item.score,
      sourceDocumentId: item.sourceDocumentId,
      sourceDocumentTitle: item.sourceDocumentTitle,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
      sourceLocator: item.sourceLocator,
    })),
  });
}

export function toProviderResultItemDtos(
  items: Array<{
    rank: number;
    title: string;
    snippet: string;
    score: number;
    sourceDocumentTitle: string | null;
    pageStart: number | null;
    pageEnd: number | null;
  }>,
  scoreDetailByRank?: Map<number, RetrievalScoreDetail | null>,
): ProviderValidationResultItemDto[] {
  return items.map((item) => {
    const relevance = toProviderRelevance(
      item.score,
      scoreDetailByRank?.get(item.rank) ?? null,
    );
    return {
      rank: item.rank,
      title: item.title,
      snippet: item.snippet,
      relevanceLabel: relevance.label,
      relevancePercent: relevance.percent,
      sourceDocumentTitle: item.sourceDocumentTitle?.trim() || "원문 문서",
      pageLabel: formatPageLabel(item.pageStart, item.pageEnd),
      previewAvailable: item.pageStart != null,
    };
  });
}

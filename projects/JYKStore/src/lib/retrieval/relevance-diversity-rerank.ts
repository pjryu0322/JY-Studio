import { makeWordShingles, jaccardSimilarity } from "@/lib/chunk-quality/chunk-quality-runner";
import type { ScoredCandidate } from "./retrieval-types";

/** Near-duplicate body similarity threshold (Jaccard over word shingles). */
export const NEAR_DUPLICATE_SIMILARITY = 0.9;

/** Rank 2–3 must keep at least this fraction of rank-1 final relevance. */
export const RANK_23_RELATIVE_FLOOR = 0.85;

/** Absolute minimum final relevance to include a result (avoid padding Top-K). */
export const ABSOLUTE_RELEVANCE_FLOOR = 0.12;

const WEIGHTS = {
  normalizedVectorScore: 0.8,
  titleMatchBonus: 0.08,
  sectionMatchBonus: 0.05,
  phraseMatchBonus: 0.03,
  provenanceCompletenessBonus: 0.02,
  duplicatePenalty: 0.2,
  missingSourcePenalty: 0.1,
} as const;

export type RerankStats = {
  candidateCount: number;
  deduplicatedCount: number;
  finalResultCount: number;
  rerankMode: "relevance_diversity_v1";
};

export type SelectWithDiversityResult = {
  selected: ScoredCandidate[];
  stats: RerankStats;
};

type MetaFields = {
  splitSourceId: string | null;
  parentChunkId: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  primaryContentLength: number;
  hasTableHeader: boolean;
};

/**
 * Normalize text for duplicate comparison only (does not mutate stored chunks).
 */
export function normalizeForDedupe(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/passage:\s*/gi, " ")
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/["""'''「」『』]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentDedupeKey(text: string): string {
  return normalizeForDedupe(text);
}

export function bodySimilarity(a: string, b: string): number {
  const na = normalizeForDedupe(a);
  const nb = normalizeForDedupe(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return jaccardSimilarity(makeWordShingles(na, 3), makeWordShingles(nb, 3));
}

function metaNumber(meta: Record<string, unknown> | null, key: string): number | null {
  const v = meta?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function extractCandidateMeta(item: ScoredCandidate): MetaFields {
  const meta = item.metadataRecord;
  const pageStart = metaNumber(meta, "pageStart") ?? metaNumber(meta, "page");
  const pageEnd = metaNumber(meta, "pageEnd") ?? pageStart;
  const primary =
    metaString(meta, "primaryContent") ??
    (typeof meta?.primaryContent === "string" ? meta.primaryContent : null);
  return {
    splitSourceId:
      metaString(meta, "splitSourceId") ?? metaString(meta, "knowledgeUnitId") ?? null,
    parentChunkId: metaString(meta, "parentChunkId") ?? null,
    pageStart,
    pageEnd,
    primaryContentLength: primary?.length ?? item.chunk.content.length,
    hasTableHeader: Boolean(meta?.tableHeaders) || Boolean(meta?.preservedTableHeader),
  };
}

function pageRangeKey(meta: MetaFields): string | null {
  if (meta.pageStart == null) return null;
  return `${meta.pageStart}-${meta.pageEnd ?? meta.pageStart}`;
}

function familyKey(meta: MetaFields): string | null {
  return meta.parentChunkId ?? meta.splitSourceId;
}

/**
 * Prefer higher hybrid/vector score, then provenance completeness, then primary length.
 */
export function pickDuplicateRepresentative(
  a: ScoredCandidate,
  b: ScoredCandidate,
): ScoredCandidate {
  const ma = extractCandidateMeta(a);
  const mb = extractCandidateMeta(b);
  const scoreA = a.vectorSimilarity > 0 ? a.vectorSimilarity : a.score;
  const scoreB = b.vectorSimilarity > 0 ? b.vectorSimilarity : b.score;
  if (scoreB !== scoreA) return scoreB > scoreA ? b : a;
  const provA =
    (a.chunk.sourceDocumentId ? 1 : 0) + (ma.pageStart != null ? 1 : 0) + (ma.hasTableHeader ? 1 : 0);
  const provB =
    (b.chunk.sourceDocumentId ? 1 : 0) + (mb.pageStart != null ? 1 : 0) + (mb.hasTableHeader ? 1 : 0);
  if (provB !== provA) return provB > provA ? b : a;
  if (mb.primaryContentLength !== ma.primaryContentLength) {
    return mb.primaryContentLength > ma.primaryContentLength ? b : a;
  }
  return a;
}

export function deduplicateScoredCandidates(scored: ScoredCandidate[]): {
  kept: ScoredCandidate[];
  removedCount: number;
} {
  const kept: ScoredCandidate[] = [];
  const seenChunkIds = new Set<string>();
  const seenFamilies = new Map<string, number>();
  const seenSourcePageSection = new Map<string, number>();
  const seenHashes = new Map<string, number>();

  for (const item of scored) {
    if (seenChunkIds.has(item.chunk.id)) continue;
    seenChunkIds.add(item.chunk.id);

    const meta = extractCandidateMeta(item);
    const family = familyKey(meta);
    const hash = contentDedupeKey(item.chunk.content);
    const section = (item.chunk.section ?? "").trim().toLowerCase();
    const sourcePageSection =
      item.chunk.sourceDocumentId && meta.pageStart != null
        ? `${item.chunk.sourceDocumentId}|${meta.pageStart}|${meta.pageEnd ?? meta.pageStart}|${section}`
        : null;

    let duplicateOf: number | null = null;

    if (family) {
      const idx = seenFamilies.get(family);
      if (idx != null) duplicateOf = idx;
    }
    if (duplicateOf == null && sourcePageSection && hash) {
      const idx = seenSourcePageSection.get(`${sourcePageSection}|${hash}`);
      if (idx != null) duplicateOf = idx;
    }
    if (duplicateOf == null && hash.length >= 40) {
      const idx = seenHashes.get(hash);
      if (idx != null) duplicateOf = idx;
    }
    if (duplicateOf == null) {
      for (let i = 0; i < kept.length; i++) {
        if (bodySimilarity(kept[i]!.chunk.content, item.chunk.content) >= NEAR_DUPLICATE_SIMILARITY) {
          duplicateOf = i;
          break;
        }
      }
    }

    if (duplicateOf != null) {
      const winner = pickDuplicateRepresentative(kept[duplicateOf]!, item);
      if (winner !== kept[duplicateOf]) {
        kept[duplicateOf] = winner;
        const wMeta = extractCandidateMeta(winner);
        const wFamily = familyKey(wMeta);
        if (wFamily) seenFamilies.set(wFamily, duplicateOf);
        const wHash = contentDedupeKey(winner.chunk.content);
        if (wHash.length >= 40) seenHashes.set(wHash, duplicateOf);
      }
      continue;
    }

    const idx = kept.length;
    kept.push(item);
    if (family) seenFamilies.set(family, idx);
    if (sourcePageSection && hash) {
      seenSourcePageSection.set(`${sourcePageSection}|${hash}`, idx);
    }
    if (hash.length >= 40) seenHashes.set(hash, idx);
  }

  return { kept, removedCount: Math.max(0, scored.length - kept.length) };
}

function normalizeQueryTerms(query: string): string[] {
  const norm = normalizeForDedupe(query);
  if (!norm) return [];
  const parts = norm.split(" ").filter((t) => t.length >= 2);
  return [...new Set(parts)];
}

function containsNormalized(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return normalizeForDedupe(haystack).includes(needle);
}

export function computeFinalRelevanceScore(
  item: ScoredCandidate,
  query: string,
): number {
  const terms = normalizeQueryTerms(query);
  const phrase = normalizeForDedupe(query);
  const title = item.chunk.title ?? "";
  const section = item.chunk.section ?? "";
  const content = item.chunk.content ?? "";
  const meta = extractCandidateMeta(item);

  const vectorSim =
    Number.isFinite(item.vectorSimilarity) && item.vectorSimilarity > 0
      ? clamp01(item.vectorSimilarity)
      : clamp01(item.score / (item.score + 100));

  let titleMatch = 0;
  let sectionMatch = 0;
  let phraseMatch = 0;
  if (phrase && containsNormalized(title, phrase)) titleMatch = 1;
  else if (terms.length > 0) {
    const hits = terms.filter((t) => containsNormalized(title, t)).length;
    titleMatch = hits / terms.length;
  }
  if (phrase && containsNormalized(section, phrase)) sectionMatch = 1;
  else if (terms.length > 0) {
    const hits = terms.filter((t) => containsNormalized(section, t)).length;
    sectionMatch = hits / terms.length;
  }
  if (phrase && containsNormalized(content, phrase)) phraseMatch = 1;
  else if (terms.length > 0) {
    const hits = terms.filter((t) => containsNormalized(content, t)).length;
    phraseMatch = hits / terms.length;
  }

  const provenance =
    (item.chunk.sourceDocumentId ? 0.5 : 0) + (meta.pageStart != null ? 0.5 : 0);

  let score =
    WEIGHTS.normalizedVectorScore * vectorSim +
    WEIGHTS.titleMatchBonus * titleMatch +
    WEIGHTS.sectionMatchBonus * sectionMatch +
    WEIGHTS.phraseMatchBonus * phraseMatch +
    WEIGHTS.provenanceCompletenessBonus * provenance;

  if (!item.chunk.sourceDocumentId) {
    score -= WEIGHTS.missingSourcePenalty;
  }

  // Soft floor: keyword-only boost cannot rescue very low vector similarity.
  if (vectorSim < 0.25 && titleMatch < 0.5 && phraseMatch < 0.5) {
    score = Math.min(score, vectorSim + 0.05);
  }

  return score;
}

type Ranked = {
  item: ScoredCandidate;
  relevance: number;
  meta: MetaFields;
};

function diversityDistance(a: Ranked, b: Ranked): number {
  let d = 0;
  const fa = familyKey(a.meta);
  const fb = familyKey(b.meta);
  if (fa && fb && fa === fb) d -= 0.5;
  else d += 0.25;
  const sa = (a.item.chunk.section ?? "").trim().toLowerCase();
  const sb = (b.item.chunk.section ?? "").trim().toLowerCase();
  if (sa && sb && sa === sb) d -= 0.25;
  else if (sa || sb) d += 0.2;
  const pa = pageRangeKey(a.meta);
  const pb = pageRangeKey(b.meta);
  if (pa && pb && pa === pb) d -= 0.15;
  else if (pa || pb) d += 0.1;
  if (
    a.item.chunk.sourceDocumentId &&
    b.item.chunk.sourceDocumentId &&
    a.item.chunk.sourceDocumentId !== b.item.chunk.sourceDocumentId
  ) {
    d += 0.15;
  }
  d += 1 - bodySimilarity(a.item.chunk.content, b.item.chunk.content);
  return d;
}

function avgDiversityToSelected(candidate: Ranked, selected: Ranked[]): number {
  if (selected.length === 0) return 1;
  let sum = 0;
  for (const s of selected) sum += diversityDistance(candidate, s);
  return sum / selected.length;
}

function countByKey(selected: Ranked[], keyFn: (r: Ranked) => string | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of selected) {
    const k = keyFn(r);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function passesDiversityCaps(
  candidate: Ranked,
  selected: Ranked[],
  opts: { maxFamily: number; maxSection: number; maxPage: number },
): boolean {
  const family = familyKey(candidate.meta);
  if (family) {
    const counts = countByKey(selected, (r) => familyKey(r.meta));
    if ((counts.get(family) ?? 0) >= opts.maxFamily) return false;
  }
  const section = (candidate.item.chunk.section ?? "").trim().toLowerCase() || null;
  if (section) {
    const counts = countByKey(selected, (r) =>
      (r.item.chunk.section ?? "").trim().toLowerCase() || null,
    );
    if ((counts.get(section) ?? 0) >= opts.maxSection) return false;
  }
  const page = pageRangeKey(candidate.meta);
  if (page) {
    const counts = countByKey(selected, (r) => pageRangeKey(r.meta));
    if ((counts.get(page) ?? 0) >= opts.maxPage) return false;
  }
  return true;
}

/**
 * Relevance-first Top-K with limited diversity on ranks 2–5.
 * Does not change Public API shape — only reorders/filters candidates.
 */
export function selectDiverseTopK(input: {
  scored: ScoredCandidate[];
  query: string;
  topK: number;
}): SelectWithDiversityResult {
  const topK = Math.max(1, Math.trunc(input.topK));
  const query = input.query.trim();
  const { kept, removedCount } = deduplicateScoredCandidates(input.scored);

  if (!query || kept.length === 0) {
    return {
      selected: kept.slice(0, topK),
      stats: {
        candidateCount: input.scored.length,
        deduplicatedCount: removedCount,
        finalResultCount: Math.min(kept.length, topK),
        rerankMode: "relevance_diversity_v1",
      },
    };
  }

  const ranked: Ranked[] = kept
    .map((item) => ({
      item,
      relevance: computeFinalRelevanceScore(item, query),
      meta: extractCandidateMeta(item),
    }))
    .sort((a, b) => b.relevance - a.relevance || b.item.score - a.item.score);

  const selected: Ranked[] = [];
  // Rank 1: pure relevance (no diversity penalty).
  const rank1 = ranked[0]!;
  if (rank1.relevance < ABSOLUTE_RELEVANCE_FLOOR && rank1.item.vectorSimilarity < 0.2) {
    // Still return best available rather than empty when something scored.
    selected.push(rank1);
  } else {
    selected.push(rank1);
  }

  const floor23 = Math.max(rank1.relevance * RANK_23_RELATIVE_FLOOR, ABSOLUTE_RELEVANCE_FLOOR);
  const floor45 = Math.max(rank1.relevance * 0.7, ABSOLUTE_RELEVANCE_FLOOR);

  const pickNext = (opts: {
    remainingSlots: number;
    relevanceWeight: number;
    diversityWeight: number;
    floor: number;
    maxFamily: number;
    maxSection: number;
    maxPage: number;
  }) => {
    while (selected.length < topK && opts.remainingSlots > 0) {
      const pool = ranked.filter(
        (c) =>
          !selected.some((s) => s.item.chunk.id === c.item.chunk.id) &&
          c.relevance >= opts.floor,
      );
      if (pool.length === 0) break;

      let best: Ranked | null = null;
      let bestScore = -Infinity;
      for (const candidate of pool) {
        if (
          !passesDiversityCaps(candidate, selected, {
            maxFamily: opts.maxFamily,
            maxSection: opts.maxSection,
            maxPage: opts.maxPage,
          })
        ) {
          continue;
        }
        const diversity = avgDiversityToSelected(candidate, selected);
        const combined =
          opts.relevanceWeight * candidate.relevance + opts.diversityWeight * diversity;
        if (combined > bestScore) {
          bestScore = combined;
          best = candidate;
        }
      }

      if (!best) {
        // Relax page → section caps; keep family cap.
        let relaxed: Ranked | null = null;
        let relaxedScore = -Infinity;
        for (const candidate of pool) {
          if (
            !passesDiversityCaps(candidate, selected, {
              maxFamily: opts.maxFamily,
              maxSection: opts.maxSection + 2,
              maxPage: opts.maxPage + 5,
            })
          ) {
            continue;
          }
          const diversity = avgDiversityToSelected(candidate, selected);
          const combined =
            opts.relevanceWeight * candidate.relevance + opts.diversityWeight * diversity;
          if (combined > relaxedScore) {
            relaxedScore = combined;
            relaxed = candidate;
          }
        }
        if (!relaxed) break;
        selected.push(relaxed);
      } else {
        selected.push(best);
      }
      opts.remainingSlots -= 1;
    }
  };

  // Ranks 2–3: relevance-heavy.
  pickNext({
    remainingSlots: Math.min(2, topK - selected.length),
    relevanceWeight: 0.9,
    diversityWeight: 0.1,
    floor: floor23,
    maxFamily: 1,
    maxSection: 2,
    maxPage: 2,
  });

  // Ranks 4–5: more diversity, still above relevance floor.
  pickNext({
    remainingSlots: Math.max(0, topK - selected.length),
    relevanceWeight: 0.75,
    diversityWeight: 0.25,
    floor: floor45,
    maxFamily: 1,
    maxSection: 2,
    maxPage: 2,
  });

  return {
    selected: selected.map((r) => r.item),
    stats: {
      candidateCount: input.scored.length,
      deduplicatedCount: removedCount,
      finalResultCount: selected.length,
      rerankMode: "relevance_diversity_v1",
    },
  };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

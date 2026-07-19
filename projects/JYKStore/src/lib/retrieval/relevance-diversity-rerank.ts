import { makeWordShingles, jaccardSimilarity } from "@/lib/chunk-quality/chunk-quality-runner";
import type { ScoredCandidate } from "./retrieval-types";

/** Near-duplicate body similarity threshold (Jaccard over word shingles). */
export const NEAR_DUPLICATE_SIMILARITY = 0.9;

/** Minimum normalized body length for Jaccard near-duplicate checks. */
export const NEAR_DUPLICATE_MIN_CHARS = 80;

/** Rank 2–3 must keep at least this fraction of rank-1 final relevance. */
export const RANK_23_RELATIVE_FLOOR = 0.85;

/** Absolute minimum final relevance to include a result (avoid padding Top-K). */
export const ABSOLUTE_RELEVANCE_FLOOR = 0.12;

/**
 * Within this gap, finalRelevanceScore is treated as a tie and diversity may break it.
 * Larger gaps must preserve relevance order for ranks 2–3.
 */
export const RELEVANCE_TIE_EPSILON = 0.02;

/** Same split/parent family allowed in ranks 1–3 and overall Top-5. */
export const TOP3_MAX_SAME_FAMILY = 2;
export const TOP5_MAX_SAME_FAMILY = 2;

/**
 * Ranking policy version for ServiceValidationRun details / fingerprints.
 * Bump when rerank/dedupe rules change in a way that invalidates prior PASS runs.
 */
export const RETRIEVAL_RANKING_POLICY_VERSION = "relevance_diversity_v2";

const WEIGHTS = {
  normalizedVectorScore: 0.8,
  titleMatchBonus: 0.08,
  sectionMatchBonus: 0.05,
  phraseMatchBonus: 0.03,
  provenanceCompletenessBonus: 0.02,
  missingSourcePenalty: 0.1,
} as const;

export type RerankStats = {
  candidateCount: number;
  deduplicatedCount: number;
  finalResultCount: number;
  rerankMode: typeof RETRIEVAL_RANKING_POLICY_VERSION;
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

function normalizeBaseText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/passage:\s*/gi, " ")
    .replace(/["""'''「」『』]/g, " ")
    // Keep digits and parentheses so body item numbers stay distinct.
    .replace(/[^\p{L}\p{N}\s()]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Title-only: strip trailing copy suffixes like `(1)` at end of title. */
export function normalizeTitleForDedupe(text: string): string {
  return normalizeBaseText(text)
    .replace(/\(\s*\d+\s*\)\s*$/g, "")
    .trim();
}

/** Body dedupe: preserve `(1)` / clause / list numbers. */
export function normalizeBodyForDedupe(text: string): string {
  return normalizeBaseText(text);
}

/**
 * @deprecated Prefer normalizeBodyForDedupe / normalizeTitleForDedupe.
 * Kept for query keyword matching compatibility.
 */
export function normalizeForDedupe(text: string): string {
  return normalizeBodyForDedupe(text);
}

export function contentDedupeKey(text: string): string {
  return normalizeBodyForDedupe(text);
}

export function bodySimilarity(a: string, b: string): number {
  const na = normalizeBodyForDedupe(a);
  const nb = normalizeBodyForDedupe(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Short bodies: only exact normalized hash counts as duplicate (caller also checks).
  if (na.length < NEAR_DUPLICATE_MIN_CHARS || nb.length < NEAR_DUPLICATE_MIN_CHARS) {
    return 0;
  }
  return jaccardSimilarity(makeWordShingles(na, 3), makeWordShingles(nb, 3));
}

export function bodyDiversityScore(a: string, b: string): number {
  const na = normalizeBodyForDedupe(a);
  const nb = normalizeBodyForDedupe(b);
  if (na.length < NEAR_DUPLICATE_MIN_CHARS || nb.length < NEAR_DUPLICATE_MIN_CHARS) {
    return 0;
  }
  return clamp01(1 - bodySimilarity(a, b));
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

/** Family key for diversity caps only — never used to confirm duplicates. */
export function familyKey(meta: MetaFields): string | null {
  return meta.parentChunkId ?? meta.splitSourceId;
}

/**
 * Prefer higher vector/hybrid score, then provenance, primary length, sortOrder.
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
  if (a.chunk.sortOrder !== b.chunk.sortOrder) {
    return a.chunk.sortOrder < b.chunk.sortOrder ? a : b;
  }
  return a.chunk.id <= b.chunk.id ? a : b;
}

function isNearDuplicateContent(a: string, b: string): boolean {
  const na = normalizeBodyForDedupe(a);
  const nb = normalizeBodyForDedupe(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length < NEAR_DUPLICATE_MIN_CHARS || nb.length < NEAR_DUPLICATE_MIN_CHARS) {
    return false;
  }
  return bodySimilarity(a, b) >= NEAR_DUPLICATE_SIMILARITY;
}

/**
 * Deduplicate by chunkId / normalized body / near-duplicate only.
 * Same parentChunkId / splitSourceId / knowledgeUnitId alone is NOT a duplicate.
 */
export function deduplicateScoredCandidates(scored: ScoredCandidate[]): {
  kept: ScoredCandidate[];
  removedCount: number;
} {
  const kept: ScoredCandidate[] = [];
  const seenChunkIds = new Set<string>();
  const seenHashes = new Map<string, number>();
  const seenSourcePageSectionHash = new Map<string, number>();

  for (const item of scored) {
    if (seenChunkIds.has(item.chunk.id)) continue;
    seenChunkIds.add(item.chunk.id);

    const meta = extractCandidateMeta(item);
    const hash = contentDedupeKey(item.chunk.content);
    const section = (item.chunk.section ?? "").trim().toLowerCase();
    const sourcePageSection =
      item.chunk.sourceDocumentId && meta.pageStart != null
        ? `${item.chunk.sourceDocumentId}|${meta.pageStart}|${meta.pageEnd ?? meta.pageStart}|${section}`
        : null;

    let duplicateOf: number | null = null;

    // Exact normalized hash (any length).
    if (hash.length > 0) {
      const idx = seenHashes.get(hash);
      if (idx != null) duplicateOf = idx;
    }

    // Same source/page/section + same hash (narrowing aid; still requires hash match).
    if (duplicateOf == null && sourcePageSection && hash.length > 0) {
      const idx = seenSourcePageSectionHash.get(`${sourcePageSection}|${hash}`);
      if (idx != null) duplicateOf = idx;
    }

    // Near-duplicate body vs kept candidates.
    if (duplicateOf == null) {
      for (let i = 0; i < kept.length; i++) {
        if (isNearDuplicateContent(kept[i]!.chunk.content, item.chunk.content)) {
          duplicateOf = i;
          break;
        }
      }
    }

    if (duplicateOf != null) {
      const winner = pickDuplicateRepresentative(kept[duplicateOf]!, item);
      if (winner !== kept[duplicateOf]) {
        kept[duplicateOf] = winner;
        const wHash = contentDedupeKey(winner.chunk.content);
        if (wHash.length > 0) seenHashes.set(wHash, duplicateOf);
        const wMeta = extractCandidateMeta(winner);
        const wSection = (winner.chunk.section ?? "").trim().toLowerCase();
        const wKey =
          winner.chunk.sourceDocumentId && wMeta.pageStart != null
            ? `${winner.chunk.sourceDocumentId}|${wMeta.pageStart}|${wMeta.pageEnd ?? wMeta.pageStart}|${wSection}|${wHash}`
            : null;
        if (wKey) seenSourcePageSectionHash.set(wKey, duplicateOf);
      }
      continue;
    }

    const idx = kept.length;
    kept.push(item);
    if (hash.length > 0) seenHashes.set(hash, idx);
    if (sourcePageSection && hash.length > 0) {
      seenSourcePageSectionHash.set(`${sourcePageSection}|${hash}`, idx);
    }
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

function compareRankedStability(a: Ranked, b: Ranked): number {
  if (b.relevance !== a.relevance) return b.relevance - a.relevance;
  if (b.item.score !== a.item.score) return b.item.score - a.item.score;
  if (b.item.vectorSimilarity !== a.item.vectorSimilarity) {
    return b.item.vectorSimilarity - a.item.vectorSimilarity;
  }
  if (a.item.chunk.sortOrder !== b.item.chunk.sortOrder) {
    return a.item.chunk.sortOrder - b.item.chunk.sortOrder;
  }
  const ta = a.item.chunk.createdAt.getTime();
  const tb = b.item.chunk.createdAt.getTime();
  if (ta !== tb) return ta - tb;
  return a.item.chunk.id.localeCompare(b.item.chunk.id);
}

/**
 * Diversity in [0, 1]: rewards different family / section / page / source / body.
 * Same attributes score 0 for that signal — never negative.
 */
export function normalizedDiversityScore(candidate: Ranked, selected: Ranked): number {
  let score = 0;
  const fa = familyKey(candidate.meta);
  const fb = familyKey(selected.meta);
  // Only reward diversity when both sides have the signal and they differ.
  if (fa && fb && fa !== fb) score += 0.35;

  const sa = (candidate.item.chunk.section ?? "").trim().toLowerCase();
  const sb = (selected.item.chunk.section ?? "").trim().toLowerCase();
  if (sa && sb && sa !== sb) score += 0.25;

  const pa = pageRangeKey(candidate.meta);
  const pb = pageRangeKey(selected.meta);
  if (pa && pb && pa !== pb) score += 0.15;

  const da = candidate.item.chunk.sourceDocumentId;
  const db = selected.item.chunk.sourceDocumentId;
  if (da && db && da !== db) score += 0.1;

  score += 0.15 * bodyDiversityScore(candidate.item.chunk.content, selected.item.chunk.content);

  return clamp01(score);
}

function avgNormalizedDiversity(candidate: Ranked, selected: Ranked[]): number {
  if (selected.length === 0) return 1;
  let sum = 0;
  for (const s of selected) sum += normalizedDiversityScore(candidate, s);
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

function chooseMostDiverse(tieGroup: Ranked[], selected: Ranked[]): Ranked {
  let best = tieGroup[0]!;
  let bestDiv = avgNormalizedDiversity(best, selected);
  for (let i = 1; i < tieGroup.length; i++) {
    const candidate = tieGroup[i]!;
    const div = avgNormalizedDiversity(candidate, selected);
    if (div > bestDiv + 1e-9) {
      best = candidate;
      bestDiv = div;
    } else if (Math.abs(div - bestDiv) <= 1e-9 && compareRankedStability(candidate, best) < 0) {
      best = candidate;
      bestDiv = div;
    }
  }
  return best;
}

/**
 * Ranks 2–3: relevance descending; diversity only inside RELEVANCE_TIE_EPSILON ties.
 */
export function pickRelevanceFirstCandidate(
  pool: Ranked[],
  selected: Ranked[],
): Ranked | null {
  if (pool.length === 0) return null;

  const sorted = [...pool].sort(compareRankedStability);
  const topRelevance = sorted[0]!.relevance;
  const tieGroup = sorted.filter(
    (candidate) => topRelevance - candidate.relevance <= RELEVANCE_TIE_EPSILON,
  );

  if (tieGroup.length === 1) return tieGroup[0]!;
  return chooseMostDiverse(tieGroup, selected);
}

/**
 * Ranks 4–5: weighted relevance + normalized diversity among floor-qualified pool.
 */
function pickDiversityWeightedCandidate(
  pool: Ranked[],
  selected: Ranked[],
  relevanceWeight: number,
  diversityWeight: number,
): Ranked | null {
  if (pool.length === 0) return null;
  let best: Ranked | null = null;
  let bestScore = -Infinity;
  for (const candidate of pool) {
    const diversity = avgNormalizedDiversity(candidate, selected);
    const combined =
      relevanceWeight * candidate.relevance + diversityWeight * diversity;
    if (combined > bestScore + 1e-9) {
      bestScore = combined;
      best = candidate;
    } else if (
      best &&
      Math.abs(combined - bestScore) <= 1e-9 &&
      compareRankedStability(candidate, best) < 0
    ) {
      best = candidate;
      bestScore = combined;
    }
  }
  return best;
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
        rerankMode: RETRIEVAL_RANKING_POLICY_VERSION,
      },
    };
  }

  const ranked: Ranked[] = kept
    .map((item) => ({
      item,
      relevance: computeFinalRelevanceScore(item, query),
      meta: extractCandidateMeta(item),
    }))
    .sort(compareRankedStability);

  const selected: Ranked[] = [];
  // Rank 1: pure relevance (no diversity).
  selected.push(ranked[0]!);

  const floor23 = Math.max(ranked[0]!.relevance * RANK_23_RELATIVE_FLOOR, ABSOLUTE_RELEVANCE_FLOOR);
  const floor45 = Math.max(ranked[0]!.relevance * 0.7, ABSOLUTE_RELEVANCE_FLOOR);

  const filterPool = (floor: number, caps: { maxFamily: number; maxSection: number; maxPage: number }) =>
    ranked.filter(
      (c) =>
        !selected.some((s) => s.item.chunk.id === c.item.chunk.id) &&
        c.relevance >= floor &&
        passesDiversityCaps(c, selected, caps),
    );

  const pickWithRelax = (
    mode: "relevance_first" | "diversity_weighted",
    floor: number,
    remainingSlots: number,
    maxFamily: number,
  ) => {
    while (selected.length < topK && remainingSlots > 0) {
      const strictCaps = { maxFamily, maxSection: 2, maxPage: 2 };
      let pool = filterPool(floor, strictCaps);
      if (pool.length === 0) {
        // Relax page → section; keep family max at TOP5_MAX_SAME_FAMILY.
        pool = filterPool(floor, {
          maxFamily,
          maxSection: 4,
          maxPage: 8,
        });
      }
      if (pool.length === 0) break;

      const next =
        mode === "relevance_first"
          ? pickRelevanceFirstCandidate(pool, selected)
          : pickDiversityWeightedCandidate(pool, selected, 0.75, 0.25);
      if (!next) break;
      selected.push(next);
      remainingSlots -= 1;
    }
  };

  // Ranks 2–3: relevance order; diversity only inside epsilon ties.
  pickWithRelax(
    "relevance_first",
    floor23,
    Math.min(2, topK - selected.length),
    TOP3_MAX_SAME_FAMILY,
  );

  // Ranks 4–5: diversity weighted, still above relevance floor.
  pickWithRelax(
    "diversity_weighted",
    floor45,
    Math.max(0, topK - selected.length),
    TOP5_MAX_SAME_FAMILY,
  );

  return {
    selected: selected.map((r) => r.item),
    stats: {
      candidateCount: input.scored.length,
      deduplicatedCount: removedCount,
      finalResultCount: selected.length,
      rerankMode: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

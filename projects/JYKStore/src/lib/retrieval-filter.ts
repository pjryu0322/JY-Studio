import {
  ALLOWED_FILTER_KEYS,
  DEFAULT_TOP_K,
  FILTER_KEY_ALIASES,
  MAX_TOP_K,
  MIN_TOP_K,
  type CanonicalFilterKey,
  type RetrievalFilters,
} from "@/lib/retrieval-dto";

export type FilterValidationResult =
  | { ok: true; filters: RetrievalFilters; aliasHits: string[] }
  | { ok: false; errors: string[] };

function toCanonicalKey(key: string): CanonicalFilterKey {
  return FILTER_KEY_ALIASES[key] ?? (key as CanonicalFilterKey);
}

export function validateAndNormalizeFilters(raw: unknown): FilterValidationResult {
  if (raw === undefined || raw === null) {
    return { ok: true, filters: {}, aliasHits: [] };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["filters must be an object."] };
  }

  const errors: string[] = [];
  const filters: RetrievalFilters = {};
  const aliasHits: string[] = [];

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) {
      errors.push(`Unknown filter key: ${key}`);
      continue;
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (typeof value !== "string") {
      errors.push(`Filter value for '${key}' must be a string.`);
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) continue;

    const canonicalKey = toCanonicalKey(key);
    if (FILTER_KEY_ALIASES[key]) {
      aliasHits.push(key);
    }
    filters[canonicalKey] = trimmed;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, filters, aliasHits };
}

export function normalizeTopK(raw: unknown): { ok: true; topK: number } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, topK: DEFAULT_TOP_K };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, error: "topK must be a number." };
  }
  const value = Math.floor(raw);
  if (value < MIN_TOP_K || value > MAX_TOP_K) {
    return { ok: false, error: `topK must be between ${MIN_TOP_K} and ${MAX_TOP_K}.` };
  }
  return { ok: true, topK: value };
}

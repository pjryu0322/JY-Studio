const MAX_TOKENS = 10;

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\t\n\r]+/g, " ")
    .replace(/[()[\]{}.,;:|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string | null | undefined): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const raw of normalized.split(" ")) {
    const token = raw.trim();
    if (!token) continue;

    const isShortAllowed = token.length === 1 && /[0-9a-z]/.test(token);
    if (token.length < 2 && !isShortAllowed) continue;

    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);

    if (tokens.length >= MAX_TOKENS) break;
  }

  return tokens;
}

export function includesNormalized(
  haystack: string | null | undefined,
  needle: string,
): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return false;
  return normalizeSearchText(haystack).includes(normalizedNeedle);
}

export function countTokenMatches(
  fields: Array<string | null | undefined>,
  tokens: string[],
): number {
  let count = 0;
  for (const token of tokens) {
    if (fields.some((field) => includesNormalized(field, token))) {
      count += 1;
    }
  }
  return count;
}

export type SearchScoreReason = {
  field: string;
  token: string;
  weight: number;
  reason: string;
};

export function addReason(
  reasons: SearchScoreReason[],
  field: string,
  token: string,
  weight: number,
  reason: string,
): number {
  reasons.push({ field, token, weight, reason });
  return weight;
}

import { normalizeLabel } from "@/lib/templateAuto/normalize";
import { canonicalizeTableHeader } from "./tableHeaderCanonicalMap";

export interface MatchedHeader {
  templateHeader: string;
  draftHeader: string;
  score: number;
  reason: string;
}

export interface TableHeaderMatchResult {
  matchedHeaders: MatchedHeader[];
  missingHeaders: string[];
  addedHeaders: string[];
  orderChanged: boolean;
}

function bigramSet(text: string): Set<string> {
  const chars = text.split("");
  const out = new Set<string>();
  for (let i = 0; i < chars.length - 1; i += 1) {
    out.add(`${chars[i]}${chars[i + 1]}`);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const v of a) {
    if (b.has(v)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

export function matchTableHeaders(
  templateHeaders: string[],
  draftHeaders: string[]
): TableHeaderMatchResult {
  const pairs: Array<{
    tIdx: number;
    dIdx: number;
    score: number;
    reason: string;
  }> = [];

  for (let tIdx = 0; tIdx < templateHeaders.length; tIdx += 1) {
    const tRaw = templateHeaders[tIdx] ?? "";
    const tNorm = normalizeLabel(tRaw);
    const tCanonical = normalizeLabel(canonicalizeTableHeader(tRaw));
    const tBigram = bigramSet(tNorm);
    for (let dIdx = 0; dIdx < draftHeaders.length; dIdx += 1) {
      const dRaw = draftHeaders[dIdx] ?? "";
      const dNorm = normalizeLabel(dRaw);
      const dCanonical = normalizeLabel(canonicalizeTableHeader(dRaw));
      const dBigram = bigramSet(dNorm);

      let score = 0;
      let reason = "weak";
      if (tNorm && dNorm && tNorm === dNorm) {
        score = 1;
        reason = "exact";
      } else if (tCanonical && dCanonical && tCanonical === dCanonical) {
        score = 0.94;
        reason = "canonical";
      } else {
        const fuzzy = jaccard(tBigram, dBigram);
        score = Number(Math.max(0, Math.min(1, fuzzy)).toFixed(2));
        if (score >= 0.7) reason = "fuzzy";
      }
      pairs.push({ tIdx, dIdx, score, reason });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const usedT = new Set<number>();
  const usedD = new Set<number>();
  const matchedHeaders: MatchedHeader[] = [];
  for (const pair of pairs) {
    if (pair.score < 0.65) continue;
    if (usedT.has(pair.tIdx) || usedD.has(pair.dIdx)) continue;
    usedT.add(pair.tIdx);
    usedD.add(pair.dIdx);
    matchedHeaders.push({
      templateHeader: templateHeaders[pair.tIdx] ?? "",
      draftHeader: draftHeaders[pair.dIdx] ?? "",
      score: pair.score,
      reason: pair.reason,
    });
  }

  const missingHeaders = templateHeaders.filter((_, idx) => !usedT.has(idx));
  const addedHeaders = draftHeaders.filter((_, idx) => !usedD.has(idx));
  const orderChanged = matchedHeaders.some((matched) => {
    const tIdx = templateHeaders.findIndex((v) => v === matched.templateHeader);
    const dIdx = draftHeaders.findIndex((v) => v === matched.draftHeader);
    return tIdx !== -1 && dIdx !== -1 && tIdx !== dIdx;
  });

  return {
    matchedHeaders,
    missingHeaders,
    addedHeaders,
    orderChanged,
  };
}

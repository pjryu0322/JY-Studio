import { normalizeLabel } from "@/lib/templateAuto/normalize";
import { canonicalizeSectionTitle } from "./sectionCanonicalMap";

export interface SectionLike {
  id?: string;
  title: string;
  orderHint?: number;
}

export interface SectionMatch {
  templateSection: SectionLike;
  draftSection: SectionLike;
  score: number;
  reason: string;
}

export interface SectionMatchResult {
  matched: SectionMatch[];
  unmatchedTemplate: SectionLike[];
  unmatchedDraft: SectionLike[];
}

interface MatchOptions {
  fuzzyWeight?: number;
  orderWeight?: number;
  neighborWeight?: number;
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

export function matchSections(
  templateSections: SectionLike[],
  draftSections: SectionLike[],
  options?: MatchOptions
): SectionMatchResult {
  const fuzzyWeight = options?.fuzzyWeight ?? 0.35;
  const orderWeight = options?.orderWeight ?? 0.2;
  const neighborWeight = options?.neighborWeight ?? 0.15;
  const totalBase = 1 + fuzzyWeight + orderWeight + neighborWeight;

  const tLen = Math.max(1, templateSections.length);
  const dLen = Math.max(1, draftSections.length);

  const pairs: Array<{
    tIdx: number;
    dIdx: number;
    score: number;
    reason: string;
  }> = [];

  for (let tIdx = 0; tIdx < templateSections.length; tIdx += 1) {
    const t = templateSections[tIdx];
    const tNorm = normalizeLabel(t.title);
    const tCanonical = normalizeLabel(canonicalizeSectionTitle(t.title));
    const tBigram = bigramSet(tNorm);
    const tPrev = tIdx > 0 ? normalizeLabel(templateSections[tIdx - 1]!.title) : "";
    const tNext =
      tIdx < templateSections.length - 1
        ? normalizeLabel(templateSections[tIdx + 1]!.title)
        : "";

    for (let dIdx = 0; dIdx < draftSections.length; dIdx += 1) {
      const d = draftSections[dIdx];
      const dNorm = normalizeLabel(d.title);
      const dCanonical = normalizeLabel(canonicalizeSectionTitle(d.title));
      const dBigram = bigramSet(dNorm);
      const dPrev = dIdx > 0 ? normalizeLabel(draftSections[dIdx - 1]!.title) : "";
      const dNext =
        dIdx < draftSections.length - 1 ? normalizeLabel(draftSections[dIdx + 1]!.title) : "";

      let rawScore = 0;
      const reasons: string[] = [];

      if (tNorm && dNorm && tNorm === dNorm) {
        rawScore += 1;
        reasons.push("exact");
      } else if (tCanonical && dCanonical && tCanonical === dCanonical) {
        rawScore += 0.95;
        reasons.push("canonical");
      }

      const fuzzy = jaccard(tBigram, dBigram);
      rawScore += fuzzy * fuzzyWeight;
      if (fuzzy >= 0.5) reasons.push("fuzzy");

      const orderSimilarity = 1 - Math.min(1, Math.abs(tIdx / tLen - dIdx / dLen));
      rawScore += orderSimilarity * orderWeight;
      if (orderSimilarity >= 0.8) reasons.push("order");

      let neighborSimilarity = 0;
      if (tPrev && dPrev && (tPrev === dPrev || normalizeLabel(canonicalizeSectionTitle(tPrev)) === normalizeLabel(canonicalizeSectionTitle(dPrev)))) {
        neighborSimilarity += 0.5;
      }
      if (tNext && dNext && (tNext === dNext || normalizeLabel(canonicalizeSectionTitle(tNext)) === normalizeLabel(canonicalizeSectionTitle(dNext)))) {
        neighborSimilarity += 0.5;
      }
      rawScore += neighborSimilarity * neighborWeight;
      if (neighborSimilarity > 0) reasons.push("neighbor");

      const score = Number(Math.max(0, Math.min(1, rawScore / totalBase)).toFixed(2));
      pairs.push({
        tIdx,
        dIdx,
        score,
        reason: reasons.join("+") || "weak",
      });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const usedT = new Set<number>();
  const usedD = new Set<number>();
  const matched: SectionMatch[] = [];
  for (const pair of pairs) {
    if (usedT.has(pair.tIdx) || usedD.has(pair.dIdx)) continue;
    usedT.add(pair.tIdx);
    usedD.add(pair.dIdx);
    matched.push({
      templateSection: templateSections[pair.tIdx]!,
      draftSection: draftSections[pair.dIdx]!,
      score: pair.score,
      reason: pair.reason,
    });
  }

  return {
    matched,
    unmatchedTemplate: templateSections.filter((_, idx) => !usedT.has(idx)),
    unmatchedDraft: draftSections.filter((_, idx) => !usedD.has(idx)),
  };
}

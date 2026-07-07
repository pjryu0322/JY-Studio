import {
  addReason,
  includesNormalized,
  normalizeSearchText,
  tokenizeSearchQuery,
  type SearchScoreReason,
} from "@/lib/search-utils";
import type { KnowledgePack } from "@/types/pack";

const WEIGHTS = {
  nameExact: 100,
  nameContains: 50,
  packIdContains: 40,
  tagExact: 40,
  categoryContains: 25,
  shortDescriptionContains: 20,
  descriptionContains: 10,
  providerContains: 10,
} as const;

export function scorePack(
  pack: KnowledgePack,
  tokens: string[],
): { score: number; matchReasons: SearchScoreReason[] } {
  const reasons: SearchScoreReason[] = [];
  let score = 0;

  const normalizedName = normalizeSearchText(pack.name);
  const normalizedTags = pack.tags.map((tag) => normalizeSearchText(tag));

  for (const token of tokens) {
    if (normalizedName === token) {
      score += addReason(reasons, "name", token, WEIGHTS.nameExact, "이름 정확 일치");
    } else if (includesNormalized(pack.name, token)) {
      score += addReason(reasons, "name", token, WEIGHTS.nameContains, "이름 부분 일치");
    }

    if (includesNormalized(pack.packId, token)) {
      score += addReason(reasons, "packId", token, WEIGHTS.packIdContains, "packId 부분 일치");
    }

    if (normalizedTags.includes(token)) {
      score += addReason(reasons, "tags", token, WEIGHTS.tagExact, "태그 정확 일치");
    }

    if (includesNormalized(pack.category, token) || includesNormalized(pack.categoryId, token)) {
      score += addReason(reasons, "category", token, WEIGHTS.categoryContains, "카테고리 부분 일치");
    }

    if (includesNormalized(pack.shortDescription, token)) {
      score += addReason(
        reasons,
        "shortDescription",
        token,
        WEIGHTS.shortDescriptionContains,
        "요약 부분 일치",
      );
    }

    if (includesNormalized(pack.description, token)) {
      score += addReason(reasons, "description", token, WEIGHTS.descriptionContains, "설명 부분 일치");
    }

    if (includesNormalized(pack.provider, token)) {
      score += addReason(reasons, "provider", token, WEIGHTS.providerContains, "제공자 부분 일치");
    }
  }

  return { score, matchReasons: reasons };
}

export function rankPacks(packs: KnowledgePack[], query: string): KnowledgePack[] {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return [...packs];
  }

  const scored = packs.map((pack) => {
    const { score, matchReasons } = scorePack(pack, tokens);
    return { pack, score, matchReasons };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.pack.isVerified !== b.pack.isVerified) return a.pack.isVerified ? -1 : 1;
    if (b.pack.usageCount !== a.pack.usageCount) return b.pack.usageCount - a.pack.usageCount;
    if (b.pack.rating !== a.pack.rating) return b.pack.rating - a.pack.rating;
    return b.pack.updatedAt.localeCompare(a.pack.updatedAt);
  });

  return scored.map(({ pack, score, matchReasons }) => ({
    ...pack,
    searchScore: score,
    matchReasons,
  }));
}

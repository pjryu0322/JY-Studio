/**
 * Deterministic grouping of refined requirements into capability buckets.
 */

import type { RefinedRequirement } from "../requirementInput/refinement/refinementContracts";
import type { FeatureGroupingRule, RequirementFeatureGroup } from "./featureGenerationContracts";

export type ClusterAssignment = {
  clusterKey: string;
  groupingRule: FeatureGroupingRule;
};

/**
 * Assign each description to a stable cluster key. Same key → same feature.
 * Rules are explicit and ordered; unknown capabilities fall back to per-text literals.
 */
export function assignRequirementCluster(description: string): ClusterAssignment {
  const t = description.trim();
  if (/화상회의/u.test(t)) {
    return { clusterKey: "domain:video-meeting", groupingRule: "DOMAIN_VIDEO_MEETING" };
  }
  if (/게시글/u.test(t) && /(목록|상세|리스트|list|detail)/iu.test(t)) {
    return { clusterKey: "domain:post-browse", groupingRule: "DOMAIN_POST_BROWSE" };
  }
  if (/게시글/u.test(t)) {
    return { clusterKey: "domain:post-general", groupingRule: "DOMAIN_POST_GENERAL" };
  }
  if (/로그인|sign\s*in|login|인증\s*화면/iu.test(t)) {
    return { clusterKey: "domain:auth-login", groupingRule: "DOMAIN_AUTH_LOGIN" };
  }
  if (/설정|settings/iu.test(t)) {
    return { clusterKey: "domain:settings", groupingRule: "DOMAIN_SETTINGS" };
  }
  const compact = t.replace(/\s+/g, " ").trim().slice(0, 96);
  return { clusterKey: `literal:${compact}`, groupingRule: "LITERAL" };
}

/** Domain-oriented working title before {@link normalizeFeatureName} polish. */
export function resolveDefaultFeatureNameForGroup(group: RequirementFeatureGroup): string {
  const { clusterKey, descriptions } = group;
  if (clusterKey === "domain:video-meeting") return "화상회의";
  if (clusterKey === "domain:post-browse") return "게시글 조회";
  if (clusterKey === "domain:post-general") {
    const first = descriptions[0]?.trim() ?? "게시글";
    const m = first.match(/^(.{0,12}게시글)/u);
    return m?.[1]?.trim() ? `${m[1].trim()} 관리` : "게시글";
  }
  if (clusterKey === "domain:auth-login") return "로그인";
  if (clusterKey === "domain:settings") return "설정";
  return descriptions[0]?.trim() ?? "Capability";
}

/**
 * Groups refined rows in traversal order; output sorted by first occurrence index then cluster key.
 */
export function groupRequirementsIntoFeatures(refinedRequirements: readonly RefinedRequirement[]): RequirementFeatureGroup[] {
  const keyTo: Record<
    string,
    { requirementIds: string[]; descriptions: string[]; minIndex: number; groupingRule: FeatureGroupingRule }
  > = {};

  refinedRequirements.forEach((r, index) => {
    const { clusterKey, groupingRule } = assignRequirementCluster(r.description);
    const cur = keyTo[clusterKey] ?? {
      requirementIds: [] as string[],
      descriptions: [] as string[],
      minIndex: Number.POSITIVE_INFINITY,
      groupingRule,
    };
    cur.requirementIds.push(r.id);
    cur.descriptions.push(r.description);
    cur.minIndex = Math.min(cur.minIndex, index);
    keyTo[clusterKey] = cur;
  });

  return Object.entries(keyTo)
    .map(([clusterKey, v]) => ({
      clusterKey,
      groupingRule: v.groupingRule,
      requirementIds: v.requirementIds,
      descriptions: v.descriptions,
      minIndex: v.minIndex,
    }))
    .sort((a, b) => a.minIndex - b.minIndex || a.clusterKey.localeCompare(b.clusterKey))
    .map(({ clusterKey, groupingRule, requirementIds, descriptions }) => ({
      clusterKey,
      groupingRule,
      requirementIds,
      descriptions,
    }));
}

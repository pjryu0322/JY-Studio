export const PROVIDER_PACK_TAB_IDS = [
  "basic",
  "payload",
  "knowledge",
  "serviceValidation",
  "distributionReview",
] as const;

export type ProviderPackTabId = (typeof PROVIDER_PACK_TAB_IDS)[number];

/** Legacy and renamed tab ids — map to the current 5-step workflow. */
const LEGACY_PROVIDER_PACK_TAB_REDIRECT: Record<string, ProviderPackTabId> = {
  materials: "payload",
  source: "payload",
  draft: "payload",
  "source-materials": "payload",
  "knowledge-data": "knowledge",
  "data-structure": "knowledge",
  "service-validation": "serviceValidation",
  "search-validation": "serviceValidation",
  distribution: "distributionReview",
  review: "distributionReview",
  "review-request": "distributionReview",
  inspection: "distributionReview",
  "distribution-review": "distributionReview",
  "basic-info": "basic",
};

export function isProviderPackTabId(value: string): value is ProviderPackTabId {
  return (PROVIDER_PACK_TAB_IDS as readonly string[]).includes(value);
}

export function resolveDefaultProviderPackTab(input: {
  created: boolean;
  status: string;
  sourceDocumentCount: number;
  hasPayload?: boolean;
  hasDistribution?: boolean;
  /** Prefer structurePassed — unlocks search-validation tab. */
  structurePassed?: boolean;
  /** @deprecated Prefer structurePassed */
  knowledgePassed?: boolean;
  providerConfirmed?: boolean;
  serviceValidationPassed?: boolean;
}): ProviderPackTabId {
  const structurePassed = Boolean(input.structurePassed ?? input.knowledgePassed);
  if (input.status === "REVIEWING" || input.status === "PUBLISHED" || input.status === "VERIFIED") {
    return "distributionReview";
  }
  if (input.status !== "DRAFT") {
    return "distributionReview";
  }
  if (input.created) {
    return "basic";
  }
  if (!input.hasPayload && input.sourceDocumentCount === 0) {
    return "payload";
  }
  if (input.hasPayload && !input.providerConfirmed) {
    return "payload";
  }
  if (input.providerConfirmed && !structurePassed) {
    return "knowledge";
  }
  if (structurePassed && !input.serviceValidationPassed) {
    return "serviceValidation";
  }
  return "distributionReview";
}

export function resolveProviderPackTabFromLocation(input: {
  tabParam: string | null;
  hash: string;
  fallback: ProviderPackTabId;
}): ProviderPackTabId {
  if (input.tabParam && isProviderPackTabId(input.tabParam)) {
    return input.tabParam;
  }
  if (input.tabParam && LEGACY_PROVIDER_PACK_TAB_REDIRECT[input.tabParam]) {
    return LEGACY_PROVIDER_PACK_TAB_REDIRECT[input.tabParam];
  }

  const normalizedHash = input.hash.trim().toLowerCase();
  if (
    normalizedHash === "#github-auto-collect" ||
    normalizedHash === "#pack-materials" ||
    normalizedHash === "#pack-sources" ||
    normalizedHash === "#pack-payload"
  ) {
    return "payload";
  }
  if (normalizedHash === "#pack-knowledge" || normalizedHash === "#pack-data-structure") {
    return "knowledge";
  }
  if (
    normalizedHash === "#pack-service-validation" ||
    normalizedHash === "#pack-search-validation"
  ) {
    return "serviceValidation";
  }
  if (
    normalizedHash === "#pack-distribution" ||
    normalizedHash === "#pack-inspection" ||
    normalizedHash === "#pack-review" ||
    normalizedHash === "#pack-distribution-review"
  ) {
    return "distributionReview";
  }

  return input.fallback;
}

export function providerPackTabQuery(tab: ProviderPackTabId): string {
  return `tab=${tab}`;
}

export type ProviderPackTabLock = {
  locked: boolean;
  reason: string | null;
};

export function resolveProviderPackTabLocks(input: {
  providerConfirmed: boolean;
  /** STRUCTURE + KU + Chunk complete on current binding. */
  structurePassed?: boolean;
  /** @deprecated Prefer structurePassed */
  knowledgePassed?: boolean;
  distributionReady?: boolean;
  serviceValidationPassed: boolean;
}): Record<ProviderPackTabId, ProviderPackTabLock> {
  const structurePassed = Boolean(input.structurePassed ?? input.knowledgePassed);
  return {
    basic: { locked: false, reason: null },
    payload: { locked: false, reason: null },
    knowledge: {
      locked: !input.providerConfirmed,
      reason: input.providerConfirmed
        ? null
        : "자료 등록을 먼저 완료해 주세요.",
    },
    serviceValidation: {
      locked: !structurePassed,
      reason: structurePassed
        ? null
        : "Retrieval Chunk 생성이 완료되지 않았습니다.",
    },
    distributionReview: {
      locked: !input.serviceValidationPassed,
      reason: input.serviceValidationPassed
        ? null
        : "검색데이터 생성·검증을 완료해야 유통정보 입력과 검수요청을 진행할 수 있습니다.",
    },
  };
}

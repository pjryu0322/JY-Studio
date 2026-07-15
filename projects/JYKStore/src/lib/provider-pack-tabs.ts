export const PROVIDER_PACK_TAB_IDS = [
  "basic",
  "payload",
  "knowledge",
  "distribution",
  "review",
] as const;

export type ProviderPackTabId = (typeof PROVIDER_PACK_TAB_IDS)[number];

/** Legacy Builder / freeze-era tab ids — map to distribution tabs. */
const LEGACY_PROVIDER_PACK_TAB_REDIRECT: Record<string, ProviderPackTabId> = {
  materials: "payload",
  source: "payload",
  draft: "payload",
  inspection: "review",
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
  knowledgePassed?: boolean;
  providerConfirmed?: boolean;
}): ProviderPackTabId {
  if (input.status === "REVIEWING" || input.status === "PUBLISHED" || input.status === "VERIFIED") {
    return "review";
  }
  if (input.status !== "DRAFT") {
    return "review";
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
  if (input.providerConfirmed && !input.knowledgePassed) {
    return "knowledge";
  }
  if (input.knowledgePassed && !input.hasDistribution) {
    return "distribution";
  }
  return "review";
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
  if (normalizedHash === "#pack-knowledge") {
    return "knowledge";
  }
  if (normalizedHash === "#pack-distribution") {
    return "distribution";
  }
  if (normalizedHash === "#pack-inspection" || normalizedHash === "#pack-review") {
    return "review";
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
  knowledgePassed: boolean;
  distributionReady: boolean;
}): Record<ProviderPackTabId, ProviderPackTabLock> {
  return {
    basic: { locked: false, reason: null },
    payload: { locked: false, reason: null },
    knowledge: {
      locked: !input.providerConfirmed,
      reason: input.providerConfirmed
        ? null
        : "자료 등록에서 대표 샘플 확인을 완료해야 지식 데이터 생성을 시작할 수 있습니다.",
    },
    distribution: {
      locked: !input.knowledgePassed,
      reason: input.knowledgePassed
        ? null
        : "지식 데이터 생성이 완료되면 유통정보를 입력할 수 있습니다.",
    },
    review: {
      locked: !(input.knowledgePassed && input.distributionReady),
      reason:
        input.knowledgePassed && input.distributionReady
          ? null
          : !input.knowledgePassed
            ? "지식 데이터 생성이 완료되어야 검수요청을 진행할 수 있습니다."
            : "유통정보 필수 항목을 입력하면 검수요청을 진행할 수 있습니다.",
    },
  };
}

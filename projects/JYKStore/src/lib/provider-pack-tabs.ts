export const PROVIDER_PACK_TAB_IDS = ["basic", "payload", "distribution", "review"] as const;

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
  if (input.hasPayload && !input.hasDistribution) {
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
  if (normalizedHash === "#pack-distribution") {
    return "distribution";
  }
  if (normalizedHash === "#pack-inspection") {
    return "review";
  }
  if (normalizedHash === "#pack-review") {
    return "review";
  }

  return input.fallback;
}

export function providerPackTabQuery(tab: ProviderPackTabId): string {
  return `tab=${tab}`;
}

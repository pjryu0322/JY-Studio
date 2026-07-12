export const PROVIDER_PACK_TAB_IDS = ["basic", "materials", "review"] as const;

export type ProviderPackTabId = (typeof PROVIDER_PACK_TAB_IDS)[number];

/** Legacy Builder tab ids — map to safe post-freeze tabs. */
const LEGACY_PROVIDER_PACK_TAB_REDIRECT: Record<string, ProviderPackTabId> = {
  source: "materials",
  draft: "materials",
  inspection: "review",
};

export function isProviderPackTabId(value: string): value is ProviderPackTabId {
  return (PROVIDER_PACK_TAB_IDS as readonly string[]).includes(value);
}

export function resolveDefaultProviderPackTab(input: {
  created: boolean;
  status: string;
  sourceDocumentCount: number;
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
  if (input.sourceDocumentCount === 0) {
    return "materials";
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
    normalizedHash === "#pack-sources"
  ) {
    return "materials";
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

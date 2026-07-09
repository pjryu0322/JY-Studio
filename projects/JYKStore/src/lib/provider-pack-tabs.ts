export const PROVIDER_PACK_TAB_IDS = ["basic", "source", "draft", "review"] as const;

export type ProviderPackTabId = (typeof PROVIDER_PACK_TAB_IDS)[number];

export function isProviderPackTabId(value: string): value is ProviderPackTabId {
  return (PROVIDER_PACK_TAB_IDS as readonly string[]).includes(value);
}

export function resolveDefaultProviderPackTab(input: {
  created: boolean;
  status: string;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount: number;
}): ProviderPackTabId {
  if (input.created && input.sourceDocumentCount === 0) {
    return "source";
  }
  if (input.status === "REVIEWING" || input.status === "PUBLISHED" || input.status === "VERIFIED") {
    return "review";
  }
  if (input.status !== "DRAFT") {
    return "review";
  }
  if (input.sourceDocumentCount === 0) {
    return "source";
  }
  if (input.knowledgeUnitDraftCount === 0) {
    return "draft";
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

  const normalizedHash = input.hash.trim().toLowerCase();
  if (normalizedHash === "#github-auto-collect") {
    return "source";
  }
  if (normalizedHash === "#pack-review") {
    return "review";
  }

  return input.fallback;
}

export function providerPackTabQuery(tab: ProviderPackTabId): string {
  return `tab=${tab}`;
}

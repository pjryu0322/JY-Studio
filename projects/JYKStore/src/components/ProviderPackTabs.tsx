"use client";

import {
  PROVIDER_PACK_TAB_BASIC,
  PROVIDER_PACK_TAB_DRAFT,
  PROVIDER_PACK_TAB_INSPECTION,
  PROVIDER_PACK_TAB_REVIEW,
  PROVIDER_PACK_TAB_SOURCE,
} from "@/lib/role-based-ux-copy";
import { PROVIDER_PACK_TAB_IDS, type ProviderPackTabId } from "@/lib/provider-pack-tabs";

const TAB_LABELS: Record<ProviderPackTabId, string> = {
  basic: PROVIDER_PACK_TAB_BASIC,
  source: PROVIDER_PACK_TAB_SOURCE,
  draft: PROVIDER_PACK_TAB_DRAFT,
  inspection: PROVIDER_PACK_TAB_INSPECTION,
  review: PROVIDER_PACK_TAB_REVIEW,
};

export function ProviderPackTabs({
  activeTab,
  onSelectTab,
}: {
  readonly activeTab: ProviderPackTabId;
  readonly onSelectTab: (tab: ProviderPackTabId) => void;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-2xl border border-store-border bg-white p-1 shadow-card"
      role="tablist"
      aria-label="지식팩 작업 단계"
    >
      {PROVIDER_PACK_TAB_IDS.map((tabId) => {
        const active = activeTab === tabId;
        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelectTab(tabId)}
            className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold sm:text-sm ${
              active
                ? "bg-store-accent text-white"
                : "bg-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            {TAB_LABELS[tabId]}
          </button>
        );
      })}
    </div>
  );
}

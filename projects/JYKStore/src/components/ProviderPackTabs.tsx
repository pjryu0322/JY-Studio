"use client";

import {
  PROVIDER_PACK_TAB_BASIC,
  PROVIDER_PACK_TAB_DISTRIBUTION,
  PROVIDER_PACK_TAB_KNOWLEDGE,
  PROVIDER_PACK_TAB_PAYLOAD,
  PROVIDER_PACK_TAB_REVIEW,
  PROVIDER_PACK_TAB_SERVICE_VALIDATION,
} from "@/lib/role-based-ux-copy";
import {
  PROVIDER_PACK_TAB_IDS,
  type ProviderPackTabId,
  type ProviderPackTabLock,
} from "@/lib/provider-pack-tabs";

const TAB_LABELS: Record<ProviderPackTabId, string> = {
  basic: PROVIDER_PACK_TAB_BASIC,
  payload: PROVIDER_PACK_TAB_PAYLOAD,
  knowledge: PROVIDER_PACK_TAB_KNOWLEDGE,
  distribution: PROVIDER_PACK_TAB_DISTRIBUTION,
  serviceValidation: PROVIDER_PACK_TAB_SERVICE_VALIDATION,
  review: PROVIDER_PACK_TAB_REVIEW,
};

export function ProviderPackTabs({
  activeTab,
  onSelectTab,
  locks,
}: {
  readonly activeTab: ProviderPackTabId;
  readonly onSelectTab: (tab: ProviderPackTabId) => void;
  readonly locks?: Partial<Record<ProviderPackTabId, ProviderPackTabLock>>;
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-store-border bg-white p-1 shadow-card"
        role="tablist"
        aria-label="지식팩 작업 단계"
      >
        {PROVIDER_PACK_TAB_IDS.map((tabId) => {
          const active = activeTab === tabId;
          const lock = locks?.[tabId];
          const locked = Boolean(lock?.locked);
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={locked}
              title={lock?.reason ?? undefined}
              onClick={() => {
                if (locked) return;
                onSelectTab(tabId);
              }}
              className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold sm:text-sm ${
                active
                  ? "bg-store-accent text-white"
                  : locked
                    ? "cursor-not-allowed bg-transparent text-slate-400"
                    : "bg-transparent text-slate-700 hover:bg-slate-50"
              }`}
            >
              {TAB_LABELS[tabId]}
              {locked ? " · 잠김" : ""}
            </button>
          );
        })}
      </div>
      {locks?.[activeTab]?.locked && locks[activeTab]?.reason ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {locks[activeTab]?.reason}
        </p>
      ) : null}
    </div>
  );
}

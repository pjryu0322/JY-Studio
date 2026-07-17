"use client";

import {
  PROVIDER_PACK_TAB_BASIC,
  PROVIDER_PACK_TAB_BASIC_SHORT,
  PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW,
  PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW_SHORT,
  PROVIDER_PACK_TAB_KNOWLEDGE,
  PROVIDER_PACK_TAB_KNOWLEDGE_SHORT,
  PROVIDER_PACK_TAB_PAYLOAD,
  PROVIDER_PACK_TAB_PAYLOAD_SHORT,
  PROVIDER_PACK_TAB_SERVICE_VALIDATION,
  PROVIDER_PACK_TAB_SERVICE_VALIDATION_SHORT,
} from "@/lib/role-based-ux-copy";
import {
  PROVIDER_PACK_TAB_IDS,
  type ProviderPackTabId,
  type ProviderPackTabLock,
} from "@/lib/provider-pack-tabs";

const TAB_LABELS: Record<ProviderPackTabId, { label: string; shortLabel: string }> = {
  basic: { label: PROVIDER_PACK_TAB_BASIC, shortLabel: PROVIDER_PACK_TAB_BASIC_SHORT },
  payload: { label: PROVIDER_PACK_TAB_PAYLOAD, shortLabel: PROVIDER_PACK_TAB_PAYLOAD_SHORT },
  knowledge: {
    label: PROVIDER_PACK_TAB_KNOWLEDGE,
    shortLabel: PROVIDER_PACK_TAB_KNOWLEDGE_SHORT,
  },
  serviceValidation: {
    label: PROVIDER_PACK_TAB_SERVICE_VALIDATION,
    shortLabel: PROVIDER_PACK_TAB_SERVICE_VALIDATION_SHORT,
  },
  distributionReview: {
    label: PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW,
    shortLabel: PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW_SHORT,
  },
};

export type ProviderPackTabStepStatus = {
  status: string;
  statusLabel: string;
};

export function ProviderPackTabs({
  activeTab,
  onSelectTab,
  locks,
  stepStatuses,
}: {
  readonly activeTab: ProviderPackTabId;
  readonly onSelectTab: (tab: ProviderPackTabId) => void;
  readonly locks?: Partial<Record<ProviderPackTabId, ProviderPackTabLock>>;
  readonly stepStatuses?: Partial<Record<ProviderPackTabId, ProviderPackTabStepStatus>>;
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-store-border bg-white p-1 shadow-card"
        role="tablist"
        aria-label="지식팩 등록 단계"
      >
        {PROVIDER_PACK_TAB_IDS.map((tabId, index) => {
          const active = activeTab === tabId;
          const lock = locks?.[tabId];
          const locked = Boolean(lock?.locked);
          const labels = TAB_LABELS[tabId];
          const stepStatus = stepStatuses?.[tabId];
          const statusText = locked
            ? "잠김"
            : stepStatus?.statusLabel ?? null;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              id={`provider-pack-tab-${tabId}`}
              aria-controls={`provider-pack-panel-${tabId}`}
              aria-selected={active}
              aria-disabled={locked}
              title={
                lock?.reason ??
                (statusText ? `${labels.label} · ${statusText}` : labels.label)
              }
              onClick={() => {
                if (locked) return;
                onSelectTab(tabId);
              }}
              className={`min-h-[44px] min-w-[4.5rem] flex-1 whitespace-nowrap rounded-xl px-1.5 py-1 text-[11px] font-bold sm:min-w-0 sm:px-3 sm:text-sm ${
                active
                  ? "bg-store-accent text-white"
                  : locked
                    ? "cursor-not-allowed bg-transparent text-slate-400"
                    : "bg-transparent text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="sm:hidden">
                {index + 1}. {labels.shortLabel}
                {statusText ? ` · ${statusText}` : ""}
              </span>
              <span className="hidden sm:inline">
                {index + 1}. {labels.label}
                {statusText ? ` · ${statusText}` : ""}
              </span>
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

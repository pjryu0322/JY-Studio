"use client";

import {
  ADMIN_REVIEW_EVIDENCE_TAB_IDS,
  adminReviewEvidenceTabLabel,
  type AdminReviewEvidenceTabId,
} from "@/lib/admin-review-tabs";

export function AdminReviewEvidenceTabs({
  activeTab,
  onTabChange,
}: {
  readonly activeTab: AdminReviewEvidenceTabId;
  readonly onTabChange: (tab: AdminReviewEvidenceTabId) => void;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-2xl border border-store-border bg-white p-1 shadow-card"
      role="tablist"
      aria-label="판단 근거"
    >
      {ADMIN_REVIEW_EVIDENCE_TAB_IDS.map((tabId) => {
        const active = activeTab === tabId;
        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tabId)}
            className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-bold sm:flex-1 sm:text-sm ${
              active
                ? "bg-store-accent text-white"
                : "bg-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            {adminReviewEvidenceTabLabel(tabId)}
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated Prefer AdminReviewEvidenceTabs */
export { AdminReviewEvidenceTabs as AdminReviewTabs };

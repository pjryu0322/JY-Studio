"use client";

import {
  ADMIN_REVIEW_TAB_IDS,
  adminReviewTabLabel,
  type AdminReviewTabId,
} from "@/lib/admin-review-tabs";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";

export function AdminReviewTabs({
  detail,
  activeTab,
  onTabChange,
}: {
  readonly detail: AdminReviewDetailDto;
  readonly activeTab: AdminReviewTabId;
  readonly onTabChange: (tab: AdminReviewTabId) => void;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-2xl border border-store-border bg-white p-1 shadow-card"
      role="tablist"
      aria-label="검수 상세 탭"
    >
      {ADMIN_REVIEW_TAB_IDS.map((tabId) => {
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
            {adminReviewTabLabel(tabId, detail)}
          </button>
        );
      })}
    </div>
  );
}

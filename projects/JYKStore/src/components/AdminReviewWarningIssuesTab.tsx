"use client";

import { useCallback } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  collectReviewBlockers,
  collectReviewWarnings,
} from "@/lib/admin-review-decision";
import { buildReviewIssuesDetailMarkdown } from "@/lib/admin-review-issues-markdown";
import { hasDoclingReviewEvidence, isPendingAdminReview } from "@/lib/admin-review-tabs";
import { downloadTextFile } from "@/lib/provider-review-markdown";
import {
  ADMIN_REVIEW_BLOCKER_ISSUES_TITLE,
  ADMIN_REVIEW_BLOCKERS_EMPTY,
  ADMIN_REVIEW_ISSUES_EMPTY,
  ADMIN_REVIEW_WARNING_ISSUES_TITLE,
  ADMIN_REVIEW_WARNING_TAB_HINT,
  ADMIN_REVIEW_WARNING_TAB_HINT_ACCEPTED,
  ADMIN_REVIEW_WARNING_TAB_HINT_DOCLING,
  ADMIN_REVIEW_WARNINGS_EMPTY,
} from "@/lib/role-based-ux-copy";
import {
  AdminPanelDownloadIcon,
  AdminPanelIconButton,
} from "@/components/AdminPanelToolbarIcons";

export function AdminReviewWarningIssuesTab({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const warnings = collectReviewWarnings(detail);
  const blockers = collectReviewBlockers(detail);
  const pending = isPendingAdminReview(detail);
  const isDocling = hasDoclingReviewEvidence(detail);

  const hint = isDocling
    ? ADMIN_REVIEW_WARNING_TAB_HINT_DOCLING
    : pending
      ? ADMIN_REVIEW_WARNING_TAB_HINT
      : ADMIN_REVIEW_WARNING_TAB_HINT_ACCEPTED;

  const empty = blockers.length === 0 && warnings.length === 0;

  const onDownloadMarkdown = useCallback(() => {
    const markdown = buildReviewIssuesDetailMarkdown({ detail });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadTextFile(`review-issues-${detail.pack.packId}-${stamp}.md`, markdown);
  }, [detail]);

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_WARNING_ISSUES_TITLE}</h2>
          <p className="mt-1 text-xs text-store-muted">{hint}</p>
        </div>
        <AdminPanelIconButton
          title="차단/주의 이슈 상세 MD 다운로드"
          onClick={onDownloadMarkdown}
          disabled={empty}
        >
          <AdminPanelDownloadIcon />
        </AdminPanelIconButton>
      </div>

      {empty ? (
        <p className="text-xs text-store-muted">{ADMIN_REVIEW_ISSUES_EMPTY}</p>
      ) : (
        <>
          {blockers.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-900">{ADMIN_REVIEW_BLOCKER_ISSUES_TITLE}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-800">
                {blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-emerald-800">{ADMIN_REVIEW_BLOCKERS_EMPTY}</p>
          )}

          {warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-950">주의 이슈</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
                {warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-store-muted">{ADMIN_REVIEW_WARNINGS_EMPTY}</p>
          )}
        </>
      )}
    </section>
  );
}

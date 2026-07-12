"use client";

import { AdminReviewSourceDocuments } from "@/components/AdminReviewSourceDocuments";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { ADMIN_REVIEW_SOURCE_DOCS_TITLE } from "@/lib/role-based-ux-copy";

export function AdminReviewSourceDocumentsTab({
  detail,
}: {
  readonly packId?: string;
  readonly detail: AdminReviewDetailDto;
  readonly onUpdated?: (detail: AdminReviewDetailDto) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-sm font-bold text-slate-900">{ADMIN_REVIEW_SOURCE_DOCS_TITLE}</h2>
      <AdminReviewSourceDocuments versions={detail.versions} />
    </section>
  );
}

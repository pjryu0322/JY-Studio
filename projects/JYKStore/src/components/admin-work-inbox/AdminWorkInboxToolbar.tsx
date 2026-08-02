import {
  ADMIN_WORK_FILTER_CATEGORY_ALL,
  ADMIN_WORK_FILTER_STATUS_ACCEPT,
  ADMIN_WORK_FILTER_STATUS_ALL,
  ADMIN_WORK_FILTER_STATUS_GENERATE,
  ADMIN_WORK_FILTER_STATUS_PACK_REVIEW,
  ADMIN_WORK_FILTER_STATUS_PACK_REVIEW_IN_PROGRESS,
  ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW,
  ADMIN_WORK_FILTER_STATUS_QUALITY,
  ADMIN_WORK_FILTER_STATUS_RETURNED,
  ADMIN_WORK_FILTER_STATUS_SERVICE_VALIDATION,
} from "@/lib/role-based-ux-copy";
import type {
  AdminWorkInboxCategoryOption,
  WorkStatusFilter,
} from "@/components/admin-work-inbox/admin-work-inbox.types";

export function AdminWorkInboxToolbar({
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  statusFilter,
  onStatusFilterChange,
  statusFilterLocked,
}: {
  readonly categoryFilter: string;
  readonly onCategoryFilterChange: (value: string) => void;
  readonly categoryOptions: readonly AdminWorkInboxCategoryOption[];
  readonly statusFilter: WorkStatusFilter;
  readonly onStatusFilterChange: (value: WorkStatusFilter) => void;
  readonly statusFilterLocked: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="admin-work-category">
        카테고리
      </label>
      <select
        id="admin-work-category"
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
        className="min-h-[36px] rounded-lg border border-store-border bg-white px-2.5 text-xs text-slate-800"
      >
        <option value="all">{ADMIN_WORK_FILTER_CATEGORY_ALL}</option>
        {categoryOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="admin-work-status">
        상태
      </label>
      <select
        id="admin-work-status"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as WorkStatusFilter)}
        disabled={statusFilterLocked}
        className="min-h-[36px] rounded-lg border border-store-border bg-white px-2.5 text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
      >
        <option value="all">{ADMIN_WORK_FILTER_STATUS_ALL}</option>
        <option value="accept">{ADMIN_WORK_FILTER_STATUS_ACCEPT}</option>
        <option value="generate">{ADMIN_WORK_FILTER_STATUS_GENERATE}</option>
        <option value="quality">{ADMIN_WORK_FILTER_STATUS_QUALITY}</option>
        <option value="provider_review">{ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW}</option>
        <option value="service_validation">
          {ADMIN_WORK_FILTER_STATUS_SERVICE_VALIDATION}
        </option>
        <option value="pack_review">{ADMIN_WORK_FILTER_STATUS_PACK_REVIEW}</option>
        <option value="pack_review_in_progress">
          {ADMIN_WORK_FILTER_STATUS_PACK_REVIEW_IN_PROGRESS}
        </option>
        <option value="returned">{ADMIN_WORK_FILTER_STATUS_RETURNED}</option>
      </select>
    </div>
  );
}

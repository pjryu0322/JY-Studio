import {
  ADMIN_WORK_CORRECTION_TARGETS_TITLE,
  ADMIN_WORK_GENERATION_TARGETS_TITLE,
  ADMIN_WORK_QUALITY_TARGETS_TITLE,
  ADMIN_WORK_SUMMARY_LABEL,
} from "@/lib/role-based-ux-copy";
import type { AdminWorkQueueKey } from "@/lib/routes";
import type { WorkStatusFilter } from "@/components/admin-work-inbox/admin-work-inbox.types";

export function AdminWorkInboxSummary({
  loading,
  activeQueue,
  totalWaiting,
  rawTotal,
  categoryFilter,
  statusFilter,
}: {
  readonly loading: boolean;
  readonly activeQueue: AdminWorkQueueKey;
  readonly totalWaiting: number;
  readonly rawTotal: number;
  readonly categoryFilter: string;
  readonly statusFilter: WorkStatusFilter;
}) {
  if (loading) return <span />;

  return (
    <p className="px-1 text-xs font-semibold text-slate-700">
      {activeQueue === "generation"
        ? ADMIN_WORK_GENERATION_TARGETS_TITLE
        : activeQueue === "quality"
          ? ADMIN_WORK_QUALITY_TARGETS_TITLE
          : activeQueue === "correction"
            ? ADMIN_WORK_CORRECTION_TARGETS_TITLE
            : `${ADMIN_WORK_SUMMARY_LABEL} ${totalWaiting}건`}
      {activeQueue !== "generation" &&
      activeQueue !== "quality" &&
      activeQueue !== "correction" &&
      (categoryFilter !== "all" || statusFilter !== "all")
        ? ` (전체 ${rawTotal}건)`
        : ""}
    </p>
  );
}

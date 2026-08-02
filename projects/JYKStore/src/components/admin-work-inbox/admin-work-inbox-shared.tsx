import type { ReactNode } from "react";
import Link from "next/link";
import type { AdminWorkInboxItemViewModel, AdminWorkInboxQueueGroup } from "@/lib/admin-work-inbox-view-model";
import { adminWorkInboxDetailHref } from "@/lib/admin-work-inbox/admin-work-inbox-navigation";
import { formatInboxDateTime } from "@/lib/admin-work-inbox/admin-work-inbox-format";

export type WorkSectionProps = {
  readonly title: string;
  readonly body: string;
  readonly count: number;
  readonly accentClass: string;
  readonly children: ReactNode;
};

export function WorkSection({ title, body, count, accentClass, children }: WorkSectionProps) {
  if (count === 0) return null;
  return (
    <section className="space-y-2">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <span
            className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${accentClass}`}
          >
            {count}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-store-muted">{body}</p>
      </div>
      {children}
    </section>
  );
}

export function DisplayStatusBadge({
  displayStatus,
  queueGroup,
}: {
  readonly displayStatus: string;
  readonly queueGroup: AdminWorkInboxQueueGroup;
}) {
  const className =
    queueGroup === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-900"
      : queueGroup === "PROVIDER_REVIEW_IN_PROGRESS"
        ? "bg-violet-100 text-violet-900"
        : queueGroup === "PROVIDER_SUPPLEMENT_REQUIRED" ||
            queueGroup === "RETURNED_OR_REJECTED"
          ? "bg-rose-100 text-rose-900"
          : queueGroup === "ADMIN_REVIEW_REQUIRED" || queueGroup === "ADMIN_REVIEW_IN_PROGRESS"
            ? "bg-orange-100 text-orange-900"
            : queueGroup === "GENERATE_REQUIRED"
              ? "bg-sky-100 text-sky-900"
              : "bg-indigo-100 text-indigo-900";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${className}`}
    >
      {displayStatus}
    </span>
  );
}

/** Play / create icon for 지식데이터 생성 실행. */
export function GenerationCreateIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Inventory / crate icon for 사전정리. */
export function PreflightInventoryIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 8H3l2-4h14l2 4z" />
      <path d="M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
      <path d="M12 12v5" />
    </svg>
  );
}

/** Checkmark icon for 품질점검. */
export function QualityCheckIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

export function WorkInboxCard({
  item,
  metaLine,
  href,
}: {
  readonly item: AdminWorkInboxItemViewModel;
  readonly metaLine?: string | null;
  readonly href?: string;
}) {
  return (
    <li>
      <Link
        href={href ?? adminWorkInboxDetailHref(item)}
        className="flex items-center gap-2 rounded-xl border border-store-border bg-white px-3 py-2.5 transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{item.packName}</p>
            <DisplayStatusBadge
              displayStatus={item.displayStatus}
              queueGroup={item.adminQueueGroup}
            />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-store-muted">
            {metaLine?.trim() ||
              [item.categoryName, item.providerName, item.versionLabel]
                .filter(Boolean)
                .join(" · ")}
          </p>
          {(item.requestedAt || item.acceptedAt) && (
            <p className="mt-0.5 truncate text-[11px] text-store-muted">
              접수요청 {formatInboxDateTime(item.requestedAt)}
              {item.acceptedAt
                ? ` · 접수 ${formatInboxDateTime(item.acceptedAt)}`
                : ""}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-store-accent px-2.5 py-1.5 text-[11px] font-bold text-white">
          {item.ctaLabel}
        </span>
      </Link>
    </li>
  );
}

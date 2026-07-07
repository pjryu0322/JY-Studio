import Link from "next/link";
import { AdminReviewListPageClient } from "@/components/AdminReviewListPageClient";
import { ROUTES } from "@/lib/routes";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <Link href={ROUTES.account} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 계정
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">관리자 콘솔</h1>
        <p className="mt-1 text-sm text-store-muted">REVIEWING 상태 지식팩 검수 및 승인/반려</p>
      </div>
      <Link
        href={ROUTES.adminOps}
        className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">운영 콘솔</p>
          <p className="text-xs text-store-muted">API 사용량, AuditLog, Health 상태 확인</p>
        </div>
        <span className="shrink-0 text-store-accent" aria-hidden>
          →
        </span>
      </Link>
      <AdminReviewListPageClient />
    </div>
  );
}

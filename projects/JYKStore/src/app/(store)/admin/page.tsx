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
      <AdminReviewListPageClient />
    </div>
  );
}

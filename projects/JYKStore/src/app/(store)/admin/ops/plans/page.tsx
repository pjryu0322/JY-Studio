import Link from "next/link";
import { AdminPlanOverviewPanel } from "@/components/AdminPlanOverviewPanel";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsPlansPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.adminOps}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 운영 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">Plan / Billing</h1>
        <p className="mt-1 text-sm text-store-muted">전체 무료 플랜 정책과 사용량 기준입니다.</p>
      </div>
      <AdminPlanOverviewPanel />
    </div>
  );
}

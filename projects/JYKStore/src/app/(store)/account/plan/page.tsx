import Link from "next/link";
import { AccountPlanPanel } from "@/components/AccountPlanPanel";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AccountPlanPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.account}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 계정
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">이용 플랜</h1>
        <p className="mt-1 text-sm text-store-muted">현재 무료 이용 상태 및 Context API 사용량입니다.</p>
      </div>
      <AccountPlanPanel />
    </div>
  );
}

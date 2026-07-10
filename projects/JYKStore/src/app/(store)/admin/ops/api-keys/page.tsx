import Link from "next/link";
import { AdminApiKeysPanel } from "@/components/AdminApiKeysPanel";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsApiKeysPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.adminOps}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 운영 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">API Key 관리</h1>
        <p className="mt-1 text-sm text-store-muted">
          전체 API Key 상태·scope·만료를 확인합니다. raw key 원문은 표시되지 않습니다.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        Admin API Key 관리는 관리자 계정 로그인 세션으로 보호됩니다. 관리자 권한이 있는 계정으로
        로그인한 뒤 이용하세요.
      </div>
      <AdminApiKeysPanel />
    </div>
  );
}

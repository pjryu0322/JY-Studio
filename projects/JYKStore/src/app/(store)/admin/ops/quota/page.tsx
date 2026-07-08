import Link from "next/link";
import { AdminQuotaPanel } from "@/components/AdminQuotaPanel";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsQuotaPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.adminOps}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 운영 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">Quota / Gateway</h1>
        <p className="mt-1 text-sm text-store-muted">
          clientId 기준 Public API 사용량과 429 QUOTA_EXCEEDED를 확인합니다. raw API key는 표시되지
          않습니다.
        </p>
      </div>
      <AdminQuotaPanel />
    </div>
  );
}

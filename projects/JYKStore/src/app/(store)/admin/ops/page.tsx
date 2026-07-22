import Link from "next/link";
import { OpsSummaryPanel } from "@/components/OpsSummaryPanel";
import { AdminConsoleWorkspace } from "@/components/role-workspace/AdminConsoleWorkspace";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsPage() {
  return (
    <AdminConsoleWorkspace activeId="ops">
      <div className="space-y-4">
        <Link href={ROUTES.admin} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
          ← 관리자 콘솔
        </Link>
        <div className="px-1">
          <h1 className="text-lg font-bold text-slate-900">운영 콘솔</h1>
          <p className="mt-1 text-sm text-store-muted">API 사용량, AuditLog, Health 상태를 확인합니다.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          현재 운영 콘솔은 MVP 내부 도구입니다. 실제 운영 환경에서는 관리자 인증과 권한 제어가 필요합니다.
        </div>
        <OpsSummaryPanel />
      </div>
    </AdminConsoleWorkspace>
  );
}

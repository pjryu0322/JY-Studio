import Link from "next/link";
import { OpsAuditLogTable } from "@/components/OpsAuditLogTable";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsAuditPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.adminOps}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 운영 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">AuditLog</h1>
        <p className="mt-1 text-sm text-store-muted">
          운영 감사 로그입니다. 식별자는 마스킹되어 표시됩니다.
        </p>
      </div>
      <OpsAuditLogTable />
    </div>
  );
}

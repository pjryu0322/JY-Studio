import Link from "next/link";
import { OpsUsageLogTable } from "@/components/OpsUsageLogTable";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsUsagePage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.adminOps}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 운영 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">API UsageLog</h1>
        <p className="mt-1 text-sm text-store-muted">
          Context API 호출 로그입니다. API Key 원문은 표시되지 않으며 apiKeyId는 마스킹됩니다.
        </p>
      </div>
      <OpsUsageLogTable />
    </div>
  );
}

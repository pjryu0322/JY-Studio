import Link from "next/link";
import { OpsHealthPanel } from "@/components/OpsHealthPanel";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function AdminOpsHealthPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.adminOps}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 운영 콘솔
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">Health</h1>
        <p className="mt-1 text-sm text-store-muted">DB 및 Context API 운영 상태를 확인합니다.</p>
      </div>
      <OpsHealthPanel />
    </div>
  );
}

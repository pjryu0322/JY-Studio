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
        Admin API Key 관리는 `JYKSTORE_ADMIN_OPS_TOKEN`과 헤더 `X-JYKStore-Admin-Token`으로 보호됩니다.
        production에서는 서버 env에 토큰 설정이 필수이며, UI에 입력한 토큰은 브라우저 저장소에 저장하지 않습니다.
        OAuth/SSO는 후속 단계입니다.
      </div>
      <AdminApiKeysPanel />
    </div>
  );
}

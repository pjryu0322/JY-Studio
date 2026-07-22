import { OpsSummaryPanel } from "@/components/OpsSummaryPanel";
import { AdminConsoleWorkspace } from "@/components/role-workspace/AdminConsoleWorkspace";

export const dynamic = "force-dynamic";

export default function AdminOpsPage() {
  return (
    <AdminConsoleWorkspace activeId="ops">
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          현재 운영 콘솔은 MVP 내부 도구입니다. 실제 운영 환경에서는 관리자 인증과 권한 제어가 필요합니다.
        </div>
        <OpsSummaryPanel />
      </div>
    </AdminConsoleWorkspace>
  );
}

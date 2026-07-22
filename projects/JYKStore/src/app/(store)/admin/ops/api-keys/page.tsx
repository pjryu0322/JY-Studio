import { AdminApiKeysPanel } from "@/components/AdminApiKeysPanel";

export const dynamic = "force-dynamic";

export default function AdminOpsApiKeysPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        Admin API Key 관리는 관리자 계정 로그인 세션으로 보호됩니다. 관리자 권한이 있는 계정으로
        로그인한 뒤 이용하세요.
      </div>
      <AdminApiKeysPanel />
    </div>
  );
}

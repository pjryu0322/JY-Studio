import { AccountPageClient } from "@/components/AccountPageClient";

export default function AccountPage() {
  return (
    <div className="space-y-4 pb-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">계정</h1>
        <p className="mt-1 text-sm text-store-muted">등록된 계정 정보와 관리자 도구를 관리합니다.</p>
      </div>
      <AccountPageClient />
    </div>
  );
}

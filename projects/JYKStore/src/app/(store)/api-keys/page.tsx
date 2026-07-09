import Link from "next/link";
import { ApiKeysPageClient } from "@/components/ApiKeysPageClient";
import { StoreLoginGate } from "@/components/StoreLoginGate";
import { ROUTES } from "@/lib/routes";

export default function ApiKeysPage() {
  return (
    <StoreLoginGate>
      <div className="space-y-4">
        <Link href={ROUTES.account} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
          ← 계정
        </Link>
        <div className="px-1">
          <h1 className="text-lg font-bold text-slate-900">API Key 관리</h1>
          <p className="mt-1 text-sm text-store-muted">
            연동에 사용할 API Key를 발급합니다. Key 원문은 생성 직후 한 번만 표시됩니다.
          </p>
        </div>
        <ApiKeysPageClient />
      </div>
    </StoreLoginGate>
  );
}

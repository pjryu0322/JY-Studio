import Link from "next/link";
import { ProviderCenterPageClient } from "@/components/ProviderCenterPageClient";
import { ROUTES } from "@/lib/routes";

export default function ProviderCenterPage() {
  return (
    <div className="space-y-4">
      <Link href={ROUTES.account} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 계정
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">지식팩 제공자 센터</h1>
        <p className="mt-1 text-sm text-store-muted">
          제공자 프로필과 지식팩 초안을 관리합니다. DRAFT/REVIEWING 지식팩은 일반 스토어에 노출되지 않습니다.
        </p>
      </div>
      <ProviderCenterPageClient />
    </div>
  );
}

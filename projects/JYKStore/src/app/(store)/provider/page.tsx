import Link from "next/link";
import { ProviderCenterPageClient } from "@/components/ProviderCenterPageClient";
import { PROVIDER_CENTER_ONBOARDING_STEPS } from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

export default function ProviderCenterPage() {
  return (
    <div className="space-y-4">
      <Link href={ROUTES.account} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 계정
      </Link>
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h1 className="text-lg font-bold text-slate-900">지식팩 제공자 센터</h1>
        <p className="mt-1 text-sm text-store-muted">
          제품·솔루션 지식을 지식팩으로 등록하는 공간입니다.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-700">
          {PROVIDER_CENTER_ONBOARDING_STEPS.map((step, index) => (
            <li key={step}>
              <span className="font-medium">{index + 1}.</span> {step}
            </li>
          ))}
        </ol>
      </div>
      <ProviderCenterPageClient />
    </div>
  );
}

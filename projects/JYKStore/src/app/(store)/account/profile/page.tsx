import Link from "next/link";
import { AccountProfilePageClient } from "@/components/AccountProfilePageClient";
import { ROUTES } from "@/lib/routes";

export default function AccountProfilePage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.account}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 계정
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">프로필 관리</h1>
        <p className="mt-1 text-sm text-store-muted">로그인과 제공자 프로필을 관리합니다.</p>
      </div>
      <AccountProfilePageClient />
    </div>
  );
}

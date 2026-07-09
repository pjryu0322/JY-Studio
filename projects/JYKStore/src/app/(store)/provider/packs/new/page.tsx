import Link from "next/link";
import { cookies } from "next/headers";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { ProviderPackCreateForm } from "@/components/ProviderPackCreateForm";
import { ProviderRequiredCard } from "@/components/ProviderRequiredCard";
import { getUserIdFromCookies } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getProviderProfileByUserId } from "@/lib/provider-profile-service";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function ProviderPackNewPage() {
  const userId = await getUserIdFromCookies();

  if (!userId) {
    return (
      <div className="space-y-4">
        <Link
          href={ROUTES.provider}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
        >
          ← 제공자 센터
        </Link>
        <AuthRequiredCard />
      </div>
    );
  }

  const profile = await getProviderProfileByUserId(userId);

  const categories = await prisma.packCategory.findMany({
    orderBy: { name: "asc" },
    select: { categoryId: true, name: true },
  });

  if (!profile) {
    return (
      <div className="space-y-4">
        <Link
          href={ROUTES.provider}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
        >
          ← 제공자 센터
        </Link>
        <ProviderRequiredCard />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.provider}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 제공자 센터
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">새 지식팩 초안</h1>
        <p className="mt-1 text-sm text-store-muted">
          생성 후 상세 화면에서 GitHub URL 자동수집을 실행하거나 문서를 등록하세요.
        </p>
      </div>
      <ProviderPackCreateForm categories={categories} />
    </div>
  );
}
